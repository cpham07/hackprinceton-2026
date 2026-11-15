"""Evaluation manifests: one JSON object per line (JSONL).

    {"id": "p01-dev-001", "audio_path": "recordings/p01/dev-001.webm", "transcript": "Somnus, let the heavens dream.", "speaker_id": "p01", "split": "dev"}

- `id`: unique within the manifest.
- `audio_path`: relative to the manifest's folder, and must stay inside it.
- `transcript`: what was actually said (ground truth). "" marks a silence/noise clip.
- `speaker_id`: a pseudonym (never a real name).
- `split`: "dev" (tune on it freely) or "test" (held out: run once settings are frozen).
- `tags`: optional list of strings.

Audio files are not opened here, so a missing file is reported per utterance by the evaluator
instead of failing the whole run (`missing_audio` lists them up front).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SPLITS = ("dev", "test")
REQUIRED_FIELDS = ("id", "audio_path", "transcript", "speaker_id", "split")
OPTIONAL_FIELDS = ("tags",)


class ManifestError(ValueError):
    """The manifest is unusable. Messages name the line, never the transcript."""


@dataclass(frozen=True)
class Utterance:
    id: str
    audio_path: Path  # absolute, resolved
    transcript: str
    speaker_id: str
    split: str
    tags: tuple[str, ...] = ()


def _parse_line(raw: str, line_no: int, base: Path) -> Utterance:
    try:
        record = json.loads(raw)
    except json.JSONDecodeError:
        raise ManifestError(f"line {line_no}: not valid JSON") from None
    if not isinstance(record, dict):
        raise ManifestError(f"line {line_no}: expected a JSON object")

    missing = [name for name in REQUIRED_FIELDS if name not in record]
    if missing:
        raise ManifestError(f"line {line_no}: missing field(s) {', '.join(missing)}")
    unknown = sorted(set(record) - set(REQUIRED_FIELDS) - set(OPTIONAL_FIELDS))
    if unknown:
        raise ManifestError(f"line {line_no}: unknown field(s) {', '.join(unknown)}")
    for name in REQUIRED_FIELDS:
        if not isinstance(record[name], str):
            raise ManifestError(f"line {line_no}: {name} must be a string")
    for name in ("id", "audio_path", "speaker_id"):
        if not record[name].strip():
            raise ManifestError(f"line {line_no}: {name} must not be empty")
    if record["split"] not in SPLITS:
        raise ManifestError(f"line {line_no}: split must be one of {', '.join(SPLITS)}")
    tags = record.get("tags", [])
    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        raise ManifestError(f"line {line_no}: tags must be a list of strings")

    relative = Path(record["audio_path"])
    if relative.is_absolute():
        raise ManifestError(f"line {line_no}: audio_path must be relative to the manifest")
    audio_path = (base / relative).resolve()
    if not audio_path.is_relative_to(base):
        raise ManifestError(f"line {line_no}: audio_path must stay inside the manifest's folder")

    return Utterance(
        id=record["id"].strip(),
        audio_path=audio_path,
        transcript=record["transcript"],
        speaker_id=record["speaker_id"].strip(),
        split=record["split"],
        tags=tuple(tags),
    )


def load_manifest(path: str | Path, splits: Iterable[str] | None = None) -> list[Utterance]:
    """Parse and validate the whole manifest, then return the utterances of the requested splits (all by default)."""
    path = Path(path)
    if not path.is_file():
        raise ManifestError(f"manifest not found: {path}")
    base = path.resolve().parent
    utterances: list[Utterance] = []
    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if raw.strip():
            utterances.append(_parse_line(raw, line_no, base))

    seen_ids: set[str] = set()
    split_of_audio: dict[Path, str] = {}
    for utterance in utterances:
        if utterance.id in seen_ids:
            raise ManifestError(f"duplicate id {utterance.id!r}")
        seen_ids.add(utterance.id)
        other = split_of_audio.setdefault(utterance.audio_path, utterance.split)
        if other != utterance.split:
            raise ManifestError(f"{utterance.id}: the same recording is in both the dev and test splits")

    if splits is None:
        return utterances
    wanted = set(splits)
    unknown = wanted - set(SPLITS)
    if unknown:
        raise ManifestError(f"unknown split(s): {', '.join(sorted(unknown))}")
    return [utterance for utterance in utterances if utterance.split in wanted]


def missing_audio(utterances: Iterable[Utterance]) -> list[Utterance]:
    return [utterance for utterance in utterances if not utterance.audio_path.is_file()]
