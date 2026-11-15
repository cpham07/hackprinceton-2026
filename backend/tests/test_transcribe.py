import logging

import httpx
import pytest

from config import MYTHOLOGY_TRANSCRIPTION_PROMPT, Settings
from helpers import FAKE_KEY, M4A, MP3, MP4, OGG, WAV, WEBM, FakeProvider, audio_upload, make_client


def post(client, **kwargs):
    return client.post("/transcribe", files=audio_upload(**kwargs))


def test_accepts_the_audio_field_and_returns_text():
    provider = FakeProvider()
    provider.transcript = "  I came here to speak with you.  "
    with make_client(provider) as client:
        response = post(client)
    assert response.status_code == 200
    assert response.json() == {"text": "I came here to speak with you."}


def test_sends_a_correct_request_to_the_provider():
    provider = FakeProvider()
    with make_client(provider) as client:
        post(client)
    (request,) = provider.transcription_requests
    body = request.content
    assert str(request.url) == "https://api.openai.com/v1/audio/transcriptions"
    assert request.headers["authorization"] == f"Bearer {FAKE_KEY}"
    assert b'name="model"\r\n\r\nwhisper-1' in body
    assert b'name="language"\r\n\r\nen' in body and b'name="response_format"\r\n\r\njson' in body
    assert b'name="prompt"\r\n\r\n' + MYTHOLOGY_TRANSCRIPTION_PROMPT.encode() in body  # on by default
    assert b'name="file"; filename="recording.webm"' in body and b"Content-Type: audio/webm" in body


def test_whole_recording_is_sent_untouched():
    provider = FakeProvider()
    payload = WEBM + bytes(range(256)) * 8000  # ~2 MB: nothing is trimmed at pauses or anywhere else
    with make_client(provider) as client:
        assert post(client, data=payload).status_code == 200
    assert payload in provider.transcription_requests[0].content


@pytest.mark.parametrize(
    ("data", "declared", "expected_name", "expected_type"),
    [
        (WEBM, "audio/webm;codecs=opus", "recording.webm", "audio/webm"),
        (OGG, "audio/ogg", "recording.ogg", "audio/ogg"),
        (MP4, "audio/mp4", "recording.mp4", "audio/mp4"),
        (M4A, "audio/x-m4a", "recording.m4a", "audio/mp4"),
        (M4A, "audio/mp4", "recording.m4a", "audio/mp4"),
        (MP3, "audio/mpeg", "recording.mp3", "audio/mpeg"),
        (WAV, "audio/wav", "recording.wav", "audio/wav"),
        (WEBM, "application/octet-stream", "recording.webm", "audio/webm"),
    ],
)
def test_supported_browser_formats(data, declared, expected_name, expected_type):
    provider = FakeProvider()
    with make_client(provider) as client:
        response = post(client, data=data, content_type=declared, filename="whatever.bin")
    assert response.status_code == 200
    body = provider.transcription_requests[0].content
    # The provider is told the sniffed format, not the filename or type the browser claimed.
    assert f'filename="{expected_name}"'.encode() in body and f"Content-Type: {expected_type}".encode() in body


def test_wrong_field_name_is_rejected():
    provider = FakeProvider()
    with make_client(provider) as client:
        response = client.post("/transcribe", files=audio_upload(field="file"))
    assert response.status_code == 422 and not provider.requests


@pytest.mark.parametrize(
    ("data", "declared"),
    [
        (b"just some text, definitely not audio" * 10, "audio/webm"),  # claims audio, is not
        (WEBM, "text/plain"),  # real audio, unsupported declared type
        (WEBM, "image/png"),
        (b"\x89PNG\r\n\x1a\n" + b"\x00" * 400, "audio/webm"),
    ],
)
def test_unsupported_media_is_rejected(data, declared):
    provider = FakeProvider()
    with make_client(provider) as client:
        response = post(client, data=data, content_type=declared)
    assert response.status_code == 415 and not provider.requests
    assert "WebM" in response.json()["detail"]


