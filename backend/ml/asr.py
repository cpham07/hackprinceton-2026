"""Baseline vs mythology-hint transcription, through the production provider code but never through /transcribe.

Both modes call `speech.transcribe` with a copy of the settings that differs only in the prompt:
baseline sends no prompt (even if TRANSCRIPTION_PROMPT is set in .env), the experimental mode sends
the vocabulary hint. Model, language, temperature and the audio bytes are identical.
"""

from __future__ import annotations

from dataclasses import replace
from enum import Enum
from typing import Protocol

import httpx

from config import Settings
from speech import AudioFormat, transcribe
from ml.vocabulary import hint_prompt


class Mode(str, Enum):
    BASELINE = "baseline"
    MYTHOLOGY_HINTS = "mythology_hints"


ALL_MODES = (Mode.BASELINE, Mode.MYTHOLOGY_HINTS)

# Models known to accept the `prompt` field of /audio/transcriptions. Dated snapshots ("<name>-2025-...") count.
PROMPT_CAPABLE_MODELS = ("whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe")


def model_supports_prompt(model: str) -> bool:
    """True for OpenAI's prompt-capable models and Whisper-family models (whisper-large-v3 and similar)."""
    name = model.strip().lower()
    if name.startswith("whisper"):
        return True
    return any(name == known or name.startswith(known + "-") for known in PROMPT_CAPABLE_MODELS)


def prompt_for(mode: Mode, hint: str) -> str | None:
    return hint if mode is Mode.MYTHOLOGY_HINTS else None


class Transcriber(Protocol):
    async def __call__(self, audio: bytes, audio_format: AudioFormat, mode: Mode) -> str: ...


class ProviderTranscriber:
    """Calls the configured OpenAI-compatible provider. Every call may cost money."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient, hint: str | None = None) -> None:
        self.settings = settings
        self.client = client
        self.hint = hint if hint is not None else hint_prompt()

    def settings_for(self, mode: Mode) -> Settings:
        return replace(self.settings, transcription_prompt=prompt_for(mode, self.hint))

    async def __call__(self, audio: bytes, audio_format: AudioFormat, mode: Mode) -> str:
        return await transcribe(audio, audio_format, self.settings_for(mode), self.client)
