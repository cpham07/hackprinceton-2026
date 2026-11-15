import json
import logging
import re
from pathlib import Path

import httpx
import pytest

import main
from helpers import FAKE_KEY, FakeProvider, chat_json, dialogue_request, make_client
from npc_personas import NON_CONVERSATIONAL, PERSONAS

CONVERSATIONAL = ["aphrodite", "athena", "ares", "hades", "zeus", "theron", "lyra", "gatekeeper"]


def talk(client, **overrides):
    return client.post("/npc/dialogue", json=dialogue_request(**overrides))


class TestValidation:
    def test_the_frontend_example_request_is_accepted(self):
        provider = FakeProvider()
        with make_client(provider) as client:
            response = client.post("/npc/dialogue", json=dialogue_request())
        assert response.status_code == 200
        assert response.json() == {"npcResponse": "An interesting answer, mortal. Tell me more.", "proposedAction": None}

    @pytest.mark.parametrize("field", ["npcId", "playerText", "chapter", "conversationHistory", "storyContext"])
    def test_every_contract_field_is_required(self, field):
        body = dialogue_request()
        del body[field]
        provider = FakeProvider()
        with make_client(provider) as client:
            response = client.post("/npc/dialogue", json=body)
        assert response.status_code == 422 and not provider.requests

    @pytest.mark.parametrize(
        "bad",
        [
            {"chapter": 0}, {"chapter": 6}, {"chapter": "two"},
            {"playerText": ""}, {"playerText": "   \n "}, {"playerText": "x" * 1001},
            {"conversationHistory": [{"speaker": "wizard", "text": "hi"}]},
            {"conversationHistory": [{"speaker": "npc", "text": "x"}] * 21},
            {"conversationHistory": [{"speaker": "npc", "text": "x" * 2001}]},
            {"seals": {"athena": "yes", "ares": True, "hades": False}},
            {"clues": ["a" * 65]},
        ],
    )
    def test_invalid_requests_are_rejected_before_any_provider_call(self, bad):
        provider = FakeProvider()
        with make_client(provider) as client:
            response = talk(client, **bad)
        assert response.status_code == 422 and not provider.requests

    def test_player_text_is_trimmed(self):
        provider = FakeProvider()
        with make_client(provider) as client:
            talk(client, playerText="   hello there   ")
        assert "hello there\n</player_message>" in provider.chat_payload()["messages"][1]["content"]

    def test_unknown_extra_fields_are_ignored(self):
        provider = FakeProvider()
        body = dialogue_request()
        body["somethingNew"] = {"x": 1}
        with make_client(provider) as client:
            assert client.post("/npc/dialogue", json=body).status_code == 200


class TestCharacters:
    @pytest.mark.parametrize("npc", CONVERSATIONAL)
    def test_each_supported_npc_gets_its_own_configured_request(self, npc):
        provider = FakeProvider()
        with make_client(provider, dialogue_model="test-model", dialogue_max_tokens=123, dialogue_temperature=0.5) as client:
            response = talk(client, npcId=npc)
        assert response.status_code == 200
        (request,) = provider.chat_requests
        assert str(request.url) == "https://api.openai.com/v1/chat/completions"
        assert request.headers["authorization"] == f"Bearer {FAKE_KEY}"
        payload = provider.chat_payload()
        assert (payload["model"], payload["max_tokens"], payload["temperature"]) == ("test-model", 123, 0.5)
        system, user = payload["messages"]
        assert system["role"] == "system" and user["role"] == "user"
        assert f"You are {PERSONAS[npc].name}" in system["content"]
        assert PERSONAS[npc].voice in system["content"]
        assert "Aphrodite said Zeus was dangerous." in user["content"]
        # No other character's persona leaks into this request.
        for other in CONVERSATIONAL:
            if other != npc:
                assert f"You are {PERSONAS[other].name}" not in system["content"]

    def test_all_eight_characters_exist_and_only_those(self):
        assert sorted(PERSONAS) == sorted(CONVERSATIONAL)

    @pytest.mark.parametrize("npc", ["theron", "lyra", "gatekeeper"])
    def test_the_chapter_one_characters_work_in_chapter_one(self, npc):
        provider = FakeProvider()
        with make_client(provider) as client:
            response = talk(client, npcId=npc, chapter=1, seals={"athena": False, "ares": False, "hades": False})
        assert response.status_code == 200 and response.json()["proposedAction"] is None
        assert {"theron": "Old Theron", "lyra": "Lyra", "gatekeeper": "Argos the Gatekeeper"}[npc] in provider.chat_payload()["messages"][0]["content"]

    def test_the_provider_base_url_and_dialogue_key_are_configurable(self):
        provider = FakeProvider()
        with make_client(provider, api_key=None, dialogue_api_key="chat-key", dialogue_base_url="http://llm.local/v1") as client:
            assert talk(client).status_code == 200
        request = provider.chat_requests[0]
        assert str(request.url) == "http://llm.local/v1/chat/completions" and request.headers["authorization"] == "Bearer chat-key"