def test_empty_recording_is_rejected():
    provider = FakeProvider()
    with make_client(provider) as client:
        response = post(client, data=b"")
    assert response.status_code == 400 and "empty" in response.json()["detail"] and not provider.requests


def test_tiny_recording_is_rejected():
    provider = FakeProvider()
    with make_client(provider) as client:
        response = post(client, data=WEBM[:20])
    assert response.status_code == 400 and not provider.requests


def test_oversized_recording_is_rejected_without_calling_the_provider():
    provider = FakeProvider()
    with make_client(provider, max_audio_bytes=2048) as client:
        slightly_over = post(client, data=WEBM + b"\x00" * 2000)
        far_over = post(client, data=WEBM + b"\x00" * 200_000)  # rejected from Content-Length before it is read
    assert slightly_over.status_code == 413 and far_over.status_code == 413
    assert not provider.requests


def test_a_recording_exactly_at_the_limit_is_accepted():
    provider = FakeProvider()
    with make_client(provider, max_audio_bytes=2048) as client:
        assert post(client, data=WEBM + b"\x00" * (2048 - len(WEBM))).status_code == 200


def test_silence_returns_an_empty_string_not_made_up_text():
    provider = FakeProvider()
    provider.transcript = ""
    with make_client(provider) as client:
        response = post(client)
    assert response.status_code == 200 and response.json() == {"text": ""}


def test_missing_credentials_give_a_clear_error():
    provider = FakeProvider()
    with make_client(provider, api_key=None) as client:
        response = post(client)
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"] and "OPENAI_API_KEY" in response.json()["detail"]
    assert not provider.requests


def test_transcription_uses_its_own_key_and_model_when_configured():
    provider = FakeProvider()
    with make_client(provider, api_key=None, transcription_api_key="asr-key", transcription_base_url="http://asr.local/v1", transcription_model="tiny") as client:
        assert post(client).status_code == 200
    request = provider.transcription_requests[0]
    assert str(request.url) == "http://asr.local/v1/audio/transcriptions"
    assert request.headers["authorization"] == "Bearer asr-key" and b"tiny" in request.content


def test_optional_prompt_and_language_are_forwarded_only_when_configured():
    provider = FakeProvider()
    with make_client(provider, transcription_prompt="Zeus, Hades", transcription_language=None) as client:
        post(client)
    body = provider.transcription_requests[0].content
    assert b'name="prompt"\r\n\r\nZeus, Hades' in body and b'name="language"' not in body


VALIDATED_PROMPT = "Aphrodite, Athena, Ares, Hades, Zeus, Olympus, Argos, Theron, Lyra, Somnus, Master Lightning Bolt."


