"""WER, mythology-name accuracy and latency statistics. Pure functions: no audio, no network."""

import pytest

from ml.metrics import ErrorCounts, find_names, latency_stats, name_counts, percentile, tokenize, word_error_rate, word_errors
from ml.vocabulary import MYTHOLOGY_TERMS, Term, hint_prompt

REQUIRED_TERMS = [
    "Aphrodite", "Athena", "Ares", "Hades", "Zeus", "Olympus", "Argos", "Theron", "Lyra", "Somnus", "Master Lightning Bolt",
]


class TestTokenize:
    def test_case_punctuation_and_spacing_are_ignored(self):
        assert tokenize("  Somnus,  let the HEAVENS dream!  ") == ["somnus", "let", "the", "heavens", "dream"]

    def test_accents_hyphens_and_curly_apostrophes(self):
        assert tokenize("Aphrodité’s well-known gift — truly") == ["aphrodite's", "well", "known", "gift", "truly"]

    def test_edge_apostrophes_are_dropped_inner_ones_kept(self):
        assert tokenize("'Hades' don't") == ["hades", "don't"]

    def test_empty_and_punctuation_only(self):
        assert tokenize("") == [] and tokenize(" ... !? ") == []


class TestWordErrorRate:
    def test_correct_transcript(self):
        counts = word_errors("Zeus guards the bolt.", "zeus guards the bolt")
        assert counts == ErrorCounts(0, 0, 0, 4) and counts.wer == 0.0

    def test_inserted_word(self):
        counts = word_errors("let the heavens dream", "let the the heavens dream")
        assert (counts.substitutions, counts.deletions, counts.insertions) == (0, 0, 1)
        assert counts.wer == pytest.approx(1 / 4)

    def test_deleted_word(self):
        counts = word_errors("let the heavens dream", "let heavens dream")
        assert (counts.substitutions, counts.deletions, counts.insertions) == (0, 1, 0)
        assert counts.wer == pytest.approx(1 / 4)

    def test_substituted_word(self):
        counts = word_errors("I spoke with Ares", "I spoke with Aries")
        assert (counts.substitutions, counts.deletions, counts.insertions) == (1, 0, 0)
        assert counts.wer == pytest.approx(1 / 4)

    def test_mixed_errors(self):
        # ref: a b c d e f   hyp: a x c e f g  -> b->x (S), d deleted (D), g inserted (I); the only 3-edit alignment
        counts = word_errors("a b c d e f", "a x c e f g")
        assert (counts.substitutions, counts.deletions, counts.insertions) == (1, 1, 1)
        assert counts.wer == pytest.approx(3 / 6)

    def test_ambiguous_alignment_still_has_the_minimum_total(self):
        assert word_errors("a b c d e", "a x c e f").errors == 3

    def test_wer_can_exceed_one(self):
        assert word_error_rate("yes", "no no no") == pytest.approx(3.0)

    def test_empty_hypothesis_is_all_deletions(self):
        counts = word_errors("Somnus let the heavens dream", "")
        assert counts == ErrorCounts(0, 5, 0, 5) and counts.wer == 1.0

    def test_empty_reference_and_hypothesis(self):
        counts = word_errors("", "")
        assert counts == ErrorCounts() and counts.wer is None

    def test_output_on_a_silence_clip_counts_as_insertions(self):
        counts = word_errors("", "Thank you.")
        assert counts.insertions == 2 and counts.reference_words == 0 and counts.wer is None

    def test_corpus_totals_add_up(self):
        total = word_errors("a b", "a") + word_errors("c d", "c d e") + word_errors("", "x")
        assert total == ErrorCounts(0, 1, 2, 4) and total.wer == pytest.approx(3 / 4)


class TestNames:
    def test_vocabulary_has_exactly_the_required_terms(self):
        assert [term.canonical for term in MYTHOLOGY_TERMS] == REQUIRED_TERMS

    def test_hint_prompt_lists_every_term_once(self):
        prompt = hint_prompt()
        for term in REQUIRED_TERMS:
            assert prompt.count(term) == 1
        assert find_names(prompt) == {term: 1 for term in REQUIRED_TERMS}

    def test_case_accents_and_possessives_are_normalized(self):
        found = find_names("ZEUS's bolt, Hades' realm, aphrodité and Athena’s owl")
        assert found == {"Zeus": 1, "Hades": 1, "Aphrodite": 1, "Athena": 1}

    def test_multi_word_name_must_be_complete(self):
        assert find_names("the master lightning-bolt") == {"Master Lightning Bolt": 1}
        assert find_names("the lightning bolt") == {}
        assert find_names("master of lightning bolts") == {}

    def test_sound_alikes_are_not_mapped_to_names(self):
        # "Aries" and "Zeus-like" sound-alikes must stay errors, not silently become names.
        assert find_names("Aries is a star sign; Lira is a currency; Thereon") == {}

    def test_name_inside_a_longer_word_does_not_count(self):
        assert find_names("Hadesville Zeuses Argosy") == {}

    def test_all_names_recognised(self):
        counts = name_counts("Theron and Lyra met Argos.", "theron and lyra met argos")
        assert (counts.reference, counts.matched, counts.inserted, counts.accuracy) == (3, 3, 0, 1.0)

    def test_missed_and_spurious_names(self):
        counts = name_counts("Ares spoke to Zeus about Zeus.", "Aries spoke to Zeus about Hades.")
        assert counts.reference == 3 and counts.matched == 1
        assert counts.missed == ("Ares", "Zeus") and counts.spurious == ("Hades",)
        assert counts.inserted == 1 and counts.accuracy == pytest.approx(1 / 3)

    def test_no_names_in_reference(self):
        counts = name_counts("talk about the weather", "talk about Zeus")
        assert counts.accuracy is None and counts.inserted == 1

    def test_custom_variant_spelling(self):
        terms = (Term("Olympus", variants=("Olympos",)),)
        assert find_names("Mount Olympos", terms) == {"Olympus": 1}

    def test_counts_add_up(self):
        total = name_counts("Zeus", "Zeus") + name_counts("Hades", "Ares")
        assert (total.reference, total.matched, total.inserted, total.accuracy) == (2, 1, 1, 0.5)


class TestLatency:
    def test_percentiles(self):
        samples = [100.0, 200.0, 300.0, 400.0, 500.0]
        assert percentile(samples, 50) == 300.0 and percentile(samples, 90) == pytest.approx(460.0)
        assert percentile([42.0], 90) == 42.0

    def test_stats(self):
        assert latency_stats([300.0, 100.0, 200.0]) == {"count": 3, "mean_ms": 200.0, "p50_ms": 200.0, "p90_ms": 280.0, "max_ms": 300.0}

    def test_no_samples(self):
        assert latency_stats([])["count"] == 0 and latency_stats([])["p50_ms"] is None
        with pytest.raises(ValueError):
            percentile([], 50)
