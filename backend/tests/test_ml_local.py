"""Local Whisper baseline (M3): CLI and report plumbing with a fake transcriber, plus the pieces that need no model.

No network, no model download. Tests that need numpy/torch/afconvert are skipped when those are missing.
"""

import asyncio
import json
import math
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path

import pytest

from ml import local_benchmark
from ml.asr import Mode
from ml.evaluate import build_report
from speech import M4A as M4A_FORMAT, WAV as WAV_FORMAT

BACKEND = Path(__file__).resolve().parent.parent


def make_manifest(tmp_path, rows):
    (tmp_path / "rec").mkdir()
    lines = []
    for uid, speaker, split, text in rows:
        (tmp_path / "rec" / f"{uid}.wav").write_bytes(b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 400)
        lines.append(json.dumps({"id": uid, "audio_path": f"rec/{uid}.wav", "transcript": text, "speaker_id": speaker, "split": split}))
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text("\n".join(lines) + "\n")
    return manifest


class FakeInfo:
    def as_dict(self):
        return {"model_id": "openai/whisper-base.en", "revision": "0" * 40, "device": "cpu", "dtype": "float32",
                "parameters": 72_593_408, "weights_mb": 290.4, "load_seconds": 0.1}


class FakeLocal:
    """Answers per utterance id (taken from the audio path), records calls, never touches torch."""

    def __init__(self, answers):
        self.answers, self.calls, self.inference_ms, self.info = answers, [], [], FakeInfo()

    async def __call__(self, audio, audio_format, mode):
        assert mode is Mode.BASELINE
        self.calls.append(audio_format)
        self.inference_ms.append(10.0)
        return self.answers.pop(0) if self.answers else ""


ROWS = [("a-01", "a", "dev", "Zeus is angry."), ("b-01", "b", "dev", "Ask Athena."), ("a-21", "a", "test", "Secret test line.")]


def test_local_run_reuses_the_scoring_and_labels_the_report(tmp_path, capsys):
    manifest = make_manifest(tmp_path, ROWS)
    fake = FakeLocal(["warm-up output", "Zeus is angry.", "Ask a Tina."])
    code = local_benchmark.main(["--manifest", str(manifest), "--out", str(tmp_path / "out")], make_transcriber=lambda a: fake)
    assert code == 0
    report = json.loads((tmp_path / "out" / "results.json").read_text())
    assert report["measurement"] == "local_model" and "warning" not in report
    assert list(report["modes"]) == ["baseline"] and report["modes"]["baseline"]["prompt"] is None
    assert report["provider"]["host"] == "local:cpu"
    baseline = report["summary"]["modes"]["baseline"]
    assert baseline["succeeded"] == 2 and baseline["names_in_reference"] == 2 and baseline["names_matched"] == 1
    assert set(report["summary"]["per_speaker"]) == {"a", "b"}
    # one warm-up call happened but is neither scored nor timed
    assert len(fake.calls) == 3 and report["local_model"]["inference_latency"]["count"] == 2
    assert [u["id"] for u in report["utterances"]] == ["a-01", "b-01"]  # the test split is never touched
    assert "transcripts_included" in report and "reference" not in report["utterances"][0]
    assert "Local model measurement" in (tmp_path / "out" / "summary.md").read_text()


def test_test_split_is_refused_without_explicit_permission(tmp_path, capsys):
    manifest = make_manifest(tmp_path, ROWS)
    fake = FakeLocal([])
    assert local_benchmark.main(["--manifest", str(manifest), "--split", "test"], make_transcriber=lambda a: fake) == 2
    assert fake.calls == []


def test_speaker_filter_and_limit(tmp_path):
    manifest = make_manifest(tmp_path, ROWS)
    fake = FakeLocal([])
    local_benchmark.main(["--manifest", str(manifest), "--speakers", "b", "--warmup", "0", "--out", str(tmp_path / "o")],
                         make_transcriber=lambda a: fake)
    report = json.loads((tmp_path / "o" / "results.json").read_text())
    assert [u["id"] for u in report["utterances"]] == ["b-01"]


def test_build_report_needs_settings_or_a_provider_description(tmp_path):
    manifest = make_manifest(tmp_path, ROWS[:1])
    from ml.evaluate import Measurement

    with pytest.raises(ValueError):
        build_report([], measurement=Measurement.LOCAL, settings=None, split="dev", manifest_path=manifest)


def test_importing_the_local_modules_does_not_import_torch():
    code = "import sys; import ml.local_asr, ml.local_benchmark; print('torch' in sys.modules or 'transformers' in sys.modules)"
    out = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, capture_output=True, text=True, check=True)
    assert out.stdout.strip() == "False"


def test_local_transcriber_refuses_prompted_modes():
    from ml.local_asr import LocalASRError, LocalWhisperTranscriber

    transcriber = object.__new__(LocalWhisperTranscriber)  # no model needed: the check comes first
    with pytest.raises(LocalASRError):
        asyncio.run(transcriber(b"", M4A_FORMAT, Mode.MYTHOLOGY_HINTS))


def test_only_pinned_checkpoints_and_safetensors_are_fetched():
    from ml.local_asr import CHECKPOINT_FILES, PINNED_REVISIONS

    assert all(len(rev) == 40 for rev in PINNED_REVISIONS.values())
    assert not any(name.endswith((".bin", ".h5", ".msgpack", ".ckpt")) for name in CHECKPOINT_FILES)


@pytest.mark.skipif(shutil.which("afconvert") is None, reason="afconvert is macOS-only")
def test_decode_audio_gives_16khz_mono_float32(tmp_path):
    np = pytest.importorskip("numpy")
    from ml.local_asr import decode_audio

    rate, seconds = 44_100, 0.5
    source = tmp_path / "tone.wav"
    with wave.open(str(source), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(rate)
        frame = lambda i: struct.pack("<hh", *(int(8000 * math.sin(2 * math.pi * 440 * i / rate)),) * 2)
        w.writeframes(b"".join(frame(i) for i in range(int(rate * seconds))))
    data = source.read_bytes()
    samples = decode_audio(data, WAV_FORMAT)
    assert samples.dtype == np.float32 and samples.ndim == 1
    assert abs(len(samples) - 8000) < 200 and 0.1 < float(np.abs(samples).max()) < 0.5
    assert source.read_bytes() == data  # the recording is never modified


def test_pick_device():
    pytest.importorskip("torch")
    from ml.local_asr import LocalASRError, pick_device

    assert pick_device("cpu") == "cpu"
    assert pick_device("auto") in ("mps", "cpu")
    with pytest.raises(LocalASRError):
        pick_device("cuda")