class TestMythologyVocabulary:
    """The validated vocabulary hint reaches whisper-1 server-side; disabling it restores plain transcription."""

    def test_the_configured_prompt_is_the_validated_one(self):
        assert MYTHOLOGY_TRANSCRIPTION_PROMPT == VALIDATED_PROMPT
        assert Settings.from_env({}).transcription_prompt == VALIDATED_PROMPT

    @pytest.mark.parametrize(("data", "declared", "name", "mime"), [
        (WEBM, "audio/webm;codecs=opus", "recording.webm", "audio/webm"),
        (OGG, "audio/ogg", "recording.ogg", "audio/ogg"),
        (MP3, "audio/mpeg", "recording.mp3", "audio/mpeg"),
        (WAV, "audio/wav", "recording.wav", "audio/wav"),
    ])
    def test_enabled_request_carries_prompt_audio_and_mime(self, data, declared, name, mime):
        provider = FakeProvider()
        settings = Settings.from_env({"OPENAI_API_KEY": FAKE_KEY})
        with make_client(provider, **{"transcription_prompt": settings.transcription_prompt}) as client:
            response = post(client, data=data, content_type=declared)
        assert response.status_code == 200 and response.json() == {"text": "I came here to speak with you."}
        body = provider.transcription_requests[0].content
        assert b'name="prompt"\r\n\r\n' + VALIDATED_PROMPT.encode() + b"\r\n" in body
        assert b'name="model"\r\n\r\nwhisper-1' in body
        assert f'filename="{name}"'.encode() in body and f"Content-Type: {mime}".encode() in body
        assert data in body

    @pytest.mark.parametrize("value", ["false", "0", "off", "no"])
    def test_disabled_omits_the_prompt(self, value):
        settings = Settings.from_env({"OPENAI_API_KEY": FAKE_KEY, "TRANSCRIPTION_VOCABULARY_HINTS": value})
        assert settings.transcription_prompt is None
        provider = FakeProvider()
        with make_client(provider, transcription_prompt=settings.transcription_prompt) as client:
            response = post(client)
        assert response.json() == {"text": "I came here to speak with you."}
        body = provider.transcription_requests[0].content
        assert b'name="prompt"' not in body and WEBM in body and b"Content-Type: audio/webm" in body

    def test_disabled_wins_over_a_custom_prompt(self):
        env = {"TRANSCRIPTION_VOCABULARY_HINTS": "false", "TRANSCRIPTION_PROMPT": "Zeus"}
        assert Settings.from_env(env).transcription_prompt is None

    def test_custom_prompt_replaces_the_default(self):
        assert Settings.from_env({"TRANSCRIPTION_PROMPT": "Zeus, Hades"}).transcription_prompt == "Zeus, Hades"

    def test_unusable_flag_fails_loudly(self):
        from config import ConfigError
        with pytest.raises(ConfigError):
            Settings.from_env({"TRANSCRIPTION_VOCABULARY_HINTS": "maybe"})

    @pytest.mark.parametrize("echo", [
        VALIDATED_PROMPT,
        VALIDATED_PROMPT.rstrip("."),
        "  aphrodite athena ares hades zeus olympus argos theron lyra somnus master lightning bolt  ",
        "Aphrodite. Athena. Ares. Hades. Zeus. Olympus. Argos. Theron. Lyra. Somnus. Master lightning-bolt!",
        f"{VALIDATED_PROMPT} {VALIDATED_PROMPT}",  # repeated back to back
    ])
    def test_a_full_prompt_echo_is_returned_as_silence(self, echo):
        provider = FakeProvider()
        provider.transcript = echo
        with make_client(provider) as client:
            assert post(client).json() == {"text": ""}

    @pytest.mark.parametrize("names", [
        # Leading runs of the prompt: the old prefix rule discarded these as silence.
        "Aphrodite, Athena, Ares",
        "Aphrodite, Athena, Ares, Hades.",
        "aphrodite athena ares hades zeus",
        "Aphrodite, Athena, Ares, Hades, Zeus, Olympus, Argos, Theron, Lyra, Somnus, Master Lightning",
        # Other short sequences of names, in and out of the prompt's order.
        "Aphrodite, Athena",
        "Hades, Zeus, Athena",
        "Zeus, Olympus, Argos",
        "Master Lightning Bolt",
        "Athena, Ares, Aphrodite",
    ])
    def test_short_sequences_of_mythology_names_are_kept(self, names):
        provider = FakeProvider()
        provider.transcript = names
        with make_client(provider) as client:
            assert post(client).json() == {"text": names}

    @pytest.mark.parametrize("speech", [
        "Zeus",
        "Athena sent me.",
        "I seek the Master Lightning Bolt.",
        "Aphrodite, Athena, Ares and Hades all helped me.",
        "Please give the bolt back to Zeus.",
        "I came here to speak with you.",
        # The whole prompt plus anything else is something the player said, not a bare echo.
        f"I know them all: {VALIDATED_PROMPT}",
        f"{VALIDATED_PROMPT} That is everyone I met.",
    ])
    def test_normal_sentences_are_kept(self, speech):
        provider = FakeProvider()
        provider.transcript = speech
        with make_client(provider) as client:
            assert post(client).json() == {"text": speech}

    def test_echo_detection_follows_a_custom_prompt(self):
        provider = FakeProvider()
        provider.transcript = "Zeus, Hades."
        with make_client(provider, transcription_prompt="Zeus, Hades") as client:
            assert post(client).json() == {"text": ""}
        provider.transcript = "Zeus"
        with make_client(provider, transcription_prompt="Zeus, Hades") as client:
            assert post(client).json() == {"text": "Zeus"}

    def test_nothing_is_discarded_when_prompting_is_off(self):
        provider = FakeProvider()
        provider.transcript = VALIDATED_PROMPT
        with make_client(provider, transcription_prompt=None) as client:
            assert post(client).json() == {"text": VALIDATED_PROMPT}

    def test_response_shape_is_unchanged(self):
        provider = FakeProvider()
        with make_client(provider) as client:
            assert set(post(client).json()) == {"text"}

    def test_failures_stay_sanitized_with_the_prompt_enabled(self):
        provider = FakeProvider()
        provider.always(500, text=f"boom {VALIDATED_PROMPT} {FAKE_KEY}")
        with make_client(provider) as client:
            response = post(client)
        assert response.status_code == 502 and set(response.json()) == {"detail"}
        assert FAKE_KEY not in response.text and "boom" not in response.text


