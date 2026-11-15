"""Text normalization, word error rate, mythology-name accuracy and latency statistics. Pure functions, no I/O."""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Sequence

from ml.vocabulary import MYTHOLOGY_TERMS, Term

_APOSTROPHES = str.maketrans({"’": "'", "‘": "'", "ʼ": "'", "`": "'"})
_DASHES = re.compile(r"[-‐-―]")
_NOT_WORD = re.compile(r"[^\w\s']|_")


def tokenize(text: str) -> list[str]:
    """Normalize for scoring: accents removed, lowercase, punctuation dropped, hyphens split.

    Apostrophes are kept inside words ("zeus's" stays one token, distinct from "zeus") and dropped at
    word edges ("hades'" becomes "hades"). Numbers are not spelled out: keep references and model
    output in the same style (write numbers as words in transcripts).
    """
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.translate(_APOSTROPHES).lower()
    text = _NOT_WORD.sub(" ", _DASHES.sub(" ", text))
    return [token for token in (raw.strip("'") for raw in text.split()) if token]


# --- word error rate -----------------------------------------------------------------------------


@dataclass(frozen=True)
class ErrorCounts:
    """Word-level alignment counts. WER = (S + D + I) / reference words."""

    substitutions: int = 0
    deletions: int = 0
    insertions: int = 0
    reference_words: int = 0

    @property
    def errors(self) -> int:
        return self.substitutions + self.deletions + self.insertions

    @property
    def wer(self) -> float | None:
        """None when the reference is empty (a silence clip): WER is undefined there; insertions still count in corpus totals."""
        return self.errors / self.reference_words if self.reference_words else None

    def __add__(self, other: "ErrorCounts") -> "ErrorCounts":
        return ErrorCounts(
            self.substitutions + other.substitutions,
            self.deletions + other.deletions,
            self.insertions + other.insertions,
            self.reference_words + other.reference_words,
        )


def align_words(reference: Sequence[str], hypothesis: Sequence[str]) -> ErrorCounts:
    """Minimum edit distance alignment (Levenshtein on words), split into S/D/I by backtracking."""
    n, m = len(reference), len(hypothesis)
    dist = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dist[i][0] = i
    for j in range(m + 1):
        dist[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            same = reference[i - 1] == hypothesis[j - 1]
            dist[i][j] = min(dist[i - 1][j - 1] + (0 if same else 1), dist[i - 1][j] + 1, dist[i][j - 1] + 1)

    subs = dels = ins = 0
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            same = reference[i - 1] == hypothesis[j - 1]
            if dist[i][j] == dist[i - 1][j - 1] + (0 if same else 1):
                subs += 0 if same else 1
                i, j = i - 1, j - 1
                continue
        if i > 0 and dist[i][j] == dist[i - 1][j] + 1:
            dels += 1
            i -= 1
        else:
            ins += 1
            j -= 1
    return ErrorCounts(subs, dels, ins, n)


def word_errors(reference: str, hypothesis: str) -> ErrorCounts:
    return align_words(tokenize(reference), tokenize(hypothesis))


def word_error_rate(reference: str, hypothesis: str) -> float | None:
    return word_errors(reference, hypothesis).wer


# --- mythology names -----------------------------------------------------------------------------


def _name_patterns(terms: Iterable[Term]) -> list[tuple[tuple[str, ...], str]]:
    """(token sequence, canonical name) pairs, longest first so "Master Lightning Bolt" wins over shorter overlaps."""
    patterns = {tuple(tokenize(spelling)): term.canonical for term in terms for spelling in term.spellings}
    return sorted(patterns.items(), key=lambda item: -len(item[0]))


def find_names(text: str, terms: Iterable[Term] = MYTHOLOGY_TERMS) -> Counter[str]:
    """Count vocabulary names in `text` (canonical spelling -> occurrences).

    Matching is on normalized whole tokens; a possessive is reduced to its name ("Zeus's" counts as Zeus).
    A multi-word name only counts when complete ("lightning bolt" alone is not "Master Lightning Bolt").
    """
    tokens = [token[:-2] if token.endswith("'s") else token for token in tokenize(text)]
    patterns = _name_patterns(terms)
    found: Counter[str] = Counter()
    i = 0
    while i < len(tokens):
        for pattern, canonical in patterns:
            if tuple(tokens[i : i + len(pattern)]) == pattern:
                found[canonical] += 1
                i += len(pattern)
                break
        else:
            i += 1
    return found


@dataclass(frozen=True)
class NameCounts:
    """Name occurrences in the reference, how many the hypothesis got, and names it added.

    Matching is per name and order-independent: if the reference says "Zeus" twice and the hypothesis
    once, one is matched and one missed. `inserted` counts names the hypothesis has beyond the
    reference, which is how over-eager vocabulary hints show up.
    """

    reference: int = 0
    matched: int = 0
    inserted: int = 0
    missed: tuple[str, ...] = ()
    spurious: tuple[str, ...] = ()

    @property
    def accuracy(self) -> float | None:
        return self.matched / self.reference if self.reference else None

    def __add__(self, other: "NameCounts") -> "NameCounts":
        return NameCounts(
            self.reference + other.reference,
            self.matched + other.matched,
            self.inserted + other.inserted,
            self.missed + other.missed,
            self.spurious + other.spurious,
        )


def name_counts(reference: str, hypothesis: str, terms: Iterable[Term] = MYTHOLOGY_TERMS) -> NameCounts:
    terms = tuple(terms)
    expected, got = find_names(reference, terms), find_names(hypothesis, terms)
    matched = expected & got
    missed = expected - got
    spurious = got - expected
    return NameCounts(
        reference=sum(expected.values()),
        matched=sum(matched.values()),
        inserted=sum(spurious.values()),
        missed=tuple(sorted(missed.elements())),
        spurious=tuple(sorted(spurious.elements())),
    )


# --- latency -------------------------------------------------------------------------------------


def percentile(samples: Sequence[float], q: float) -> float:
    """Linear-interpolated percentile, q in [0, 100]."""
    if not samples:
        raise ValueError("percentile of no samples")
    ordered = sorted(samples)
    position = (len(ordered) - 1) * q / 100
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def latency_stats(samples_ms: Sequence[float]) -> dict[str, float | int | None]:
    if not samples_ms:
        return {"count": 0, "mean_ms": None, "p50_ms": None, "p90_ms": None, "max_ms": None}
    return {
        "count": len(samples_ms),
        "mean_ms": round(sum(samples_ms) / len(samples_ms), 1),
        "p50_ms": round(percentile(samples_ms, 50), 1),
        "p90_ms": round(percentile(samples_ms, 90), 1),
        "max_ms": round(max(samples_ms), 1),
    }
