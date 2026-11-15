"""The mythology vocabulary: the proper names the experiment hints to the ASR model and the evaluator scores.

A term lists only other *spellings* of the same name (accents, hyphens and case are already handled by
normalization). It never lists sound-alikes: "Aries" is a real word, so mapping it to "Ares" would
blindly rewrite what the player said. The experiment only *hints* these names to the model; no
transcript is ever post-edited.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Term:
    canonical: str
    variants: tuple[str, ...] = ()  # alternate spellings of the same name, never sound-alike words

    @property
    def spellings(self) -> tuple[str, ...]:
        return (self.canonical, *self.variants)


MYTHOLOGY_TERMS: tuple[Term, ...] = (
    Term("Aphrodite"),
    Term("Athena"),
    Term("Ares"),
    Term("Hades"),
    Term("Zeus"),
    Term("Olympus"),
    Term("Argos"),
    Term("Theron"),
    Term("Lyra"),
    Term("Somnus"),
    Term("Master Lightning Bolt"),
)


def hint_prompt(terms: tuple[Term, ...] = MYTHOLOGY_TERMS) -> str:
    """The prompt sent in the mythology-aware mode: the canonical spellings as a plain glossary.

    Whisper-style models treat the prompt as preceding context, so a short list of correctly spelled
    names biases recognition toward those spellings without instructing the model to insert them.
    """
    return ", ".join(term.canonical for term in terms) + "."