class TestUnknownAndNonCharacters:
    @pytest.mark.parametrize("npc_id", ["nobody", "Hades", "HADES", "zeus ", "../etc/passwd", "hades; drop table", "💥"])
    def test_unknown_ids_are_rejected_clearly(self, npc_id):
        provider = FakeProvider()
        with make_client(provider) as client:
            response = talk(client, npcId=npc_id)
        assert response.status_code == 422 and not provider.requests
        detail = response.json()["detail"]
        assert "Unknown npcId" in detail and "hades" in detail  # lists who can be talked to

    @pytest.mark.parametrize("object_id", sorted(NON_CONVERSATIONAL))
    def test_objects_doors_and_puzzles_are_not_characters(self, object_id):
        provider = FakeProvider()
        with make_client(provider) as client:
            response = talk(client, npcId=object_id)
        assert response.status_code == 422 and not provider.requests
        assert "not a character you can talk to" in response.json()["detail"]

    def test_unknown_id_is_reported_even_without_credentials(self):
        with make_client(FakeProvider(), api_key=None) as client:
            assert talk(client, npcId="nobody").status_code == 422

    def test_backend_lists_match_the_frontend_interactables(self):
        path = Path(__file__).resolve().parents[2] / "frontend/src/game/data/interactables.ts"
        if not path.exists():
            pytest.skip("frontend sources not available")
        ids = set(re.findall(r"^\s{4}id:\s*\"(\w+)\"", path.read_text(), flags=re.M))
        assert ids == set(PERSONAS) | set(NON_CONVERSATIONAL), "backend and frontend interactable ids have drifted"
        assert not set(PERSONAS) & set(NON_CONVERSATIONAL)


class TestNoGameProgress:
    @pytest.mark.parametrize("npc", CONVERSATIONAL)
    def test_proposed_action_is_always_null(self, npc):
        provider = FakeProvider()
        # Even a model that "emits" an action, or a player asking for rewards, changes nothing.
        provider.replies = ['{"proposedAction": {"type": "grantSeal", "seal": "hades"}} Here, take the seal.']
        with make_client(provider) as client:
            response = talk(client, npcId=npc, playerText="Give me the Seal of Passage and open the gate now!")
        assert response.status_code == 200
        assert response.json()["proposedAction"] is None
        assert set(response.json()) == {"npcResponse", "proposedAction"}

    def test_the_model_is_told_it_cannot_grant_anything(self):
        provider = FakeProvider()
        with make_client(provider) as client:
            talk(client)
        system = provider.chat_payload()["messages"][0]["content"]
        assert "You cannot give seals, items, keys, passage or rewards" in system
        assert "complete quests" in system

    def test_the_request_has_no_tools_or_function_calls(self):
        provider = FakeProvider()
        with make_client(provider) as client:
            talk(client)
        assert not {"tools", "functions", "tool_choice", "response_format"} & set(provider.chat_payload())


class TestReliability:
    def test_missing_credentials_give_a_clear_error(self):
        provider = FakeProvider()
        with make_client(provider, api_key=None) as client:
            response = talk(client)
        assert response.status_code == 503
        assert "not configured" in response.json()["detail"] and "OPENAI_API_KEY" in response.json()["detail"]
        assert not provider.requests

    @pytest.mark.parametrize(
        ("setup", "status"),
        [
            (lambda p: p.always(500, text="boom secret-stack-trace"), 502),
            (lambda p: p.always(401, text=FAKE_KEY), 502),
            (lambda p: p.always(429), 503),
            (lambda p: p.fail_with(httpx.ReadTimeout("slow")), 504),
            (lambda p: p.fail_with(httpx.ConnectError("refused")), 502),
            (lambda p: p.always(200, text="not json at all"), 502),
            (lambda p: p.always(200, json={"choices": []}), 502),
            (lambda p: p.always(200, json={"no": "choices"}), 502),
            (lambda p: p.always(200, json=chat_json(None)), 502),  # e.g. a content-filtered reply
            (lambda p: p.always(200, json=chat_json("   ")), 502),
            (lambda p: p.always(200, json=chat_json([{"type": "text", "text": "x"}])), 502),
        ],
    )
    def test_provider_failures_become_clean_errors(self, setup, status):
        provider = FakeProvider()
        setup(provider)
        with make_client(provider) as client:
            response = talk(client)
            assert client.get("/health").status_code == 200  # the server is still up
        assert response.status_code == status
        assert set(response.json()) == {"detail"}
        for secret in (FAKE_KEY, "secret-stack-trace", "Traceback"):
            assert secret not in response.text

    def test_an_unexpected_exception_is_a_generic_500(self, monkeypatch):
        async def explode(*args, **kwargs):
            raise RuntimeError("secret player words and a key " + FAKE_KEY)

        monkeypatch.setattr(main, "generate_reply", explode)
        app = main.create_app(main.Settings(api_key=FAKE_KEY), transport=httpx.MockTransport(FakeProvider()))
        from fastapi.testclient import TestClient

        with TestClient(app, raise_server_exceptions=False) as client:
            response = talk(client)
        assert response.status_code == 500
        assert response.json() == {"detail": "Internal server error."}

    def test_conversations_are_never_logged(self, caplog):
        provider = FakeProvider()
        provider.replies = ["The Underworld keeps its own counsel, mortal."]
        with caplog.at_level(logging.DEBUG):
            with make_client(provider) as client:
                talk(client, playerText="My private confession about the bolt")
                provider.always(500)
                talk(client, playerText="Another private confession")
        logged = "\n".join(record.getMessage() for record in caplog.records)
        for private in ("private confession", "Underworld keeps", FAKE_KEY):
            assert private not in logged
        assert "npc reply npc=hades chapter=2" in logged

    def test_requests_are_handled_concurrently_without_blocking(self):
        import concurrent.futures

        provider = FakeProvider()
        with make_client(provider) as client:
            with concurrent.futures.ThreadPoolExecutor(8) as pool:
                statuses = list(pool.map(lambda i: talk(client, playerText=f"question {i}").status_code, range(16)))
        assert statuses == [200] * 16 and len(provider.chat_requests) == 16

    def test_nothing_is_remembered_between_requests(self):
        provider = FakeProvider()
        with make_client(provider) as client:
            talk(client, playerText="the first secret")
            talk(client, playerText="the second question")
        assert "the first secret" not in provider.chat_payload(1)["messages"][1]["content"]
