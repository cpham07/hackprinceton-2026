import pytest

from config import ConfigError, Settings, load_env_file
from helpers import FAKE_KEY, FakeProvider, make_client


def test_health_still_works():
    with make_client(FakeProvider()) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_docs_and_schema_are_served():
    with make_client(FakeProvider()) as client:
        assert client.get("/docs").status_code == 200
        schema = client.get("/openapi.json").json()
    assert {"/health", "/transcribe", "/npc/dialogue"} <= set(schema["paths"])
    request = schema["components"]["schemas"]["NpcDialogueRequest"]
    assert set(request["required"]) == {"npcId", "playerText", "chapter", "conversationHistory", "storyContext"}
    response = schema["components"]["schemas"]["NpcDialogueResponse"]
    assert set(response["properties"]) == {"npcResponse", "proposedAction"}


def test_cors_allows_the_vite_dev_server_and_nothing_else_by_default():
    with make_client(FakeProvider()) as client:
        ok = client.options("/npc/dialogue", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        other = client.options("/npc/dialogue", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in other.headers


def test_cors_origins_are_configurable():
    with make_client(FakeProvider(), cors_origins=("http://localhost:5199",)) as client:
        response = client.options("/transcribe", headers={"Origin": "http://localhost:5199", "Access-Control-Request-Method": "POST"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5199"


class TestSettings:
    def test_defaults_need_no_environment(self):
        s = Settings.from_env({})
        assert s.api_key is None and s.transcription_model == "whisper-1" and s.dialogue_model == "gpt-4o-mini"
        assert s.base_url == "https://api.openai.com/v1" and s.cors_origins == ("http://localhost:5173",)
        assert s.transcription_language == "en" and s.transcription_prompt is None

    def test_environment_overrides(self):
        s = Settings.from_env({
            "OPENAI_API_KEY": "k", "OPENAI_BASE_URL": "http://localhost:9/v1", "TRANSCRIPTION_MODEL": "m1",
            "NPC_DIALOGUE_MODEL": "m2", "MAX_AUDIO_BYTES": "2048", "NPC_DIALOGUE_TEMPERATURE": "0.3",
            "CORS_ORIGINS": "http://a, http://b",
        })
        assert (s.api_key, s.base_url, s.transcription_model, s.dialogue_model) == ("k", "http://localhost:9/v1", "m1", "m2")
        assert s.max_audio_bytes == 2048 and s.dialogue_temperature == 0.3 and s.cors_origins == ("http://a", "http://b")

    def test_blank_values_count_as_unset(self):
        s = Settings.from_env({"OPENAI_API_KEY": "  ", "NPC_DIALOGUE_MODEL": ""})
        assert s.api_key is None and s.dialogue_model == "gpt-4o-mini"

    def test_blank_language_means_auto_detect(self):
        assert Settings.from_env({"TRANSCRIPTION_LANGUAGE": ""}).transcription_language is None

    def test_per_service_overrides(self):
        s = Settings.from_env({"OPENAI_API_KEY": "main", "TRANSCRIPTION_API_KEY": "asr", "TRANSCRIPTION_BASE_URL": "http://asr/v1"})
        assert s.transcription_credentials == ("asr", "http://asr/v1")
        assert s.dialogue_credentials == ("main", "https://api.openai.com/v1")

    @pytest.mark.parametrize("env", [{"MAX_AUDIO_BYTES": "lots"}, {"MAX_AUDIO_BYTES": "5"}, {"NPC_DIALOGUE_TEMPERATURE": "-1"}])
    def test_unusable_numbers_fail_loudly(self, env):
        with pytest.raises(ConfigError):
            Settings.from_env(env)

    def test_secrets_are_not_in_repr(self):
        text = repr(Settings(api_key=FAKE_KEY, transcription_api_key=FAKE_KEY, dialogue_api_key=FAKE_KEY))
        assert FAKE_KEY not in text


def test_env_file_loader_never_overrides_real_environment(tmp_path):
    path = tmp_path / ".env"
    path.write_text("# comment\nOPENAI_API_KEY=from-file\nNPC_DIALOGUE_MODEL='quoted-model'\nTRANSCRIPTION_MODEL=m # trailing\nBAD LINE\n")
    environ = {"OPENAI_API_KEY": "from-environment"}
    load_env_file(path, environ)
    assert environ["OPENAI_API_KEY"] == "from-environment"
    assert environ["NPC_DIALOGUE_MODEL"] == "quoted-model" and environ["TRANSCRIPTION_MODEL"] == "m"


def test_env_example_contains_no_credentials():
    from pathlib import Path

    text = (Path(__file__).parent.parent / ".env.example").read_text()
    assert "OPENAI_API_KEY=\n" in text
    assert "sk-" not in text
