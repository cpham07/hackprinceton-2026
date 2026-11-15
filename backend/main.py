"""FastAPI server: health check, speech-to-text, contextual NPC dialogue, and speaking feedback.

Routes are thin. Validation, prompts and provider calls live in speech.py, npc_dialogue.py and provider.py;
configuration is in config.py (environment variables, see .env.example).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import Settings, load_settings
from errors import ServiceError
from npc_dialogue import NpcDialogueRequest, NpcDialogueResponse, generate_reply
from speaking_feedback import SpeakingFeedback, SpeakingFeedbackRequest, generate_feedback
from speech import SUPPORTED_FORMATS_TEXT, transcribe, validate_audio

logger = logging.getLogger("backend")

# Multipart framing adds a little to the file itself; this headroom keeps the early size check from
# rejecting an upload that is exactly at the limit.
MULTIPART_OVERHEAD_BYTES = 64 * 1024


class TranscriptionResponse(BaseModel):
    text: str


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


def create_app(settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    """Build the app. `settings` and `transport` exist so tests can inject a fake provider."""
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.http = httpx.AsyncClient(transport=transport)
        yield
        await app.state.http.aclose()

    app = FastAPI(
        title="HackPrinceton 2026",
        description="Speech recognition and contextual NPC dialogue for the Olympus adventure.",
        lifespan=lifespan,
    )
    app.state.settings = settings

    @app.exception_handler(ServiceError)
    async def service_error_handler(_: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(Exception)
    async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
        # Only the exception type is logged: messages and tracebacks could carry player text.
        logger.error("unexpected error: %s", type(exc).__name__)
        return JSONResponse({"detail": "Internal server error."}, status_code=500)

    # Reject an oversized upload from its Content-Length before the body is read.
    @app.middleware("http")
    async def limit_upload_size(request: Request, call_next):
        if request.method == "POST" and request.url.path == "/transcribe":
            length = request.headers.get("content-length", "")
            if length.isdigit() and int(length) > settings.max_audio_bytes + MULTIPART_OVERHEAD_BYTES:
                mb = settings.max_audio_bytes // (1024 * 1024)
                return JSONResponse({"detail": f"The recording is larger than the {mb} MB limit."}, status_code=413)
        return await call_next(request)

    # Added after the size check so CORS headers are also set on its early responses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post(
        "/transcribe",
        response_model=TranscriptionResponse,
        summary="Transcribe a recording",
        responses={
            400: {"description": "Empty or too-short recording."},
            413: {"description": "Recording larger than the size limit."},
            415: {"description": f"Not a supported audio format ({SUPPORTED_FORMATS_TEXT})."},
            502: {"description": "The speech provider failed or sent a bad response."},
            503: {"description": "Speech recognition is not configured, or the provider is busy."},
            504: {"description": "The speech provider timed out."},
        },
    )
    async def transcribe_endpoint(
        audio: Annotated[UploadFile, File(description="Browser MediaRecorder audio (multipart field 'audio').")],
        settings: Annotated[Settings, Depends(get_settings)],
        client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
    ) -> TranscriptionResponse:
        try:
            data = await audio.read(settings.max_audio_bytes + 1)
        finally:
            await audio.close()  # the upload is never kept
        audio_format = validate_audio(data, audio.content_type, settings.max_audio_bytes)
        text = await transcribe(data, audio_format, settings, client)
        return TranscriptionResponse(text=text)

    @app.post(
        "/npc/dialogue",
        response_model=NpcDialogueResponse,
        summary="Get an NPC's reply",
        responses={
            422: {"description": "Invalid request, an unknown npcId, or an object that is not a character."},
            502: {"description": "The language-model provider failed, or its reply broke the story rules."},
            503: {"description": "NPC conversation is not configured, or the provider is busy."},
            504: {"description": "The language-model provider timed out."},
        },
    )
    async def npc_dialogue_endpoint(
        body: NpcDialogueRequest,
        settings: Annotated[Settings, Depends(get_settings)],
        client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
    ) -> NpcDialogueResponse:
        reply = await generate_reply(body, settings, client)
        return NpcDialogueResponse(npcResponse=reply, proposedAction=None)

    @app.post(
        "/speaking/feedback",
        response_model=SpeakingFeedback,
        summary="Feedback on a confirmed spoken reply",
        description=(
            "Transcript-based communication feedback for the Speaking Companion: one positive observation and one "
            "suggestion, shaped by the player's goals. Never judges pronunciation, accent or fluency, never scores. "
            "Nothing is stored and game state is never touched."
        ),
        responses={
            422: {"description": "Empty transcript, unknown goal, or no text-based goal (pacing alone is measured in the browser)."},
            502: {"description": "The provider failed, or its feedback broke the rules twice."},
            503: {"description": "Speaking feedback is not configured, or the provider is busy."},
            504: {"description": "The provider timed out."},
        },
    )
    async def speaking_feedback_endpoint(
        body: SpeakingFeedbackRequest,
        settings: Annotated[Settings, Depends(get_settings)],
        client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
    ) -> SpeakingFeedback:
        return await generate_feedback(body, settings, client)

    return app


if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # its INFO lines would list every provider URL

app = create_app()
