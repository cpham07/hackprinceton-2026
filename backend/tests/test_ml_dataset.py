"""Manifest loading and validation. Uses temporary files only; no real recordings."""

import json
from pathlib import Path

import pytest

from ml.dataset import ManifestError, load_manifest, missing_audio

EXAMPLE = Path(__file__).resolve().parents[1] / "ml" / "examples" / "manifest.example.jsonl"


def entry(**overrides):
    base = {"id": "u1", "audio_path": "audio/u1.webm", "transcript": "Zeus guards the bolt.", "speaker_id": "p01", "split": "dev"}
    base.update(overrides)
    return {k: v for k, v in base.items() if v is not ...}


def write(tmp_path, *records, raw_lines=()):
    path = tmp_path / "manifest.jsonl"
    lines = [json.dumps(r) for r in records] + list(raw_lines)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def test_loads_entries_with_paths_relative_to_the_manifest(tmp_path):
    path = write(tmp_path, entry(), entry(id="u2", audio_path="audio/u2.wav", split="test", tags=["silence"], transcript=""))
    first, second = load_manifest(path)
    assert first.audio_path == (tmp_path / "audio" / "u1.webm").resolve()
    assert first.transcript == "Zeus guards the bolt." and first.speaker_id == "p01" and first.split == "dev"
    assert second.transcript == "" and second.tags == ("silence",)


def test_blank_lines_are_ignored(tmp_path):
    path = write(tmp_path, entry(), raw_lines=["", "   "])
    assert len(load_manifest(path)) == 1


def test_split_filter(tmp_path):
    path = write(tmp_path, entry(), entry(id="u2", audio_path="b.webm", split="test"))
    assert [u.id for u in load_manifest(path, splits=["dev"])] == ["u1"]
    assert [u.id for u in load_manifest(path, splits=["test"])] == ["u2"]
    with pytest.raises(ManifestError, match="unknown split"):
        load_manifest(path, splits=["train"])


@pytest.mark.parametrize(
    ("record", "message"),
    [
        (entry(transcript=...), "missing field"),
        (entry(speaker_id=...), "missing field"),
        (entry(split="train"), "split must be one of"),
        (entry(transcript=None), "transcript must be a string"),
        (entry(id="  "), "id must not be empty"),
        (entry(speaker="p01"), "unknown field"),
        (entry(tags="silence"), "tags must be a list"),
        (entry(audio_path="/etc/passwd"), "must be relative"),
        (entry(audio_path="../outside.webm"), "inside the manifest's folder"),
    ],
)
def test_invalid_entries_are_rejected_with_the_line_number(tmp_path, record, message):
    path = write(tmp_path, entry(id="ok", audio_path="ok.webm"), record)
    with pytest.raises(ManifestError, match=message) as info:
        load_manifest(path)
    assert "line 2" in str(info.value)


def test_errors_never_quote_the_transcript(tmp_path):
    path = write(tmp_path, entry(transcript="my private sentence", split="nope"))
    with pytest.raises(ManifestError) as info:
        load_manifest(path)
    assert "private" not in str(info.value)


def test_invalid_json(tmp_path):
    path = write(tmp_path, entry(), raw_lines=["{not json"])
    with pytest.raises(ManifestError, match="line 2: not valid JSON"):
        load_manifest(path)
    with pytest.raises(ManifestError, match="expected a JSON object"):
        load_manifest(write(tmp_path, raw_lines=["[1, 2]"]))


def test_duplicate_ids(tmp_path):
    path = write(tmp_path, entry(), entry(audio_path="other.webm"))
    with pytest.raises(ManifestError, match="duplicate id"):
        load_manifest(path)


def test_the_same_recording_cannot_be_in_dev_and_test(tmp_path):
    path = write(tmp_path, entry(), entry(id="u2", audio_path="./audio/u1.webm", split="test"))
    with pytest.raises(ManifestError, match="both the dev and test"):
        load_manifest(path)


def test_missing_manifest(tmp_path):
    with pytest.raises(ManifestError, match="not found"):
        load_manifest(tmp_path / "nope.jsonl")


def test_missing_audio_is_listed_not_fatal(tmp_path):
    (tmp_path / "audio").mkdir()
    (tmp_path / "audio" / "u1.webm").write_bytes(b"x")
    path = write(tmp_path, entry(), entry(id="u2", audio_path="audio/u2.webm"))
    utterances = load_manifest(path)
    assert [u.id for u in missing_audio(utterances)] == ["u2"]


def test_the_committed_example_manifest_is_valid_and_has_no_audio():
    utterances = load_manifest(EXAMPLE)
    assert {u.split for u in utterances} == {"dev", "test"}
    assert any(u.transcript == "" for u in utterances)  # includes a silence clip
    assert len(missing_audio(utterances)) == len(utterances)  # no recordings are committed
