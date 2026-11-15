"""Provider error diagnostics: sanitized, never shown to API clients, never logged in full. No network."""

import asyncio
import json
import logging

import httpx
import pytest

from config import Settings
from errors import ServiceError
from helpers import FAKE_KEY, MP4, FakeProvider, audio_upload, make_client
from provider import post_json_to_provider, provider_error_fields
from speech import MP4 as MP4_FORMAT, transcribe

OPENAI_400 = {
    "error": {
        "message": "Invalid file format. Supported formats: ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm']",
        "type": "invalid_request_error",
        "param": None,
        "code": None,
    }
}


def call(response: httpx.Response) -> ServiceError:
    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: response)) as client:
            await post_json_to_provider(client, "https://provider.test/v1/x", api_key=FAKE_KEY, timeout_s=5, service="test")

    with pytest.raises(ServiceError) as info:
        asyncio.run(go())
    return info.value


def test_openai_error_body_becomes_a_sanitized_diagnostic():
    error = call(httpx.Response(400, json=OPENAI_400))
    assert error.status_code == 502
    assert error.detail == "The test provider returned an error (400)."  # client-facing text unchanged
    assert error.diagnostic.startswith("type=invalid_request_error; Invalid file format.")


def test_identifiers_are_kept_only_when_they_are_plain_tokens():
    fields = provider_error_fields(httpx.Response(400, json={"error": {"type": "bad type!\n", "code": "x" * 65, "param": "file"}}))
    assert fields == {"param": "file"}


def test_keys_and_tokens_in_the_message_are_redacted():
    body = {"error": {"message": f"Incorrect API key provided: {FAKE_KEY}. Header Bearer abc.def", "code": "invalid_api_key"}}
    error = call(httpx.Response(401, json=body))
    assert FAKE_KEY not in error.diagnostic and "abc.def" not in error.diagnostic
    assert "[redacted]" in error.diagnostic and "code=invalid_api_key" in error.diagnostic


def test_long_messages_are_truncated():
    error = call(httpx.Response(400, json={"error": {"message": "word " * 200}}))
    assert len(error.diagnostic) <= 201


@pytest.mark.parametrize("response", [
    httpx.Response(400, text="<html>bad gateway</html>"),
    httpx.Response(400, json=["not", "an", "object"]),
    httpx.Response(400, json={"error": "a string"}),
])
def test_unexpected_error_bodies_give_no_diagnostic(response):
    assert call(response).diagnostic is None


def test_transcribe_endpoint_does_not_expose_the_diagnostic(caplog):
    provider = FakeProvider()
    provider.always(400, json=OPENAI_400)
    with caplog.at_level(logging.DEBUG), make_client(provider) as client:
        response = client.post("/transcribe", files=audio_upload(MP4, "audio/mp4", filename="clip.m4a"))
    assert response.status_code == 502
    assert "Invalid file format" not in response.text
    logged = "\n".join(record.getMessage() for record in caplog.records)
    assert "type=invalid_request_error" in logged  # identifiers are logged
    assert "Invalid file format" not in logged  # the message is not
    assert FAKE_KEY not in logged


def test_transcribe_raises_with_the_diagnostic_for_offline_tools():
    async def go():
        transport = httpx.MockTransport(lambda r: httpx.Response(400, json=OPENAI_400))
        async with httpx.AsyncClient(transport=transport) as client:
            await transcribe(MP4, MP4_FORMAT, Settings(api_key=FAKE_KEY), client)

    with pytest.raises(ServiceError) as info:
        asyncio.run(go())
    assert "Invalid file format" in info.value.diagnostic
    assert json.dumps({"detail": info.value.detail}).find("Invalid file format") == -1
