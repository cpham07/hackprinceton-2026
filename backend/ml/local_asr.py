"""Local pretrained Whisper (Hugging Face transformers + PyTorch) as an experimental transcriber. Milestone M3.

Not used by the server: /transcribe still calls the hosted provider. torch and transformers are imported lazily,
so the server and its tests never need them (install with `pip install -r requirements-ml.txt`).

- Weights are the published checkpoints, pinned to a commit and loaded unchanged (no fine-tuning, fp32).
- Only safetensors + config/tokenizer files are downloaded, into ml/models/ (git-ignored).
- Audio is decoded with macOS `afconvert` to 16 kHz mono (no ffmpeg needed). The recording file is never modified;
  the decoded copy lives in a temporary directory that is deleted right away.
- Decoding is greedy (one beam, no sampling), no prompt, so runs are deterministic on a given device.
- Neither audio nor transcripts are logged.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from speech import AudioFormat
from ml.asr import Mode

SAMPLE_RATE = 16_000
MODELS_DIR = Path(__file__).parent / "models"
DEFAULT_MODEL = "openai/whisper-base.en"
# Exact checkpoint commits, so "the same local model" means the same bytes before and after any adaptation.
PINNED_REVISIONS = {
    "openai/whisper-tiny.en": "87c7102498dcde7456f24cfd30239ca606ed9063",
    "openai/whisper-base.en": "911407f4214e0e1d82085af863093ec0b66f9cd6",
}
# Skips the TensorFlow/Flax/pytorch_model.bin duplicates (about 4x the safetensors size).
CHECKPOINT_FILES = [
    "config.json", "generation_config.json", "model.safetensors", "preprocessor_config.json", "normalizer.json",
    "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "added_tokens.json", "vocab.json", "merges.txt",
]


class LocalASRError(RuntimeError):
    """Local decoding or inference failed. Messages never contain audio or transcripts."""


def decode_audio(audio: bytes, audio_format: AudioFormat) -> "Any":
    """Decode a recording to a float32 numpy array at 16 kHz mono with macOS afconvert."""
    import numpy as np

    afconvert = shutil.which("afconvert")
    if afconvert is None:
        raise LocalASRError("afconvert not found: local decoding currently needs macOS")
    with tempfile.TemporaryDirectory(prefix="ml-asr-") as tmp:
        source, target = Path(tmp) / f"in.{audio_format.extension}", Path(tmp) / "out.wav"
        source.write_bytes(audio)
        done = subprocess.run(
            [afconvert, "-f", "WAVE", "-d", f"LEI16@{SAMPLE_RATE}", "-c", "1", str(source), str(target)],
            capture_output=True,
            timeout=60,
        )
        if done.returncode != 0 or not target.is_file():
            raise LocalASRError(f"afconvert could not decode the {audio_format.extension} recording")
        with wave.open(str(target)) as wav:
            if wav.getframerate() != SAMPLE_RATE or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                raise LocalASRError("afconvert produced an unexpected WAV layout")
            frames = wav.readframes(wav.getnframes())
    return np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0


def pick_device(requested: str = "auto") -> str:
    """"auto" means MPS when PyTorch reports it usable, otherwise CPU. An explicit "mps" that is unavailable fails."""
    import torch

    mps = torch.backends.mps.is_available()
    if requested == "auto":
        return "mps" if mps else "cpu"
    if requested == "mps" and not mps:
        raise LocalASRError("MPS was requested but torch.backends.mps.is_available() is False")
    if requested not in ("mps", "cpu"):
        raise LocalASRError(f"unsupported device {requested!r} (use auto, mps or cpu)")
    return requested


@dataclass(frozen=True)
class LocalModelInfo:
    model_id: str
    revision: str
    device: str  # where the weights actually are after loading, e.g. "mps:0"
    dtype: str
    parameters: int
    weights_bytes: int  # model.safetensors on disk
    load_seconds: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "model_id": self.model_id,
            "revision": self.revision,
            "device": self.device,
            "dtype": self.dtype,
            "parameters": self.parameters,
            "weights_mb": round(self.weights_bytes / 1e6, 1),
            "load_seconds": round(self.load_seconds, 2),
        }


class LocalWhisperTranscriber:
    """A `Transcriber` (see ml.asr) backed by an unmodified local Whisper checkpoint. Baseline mode only."""

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL,
        *,
        device: str = "auto",
        cache_dir: Path = MODELS_DIR,
        offline: bool = False,
    ) -> None:
        import torch
        from huggingface_hub import snapshot_download
        from transformers import WhisperForConditionalGeneration, WhisperProcessor

        if model_id not in PINNED_REVISIONS:
            raise LocalASRError(f"unknown model {model_id!r}; pinned: {', '.join(PINNED_REVISIONS)}")
        os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
        started = time.perf_counter()
        path = Path(snapshot_download(
            model_id,
            revision=PINNED_REVISIONS[model_id],
            cache_dir=cache_dir,
            allow_patterns=CHECKPOINT_FILES,
            local_files_only=offline,
        ))
        target = pick_device(device)
        self._torch = torch
        self.processor = WhisperProcessor.from_pretrained(path)
        self.model = WhisperForConditionalGeneration.from_pretrained(path, dtype=torch.float32).to(target).eval()
        first = next(self.model.parameters())
        self.info = LocalModelInfo(
            model_id=model_id,
            revision=PINNED_REVISIONS[model_id],
            device=str(first.device),
            dtype=str(first.dtype).removeprefix("torch."),
            parameters=sum(p.numel() for p in self.model.parameters()),
            weights_bytes=(path / "model.safetensors").stat().st_size,
            load_seconds=time.perf_counter() - started,
        )
        self.inference_ms: list[float] = []  # model time only (features + generate), excludes audio decoding

    def transcribe_samples(self, samples: Any) -> str:
        torch = self._torch
        device = self.model.device
        inputs = self.processor(samples, sampling_rate=SAMPLE_RATE, return_tensors="pt", return_attention_mask=True)
        started = time.perf_counter()
        with torch.inference_mode():
            ids = self.model.generate(
                inputs.input_features.to(device),
                attention_mask=inputs.attention_mask.to(device),
                num_beams=1,
                do_sample=False,
            )
        ids = ids.cpu()  # waits for the device, so the timing below is complete
        self.inference_ms.append((time.perf_counter() - started) * 1000)
        return self.processor.batch_decode(ids, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0].strip()

    async def __call__(self, audio: bytes, audio_format: AudioFormat, mode: Mode) -> str:
        if mode is not Mode.BASELINE:
            raise LocalASRError("the local model is evaluated without prompts (baseline mode only)")
        return self.transcribe_samples(decode_audio(audio, audio_format))
