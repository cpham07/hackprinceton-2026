"""Speech recognition: validate a browser recording, then transcribe it with a hosted model.

The recording lives only in memory for the duration of the request: it is never written to disk
by this code, and neither audio nor transcripts are logged.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import httpx

from config import Settings
from errors import ServiceError
from provider import post_json_to_provider

logger = logging.getLogger("backend.speech")

MIN_AUDIO_BYTES = 100  # a real recording is never smaller than its container header plus a frame


@dataclass(frozen=True)
class AudioFormat:
    extension: str
    mime_type: str

    @property
    def filename(self) -> str:
        return f"recording.{self.extension}"


WEBM = AudioFormat("webm", "audio/webm")
OGG = AudioFormat("ogg", "audio/ogg")
MP4 = AudioFormat("mp4", "audio/mp4")
# Audio-only MPEG-4 from Apple apps (QuickTime, Voice Memos, Music): major brand "M4A ". The provider
# rejects these as "Invalid file format" when they are labelled .mp4, so they keep their own extension.
M4A = AudioFormat("m4a", "audio/mp4")
M4A_BRANDS = frozenset({b"M4A ", b"M4B "})
MP3 = AudioFormat("mp3", "audio/mpeg")
WAV = AudioFormat("wav", "audio/wav")

SUPPORTED_FORMATS_TEXT = "WebM, Ogg, MP4/M4A, MP3 or WAV"

# Content types a browser may declare for the formats above (parameters such as ";codecs=opus" are ignored).
# An unlisted type is rejected, but the declared type is never trusted: the bytes are checked as well.
ACCEPTED_CONTENT_TYPES = frozenset(
    {
        "audio/webm", "video/webm",
        "audio/ogg", "application/ogg", "video/ogg",
        "audio/mp4", "audio/x-m4a", "audio/m4a", "video/mp4",
        "audio/mpeg", "audio/mp3",
        "audio/wav", "audio/x-wav", "audio/wave",
        "application/octet-stream",
    }
)


def sniff_audio_format(data: bytes) -> AudioFormat | None:
    """Identify the container from its leading bytes."""
    if data[:4] == b"\x1a\x45\xdf\xa3":
        return WEBM
    if data[:4] == b"OggS":
        return OGG
    if data[4:8] == b"ftyp":
        return M4A if data[8:12] in M4A_BRANDS else MP4
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return WAV
    if data[:3] == b"ID3" or (len(data) > 1 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0):
        return MP3
    return None


def validate_audio(data: bytes, declared_content_type: str | None, max_bytes: int) -> AudioFormat:
    """Reject empty, oversized and unsupported recordings with a precise status code."""
    if len(data) == 0:
        raise ServiceError(400, "The recording is empty.")
    if len(data) > max_bytes:
        raise ServiceError(413, f"The recording is larger than the {max_bytes // (1024 * 1024)} MB limit.")
    if len(data) < MIN_AUDIO_BYTES:
        raise ServiceError(400, "The recording is too short to contain audio.")
    declared = (declared_content_type or "").split(";")[0].strip().lower()
    if declared and declared not in ACCEPTED_CONTENT_TYPES:
        raise ServiceError(415, f"Unsupported media type. Send {SUPPORTED_FORMATS_TEXT} audio.")
    detected = sniff_audio_format(data)
    if detected is None:
        raise ServiceError(415, f"The upload is not a supported audio format ({SUPPORTED_FORMATS_TEXT}).")
    return detected


async def transcribe(audio: bytes, audio_format: AudioFormat, settings: Settings, client: httpx.AsyncClient) -> str:
    """Send the recording to the provider and return the recognized text (possibly empty for silence).

    No voice-activity trimming or fluency scoring is applied: the whole recording is transcribed
    as one natural utterance, pauses and repetitions included. Failures raise ServiceError;
    a failed transcription is never replaced by made-up text.
    """
    api_key, base_url = settings.transcription_credentials
    if not api_key:
        raise ServiceError(
            503,
            "Speech recognition is not configured on the server (set OPENAI_API_KEY; see backend/.env.example).",
        )

    form = {"model": settings.transcription_model, "response_format": "json", "temperature": "0"}
    if settings.transcription_language:
        form["language"] = settings.transcription_language
    if settings.transcription_prompt:
        form["prompt"] = settings.transcription_prompt

    started = time.perf_counter()
    data = await post_json_to_provider(
        client,
        base_url.rstrip("/") + "/audio/transcriptions",
        api_key=api_key,
        timeout_s=settings.transcription_timeout_s,
        service="speech recognition",
        data=form,
        files={"file": (audio_format.filename, audio, audio_format.mime_type)},
    )

    text = data.get("text")
    if not isinstance(text, str):
        raise ServiceError(502, "The speech recognition provider sent a response without text.")
    # Metadata only: never the audio, never the transcript.
    logger.info(
        "transcribed format=%s bytes=%d model=%s chars=%d ms=%d",
        audio_format.extension, len(audio), settings.transcription_model, len(text),
        (time.perf_counter() - started) * 1000,
    )
    return text.strip()