class TestProviderFailures:
    """Every failure is an error status with a generic message; nothing is faked, nothing is leaked."""

    @pytest.mark.parametrize(
        ("setup", "status"),
        [
            (lambda p: p.always(500, text="upstream exploded: secret-stack-trace"), 502),
            (lambda p: p.always(401, text=f"bad key {FAKE_KEY}"), 502),
            (lambda p: p.always(403, text="forbidden"), 502),
            (lambda p: p.always(404, text="no such model"), 502),
            (lambda p: p.always(429, text="slow down"), 503),
            (lambda p: p.fail_with(httpx.ReadTimeout("took forever")), 504),
            (lambda p: p.fail_with(httpx.ConnectError("refused")), 502),
            (lambda p: p.always(200, text="<html>not json</html>"), 502),
            (lambda p: p.always(200, json=["not", "an", "object"]), 502),
            (lambda p: p.always(200, json={"unexpected": "shape"}), 502),
            (lambda p: p.always(200, json={"text": 12345}), 502),
        ],
    )
    def test_failure_mapping(self, setup, status):
        provider = FakeProvider()
        setup(provider)
        with make_client(provider) as client:
            response = post(client)
        assert response.status_code == status
        payload = response.json()
        assert set(payload) == {"detail"} and "text" not in payload
        for secret in (FAKE_KEY, "secret-stack-trace", "upstream exploded", "no such model", "Traceback"):
            assert secret not in response.text

    def test_rate_limit_asks_the_client_to_retry(self):
        provider = FakeProvider()
        provider.always(429)
        with make_client(provider) as client:
            assert post(client).headers["retry-after"] == "5"

    def test_the_server_keeps_working_after_a_failure(self):
        provider = FakeProvider()
        with make_client(provider) as client:
            provider.always(500)
            assert post(client).status_code == 502
            provider.override = None
            assert post(client).status_code == 200


def test_transcripts_and_audio_are_never_logged(caplog):
    provider = FakeProvider()
    provider.transcript = "My secret sentence about the lightning bolt"
    with caplog.at_level(logging.DEBUG):
        with make_client(provider) as client:
            assert post(client).status_code == 200
            provider.always(500, text="provider body with My secret sentence")
            post(client)
    logged = "\n".join(record.getMessage() for record in caplog.records)
    assert "secret sentence" not in logged and FAKE_KEY not in logged
    assert "transcribed format=webm" in logged  # metadata is logged
