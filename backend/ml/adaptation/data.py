"""Speaker split, label preparation and padding.

All speakers read the same numbered sentences, so the split is by *sentence*: a validation sentence is never a
training sentence for the adapted speaker, and the other-speaker check uses the same validation sentences, which
the adapter has never seen as text. Only the dev split is used; test utterances are rejected.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

from ml.dataset import Utterance
from ml.metrics import find_names

IGNORE_INDEX = -100  # label positions with this value do not contribute to the loss


def sentence_key(utterance: Utterance) -> str:
    """The script sentence number, from the file name: recordings/<speaker>/07.m4a -> "07"."""
    return utterance.audio_path.stem


@dataclass(frozen=True)
class SpeakerSplit:
    speaker: str
    seed: int
    train: tuple[Utterance, ...]
    validation: tuple[Utterance, ...]

    @property
    def validation_keys(self) -> frozenset[str]:
        return frozenset(sentence_key(u) for u in self.validation)

    def other_speaker_validation(self, utterances: Iterable[Utterance]) -> list[Utterance]:
        """Other speakers' dev recordings of the validation sentences only (text never seen in training)."""
        keys = self.validation_keys
        return sorted(
            (u for u in utterances if u.split == "dev" and u.speaker_id != self.speaker and sentence_key(u) in keys),
            key=lambda u: (u.speaker_id, sentence_key(u)),
        )

    def as_dict(self) -> dict[str, Any]:
        """Ids only: transcripts stay in the (git-ignored) manifest."""
        return {
            "speaker": self.speaker,
            "seed": self.seed,
            "train_ids": [u.id for u in self.train],
            "validation_ids": [u.id for u in self.validation],
            "validation_sentences": sorted(self.validation_keys),
        }


def split_speaker(utterances: Sequence[Utterance], speaker: str, *, n_validation: int, seed: int) -> SpeakerSplit:
    """Deterministic, sentence-disjoint train/validation split of one speaker's dev recordings.

    Stratified by whether the sentence contains a mythology name, so validation measures name accuracy too.
    """
    dev = [u for u in utterances if u.speaker_id == speaker and u.split == "dev"]
    if not dev:
        raise ValueError(f"no dev recordings for speaker {speaker!r}")
    by_key: dict[str, Utterance] = {}
    for u in dev:
        if sentence_key(u) in by_key:
            raise ValueError(f"speaker {speaker!r} has two dev recordings of sentence {sentence_key(u)}")
        by_key[sentence_key(u)] = u
    if not 0 < n_validation < len(by_key):
        raise ValueError(f"n_validation must be between 1 and {len(by_key) - 1}")

    with_names = sorted(k for k, u in by_key.items() if find_names(u.transcript))
    without = sorted(k for k in by_key if k not in set(with_names))
    rng = random.Random(seed)
    n_without = min(len(without), max(1 if without else 0, round(n_validation * len(without) / len(by_key))))
    n_with = n_validation - n_without
    if n_with > len(with_names):
        n_with, n_without = len(with_names), n_validation - len(with_names)
    keys = set(rng.sample(without, n_without)) | set(rng.sample(with_names, n_with))
    ordered = sorted(by_key)
    return SpeakerSplit(
        speaker=speaker,
        seed=seed,
        train=tuple(by_key[k] for k in ordered if k not in keys),
        validation=tuple(by_key[k] for k in ordered if k in keys),
    )


def label_ids(tokenizer: Any, text: str, decoder_start_token_id: int) -> list[int]:
    """Target tokens for teacher forcing: <|notimestamps|> text <|endoftext|>.

    The text gets a leading space because that is how Whisper itself emits the first word (checked on the pinned
    checkpoint). <|startoftranscript|> is dropped: the model prepends it when it shifts the labels right to build
    the decoder inputs, so keeping it would teach the model to predict it twice.
    """
    ids = list(tokenizer(" " + text.strip()).input_ids)
    if ids and ids[0] == decoder_start_token_id:
        ids = ids[1:]
    return ids


def pad_labels(sequences: Sequence[Sequence[int]]) -> "Any":
    """Right-pad with IGNORE_INDEX into a LongTensor, so padding never contributes to the loss."""
    import torch

    width = max(len(s) for s in sequences)
    out = torch.full((len(sequences), width), IGNORE_INDEX, dtype=torch.long)
    for row, seq in enumerate(sequences):
        out[row, : len(seq)] = torch.tensor(list(seq), dtype=torch.long)
    return out


def featurize(processor: Any, samples: Any) -> "Any":
    """Log-mel features exactly as ml.local_asr computes them for inference (same feature extractor)."""
    from ml.local_asr import SAMPLE_RATE

    return processor.feature_extractor(samples, sampling_rate=SAMPLE_RATE, return_tensors="pt").input_features[0]
