"""Shared test helpers: a fake OpenAI-compatible provider and request builders. No real network calls."""

from __future__ import annotations

import copy
from typing import Any, Callable

import httpx
from fastapi.testclient import TestClient

from config import Settings
from main import create_app

FAKE_KEY = "sk-test-NOT-A-REAL-KEY-0123456789"
WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 400  # EBML header: sniffed as WebM
OGG = b"OggS" + b"\x00" * 400
MP4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 400  # generic MP4 (e.g. Safari MediaRecorder)
# Header of a real MacBook recording (QuickTime/Voice Memos): ftyp, major brand "M4A ", then mdat.
M4A = b"\x00\x00\x00\x1cftypM4A \x00\x00\x00\x00M4A isommp42" + b"\x00\x01\xc4\x66mdat" + b"\x00" * 400
MP3 = b"ID3" + b"\x00" * 400
WAV = b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 400


def chat_json(content: Any) -> dict:
    return {"choices": [{"index": 0, "message": {"role": "assistant", "content": content}}]}


class FakeProvider:
    """Stands in for the AI provider. Records every request; answers like the OpenAI REST API."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.transcript: Any = "I came here to speak with you."
        self.replies: list[Any] = ["An interesting answer, mortal. Tell me more."]
        self.override: Callable[[httpx.Request], httpx.Response] | None = None

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.override is not None:
            return self.override(request)
        if request.url.path.endswith("/audio/transcriptions"):
            return httpx.Response(200, json={"text": self.transcript})
        if request.url.path.endswith("/chat/completions"):
            index = min(len(self.chat_requests) - 1, len(self.replies) - 1)
            return httpx.Response(200, json=chat_json(self.replies[index]))
        return httpx.Response(404)

    @property
    def transcription_requests(self) -> list[httpx.Request]:
        return [r for r in self.requests if r.url.path.endswith("/audio/transcriptions")]

    @property
    def chat_requests(self) -> list[httpx.Request]:
        return [r for r in self.requests if r.url.path.endswith("/chat/completions")]

    def chat_payload(self, index: int = -1) -> dict:
        import json

        return json.loads(self.chat_requests[index].content)

    def always(self, status: int, **kwargs: Any) -> None:
        self.override = lambda request: httpx.Response(status, **kwargs)

    def fail_with(self, error: Exception) -> None:
        def raiser(request: httpx.Request) -> httpx.Response:
            raise error

        self.override = raiser


def make_client(provider: FakeProvider, **overrides: Any) -> TestClient:
    settings = Settings(**{"api_key": FAKE_KEY, **overrides})
    app = create_app(settings, transport=httpx.MockTransport(provider))
    return TestClient(app)


def audio_upload(data: bytes = WEBM, content_type: str = "audio/webm", field: str = "audio", filename: str = "recording.webm"):
    return {field: (filename, data, content_type)}


BASE_DIALOGUE_REQUEST: dict = {
    "npcId": "hades",
    "playerText": "Aphrodite said Zeus was dangerous.",
    "chapter": 2,
    "conversationHistory": [{"speaker": "npc", "text": "Why do you seek my brother's lightning bolt?"}],
    "storyContext": {
        "relevantFlags": {},
        "clues": [],
        "inventory": [],
        "completedQuests": [],
        "seals": {"athena": True, "ares": True, "hades": False},
    },
}


def dialogue_request(**overrides: Any) -> dict:
    """The example request from the frontend contract, with top-level or storyContext fields replaced."""
    body = copy.deepcopy(BASE_DIALOGUE_REQUEST)
    context_keys = set(body["storyContext"])
    for key, value in overrides.items():
        (body["storyContext"] if key in context_keys else body)[key] = value
    return body
