"""Backend configuration, read from environment variables.

A `backend/.env` file is loaded too when present (real environment variables win). Nothing here
is ever logged or returned to clients: the API key fields are excluded from repr().
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Mapping, MutableMapping, TypeVar

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_CORS_ORIGINS = ("http://localhost:5173",)
ENV_FILE = Path(__file__).parent / ".env"

# The vocabulary hint sent to the hosted transcription model (whisper-1) so the game's proper names are
# spelled correctly. This is the one place to change it. It is the exact prompt validated by the ASR
# experiment (scripted recordings, baseline vs. hint); it only biases spelling, transcripts are never
# rewritten. TRANSCRIPTION_PROMPT replaces it; TRANSCRIPTION_VOCABULARY_HINTS=false turns prompting off.
MYTHOLOGY_TRANSCRIPTION_PROMPT = (
    "Aphrodite, Athena, Ares, Hades, Zeus, Olympus, Argos, Theron, Lyra, Somnus, Master Lightning Bolt."
)

T = TypeVar("T", int, float)


class ConfigError(ValueError):
    """An environment variable has an unusable value. Raised at startup so misconfiguration is loud."""


def load_env_file(path: Path = ENV_FILE, environ: MutableMapping[str, str] | None = None) -> None:
    """Load KEY=VALUE lines from `path` into the environment without overriding existing variables."""
    target = os.environ if environ is None else environ
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        if key and key not in target:
            target[key] = value


def _text(environ: Mapping[str, str], name: str) -> str | None:
    value = environ.get(name, "").strip()
    return value or None  # blank counts as unset, so a copied .env.example is harmless


def _number(environ: Mapping[str, str], name: str, default: T, cast: Callable[[str], T], minimum: T) -> T:
    raw = _text(environ, name)
    if raw is None:
        return default
    try:
        value = cast(raw)
    except ValueError:
        raise ConfigError(f"{name} must be a number, got {raw!r}.") from None
    if value < minimum:
        raise ConfigError(f"{name} must be at least {minimum}, got {value}.")
    return value


def _flag(environ: Mapping[str, str], name: str, default: bool) -> bool:
    raw = _text(environ, name)
    if raw is None:
        return default
    value = raw.lower()
    if value in ("1", "true", "yes", "on"):
        return True
    if value in ("0", "false", "no", "off"):
        return False
    raise ConfigError(f"{name} must be true or false, got {raw!r}.")


def _transcription_prompt(environ: Mapping[str, str]) -> str | None:
    if not _flag(environ, "TRANSCRIPTION_VOCABULARY_HINTS", True):
        return None
    return _text(environ, "TRANSCRIPTION_PROMPT") or MYTHOLOGY_TRANSCRIPTION_PROMPT


@dataclass(frozen=True)
class Settings:
    # --- provider (OpenAI-compatible) ---
    api_key: str | None = field(default=None, repr=False)
    base_url: str = DEFAULT_BASE_URL
    # Optional per-service overrides, e.g. a different provider for transcription.
    transcription_api_key: str | None = field(default=None, repr=False)
    transcription_base_url: str | None = None
    dialogue_api_key: str | None = field(default=None, repr=False)
    dialogue_base_url: str | None = None

    # --- models ---
    transcription_model: str = "whisper-1"
    dialogue_model: str = "gpt-4o-mini"

    # --- transcription ---
    max_audio_bytes: int = 10 * 1024 * 1024
    transcription_timeout_s: float = 45.0  # the frontend gives up after 60 s
    transcription_language: str | None = "en"  # blank = let the provider detect it
    # None = no prompt (plain transcription). A transcript that merely echoes the prompt is discarded
    # in speech.py, since Whisper can return the prompt as the "transcript" of silence.
    transcription_prompt: str | None = MYTHOLOGY_TRANSCRIPTION_PROMPT

    # --- dialogue ---
    dialogue_timeout_s: float = 20.0  # the frontend gives up after 30 s
    dialogue_max_tokens: int = 220
    dialogue_temperature: float = 0.8

    # --- http ---
    cors_origins: tuple[str, ...] = DEFAULT_CORS_ORIGINS

    @property
    def transcription_credentials(self) -> tuple[str | None, str]:
        return (self.transcription_api_key or self.api_key, self.transcription_base_url or self.base_url)

    @property
    def dialogue_credentials(self) -> tuple[str | None, str]:
        return (self.dialogue_api_key or self.api_key, self.dialogue_base_url or self.base_url)

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "Settings":
        env = os.environ if environ is None else environ
        origins = tuple(o.strip() for o in (_text(env, "CORS_ORIGINS") or "").split(",") if o.strip())
        language = env.get("TRANSCRIPTION_LANGUAGE")
        return cls(
            api_key=_text(env, "OPENAI_API_KEY"),
            base_url=_text(env, "OPENAI_BASE_URL") or DEFAULT_BASE_URL,
            transcription_api_key=_text(env, "TRANSCRIPTION_API_KEY"),
            transcription_base_url=_text(env, "TRANSCRIPTION_BASE_URL"),
            dialogue_api_key=_text(env, "NPC_DIALOGUE_API_KEY"),
            dialogue_base_url=_text(env, "NPC_DIALOGUE_BASE_URL"),
            transcription_model=_text(env, "TRANSCRIPTION_MODEL") or cls.transcription_model,
            dialogue_model=_text(env, "NPC_DIALOGUE_MODEL") or cls.dialogue_model,
            max_audio_bytes=_number(env, "MAX_AUDIO_BYTES", cls.max_audio_bytes, int, 1024),
            transcription_timeout_s=_number(env, "TRANSCRIPTION_TIMEOUT_SECONDS", cls.transcription_timeout_s, float, 1.0),
            transcription_language=(language.strip() or None) if language is not None else cls.transcription_language,
            transcription_prompt=_transcription_prompt(env),
            dialogue_timeout_s=_number(env, "NPC_DIALOGUE_TIMEOUT_SECONDS", cls.dialogue_timeout_s, float, 1.0),
            dialogue_max_tokens=_number(env, "NPC_DIALOGUE_MAX_TOKENS", cls.dialogue_max_tokens, int, 16),
            dialogue_temperature=_number(env, "NPC_DIALOGUE_TEMPERATURE", cls.dialogue_temperature, float, 0.0),
            cors_origins=origins or DEFAULT_CORS_ORIGINS,
        )


def load_settings() -> Settings:
    """Settings for the running server: `.env` file first, then the real environment."""
    load_env_file()
    return Settings.from_env()
