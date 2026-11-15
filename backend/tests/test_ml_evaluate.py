"""The benchmark runner, reports and CLI, against the mocked provider from helpers.py.

These are MOCK runs: they test the plumbing and scoring, not any real speech model. No network, no paid calls.
"""

import asyncio
import json
import logging

import httpx
import pytest

from config import Settings
from helpers import FAKE_KEY, WEBM, FakeProvider
from ml import benchmark
from ml.asr import Mode, ProviderTranscriber, model_supports_prompt
from ml.dataset import load_manifest
from ml.evaluate import MOCK_WARNING, Measurement, build_report, render_markdown, run_benchmark, summarize
from ml.vocabulary import hint_prompt

REFERENCES = {
    "u1": "Somnus, let the heavens dream.",
    "u2": "Aphrodite said Zeus was dangerous.",
    "u3": "",  # silence clip
}
# What the fake model "hears" in each mode: hints fix names, but cause an echo on silence.
BASELINE_OUT = {"u1": "Somnas let the heavens dream", "u2": "Afrodite said Zeus was dangerous", "u3": ""}
HINTS_OUT = {"u1": "Somnus, let the heavens dream.", "u2": "Aphrodite said Zeus was dangerous.", "u3": "Zeus, Hades."}


def audio_for(uid: str) -> bytes:
    return WEBM + uid.encode() * 50


def make_dataset(tmp_path, ids=("u1", "u2", "u3"), missing=(), invalid=()):
    (tmp_path / "audio").mkdir(exist_ok=True)
    lines = []
    for uid in ids:
        if uid not in missing:
            (tmp_path / "audio" / f"{uid}.webm").write_bytes(b"plain text, not audio" * 20 if uid in invalid else audio_for(uid))
        lines.append(json.dumps({"id": uid, "audio_path": f"audio/{uid}.webm", "transcript": REFERENCES.get(uid, "Zeus"),
                                 "speaker_id": "p01" if uid != "u2" else "p02", "split": "dev"}))
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text("\n".join(lines) + "\n")
    return manifest


def uid_of(request: httpx.Request) -> str:
    for uid in REFERENCES:
        if audio_for(uid) in request.content:
            return uid
    raise AssertionError("unknown audio")


def has_prompt(request: httpx.Request) -> bool:
    return b'name="prompt"' in request.content


def scripted_provider(fail=None) -> FakeProvider:
    provider = FakeProvider()

    def answer(request: httpx.Request) -> httpx.Response:
        uid, hinted = uid_of(request), has_prompt(request)
        if fail and fail(uid, hinted):
            return httpx.Response(500, text="upstream secret")
        return httpx.Response(200, json={"text": (HINTS_OUT if hinted else BASELINE_OUT)[uid]})

    provider.override = answer
    return provider


SETTINGS = Settings(api_key=FAKE_KEY)


def run(manifest, provider, settings=SETTINGS):
    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
            return await run_benchmark(load_manifest(manifest), ProviderTranscriber(settings, client), max_audio_bytes=settings.max_audio_bytes)

    return asyncio.run(go())


def test_both_modes_get_the_same_audio_and_differ_only_in_the_prompt(tmp_path):
    provider = scripted_provider()
    # A production TRANSCRIPTION_PROMPT must not leak into the baseline.
    run(make_dataset(tmp_path), provider, Settings(api_key=FAKE_KEY, transcription_prompt="from .env"))
    requests = provider.transcription_requests
    assert len(requests) == 6
    for uid in REFERENCES:
        mine = [r for r in requests if uid_of(r) == uid]
        assert sorted(has_prompt(r) for r in mine) == [False, True]
        hinted = next(r for r in mine if has_prompt(r))
        assert f'name="prompt"\r\n\r\n{hint_prompt()}'.encode() in hinted.content
        for r in mine:
            assert b'name="model"\r\n\r\nwhisper-1' in r.content and b'name="language"\r\n\r\nen' in r.content
    assert b"from .env" not in b"".join(r.content for r in requests)


def test_mode_order_alternates_between_utterances(tmp_path):
    provider = scripted_provider()
    run(make_dataset(tmp_path), provider)
    firsts = [has_prompt(r) for r in provider.transcription_requests[::2]]
    assert firsts == [False, True, False]


def test_scores_and_paired_comparison(tmp_path):
    summary = summarize(run(make_dataset(tmp_path), scripted_provider()))
    base, hints = summary["modes"]["baseline"], summary["modes"]["mythology_hints"]
    assert base["wer"] == pytest.approx(2 / 10) and base["substitutions"] == 2
    assert base["name_accuracy"] == pytest.approx(1 / 3, abs=1e-4) and base["names_inserted"] == 0
    # hints: perfect on speech, but 2 inserted words (and names) on the silence clip
    assert hints["wer"] == pytest.approx(2 / 10) and hints["insertions"] == 2
    assert hints["name_accuracy"] == 1.0 and hints["names_inserted"] == 2
    assert base["silence_clips_with_output"] == 0 and hints["silence_clips_with_output"] == 1
    assert base["latency"]["count"] == 3
    comparison = summary["paired_comparison"]
    assert comparison["paired_utterances"] == 3
    assert comparison["delta"] == {"wer": 0.0, "name_accuracy": pytest.approx(2 / 3, abs=1e-4), "names_inserted": 2}
    assert comparison["per_utterance"] == {"fewer_errors": 2, "more_errors": 1, "same_errors": 0}
    assert set(summary["per_speaker"]) == {"p01", "p02"}


def test_missing_and_invalid_audio_are_reported_without_provider_calls(tmp_path):
    provider = scripted_provider()
    results = run(make_dataset(tmp_path, missing=("u1",), invalid=("u3",)), provider)
    assert [r.status for r in results] == ["audio_missing", "ok", "invalid_audio"]
    assert {uid_of(r) for r in provider.transcription_requests} == {"u2"}
    summary = summarize(results)
    assert summary["audio_missing"] == 1 and summary["invalid_audio"] == 1
    assert summary["paired_comparison"]["paired_utterances"] == 1


def test_a_failed_request_fails_only_that_mode_and_leaves_the_pair(tmp_path):
    provider = scripted_provider(fail=lambda uid, hinted: uid == "u2" and hinted)
    results = run(make_dataset(tmp_path), provider)
    u2 = results[1]
    assert u2.outcomes[Mode.BASELINE].ok and not u2.outcomes[Mode.MYTHOLOGY_HINTS].ok
    assert u2.outcomes[Mode.MYTHOLOGY_HINTS].error.startswith("502:")
    summary = summarize(results)
    assert summary["modes"]["mythology_hints"]["failed"] == 1 and summary["modes"]["baseline"]["failed"] == 0
    assert summary["paired_comparison"]["paired_utterances"] == 2


def test_m4a_recordings_are_sent_as_m4a_not_mp4(tmp_path):
    """Regression: MacBook .m4a files went out as recording.mp4 and the provider answered 400 'Invalid file format'."""
    from helpers import M4A

    audio = tmp_path / "recordings" / "01.m4a"
    audio.parent.mkdir()
    audio.write_bytes(M4A)
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text(json.dumps({"id": "c-01", "audio_path": "recordings/01.m4a", "transcript": "Zeus.",
                                    "speaker_id": "c", "split": "dev"}) + "\n")
    provider = FakeProvider()
    results = run(manifest, provider)
    assert results[0].status == "ok" and len(provider.transcription_requests) == 2
    for request in provider.transcription_requests:
        assert b'filename="recording.m4a"' in request.content and b'filename="recording.mp4"' not in request.content
        assert M4A in request.content  # the bytes are sent unchanged


def test_provider_error_explanation_is_recorded_in_the_report(tmp_path):
    provider = FakeProvider()
    provider.always(400, json={"error": {"message": "Invalid file format.", "type": "invalid_request_error"}})
    results = run(make_dataset(tmp_path, ids=("u1",)), provider)
    error = results[0].outcomes[Mode.BASELINE].error
    assert error == "502: The speech recognition provider returned an error (400). [provider: type=invalid_request_error; Invalid file format.]"


def test_unexpected_exceptions_are_contained(tmp_path):
    provider = FakeProvider()
    provider.fail_with(RuntimeError("boom"))
    results = run(make_dataset(tmp_path, ids=("u1",)), provider)
    outcome = results[0].outcomes[Mode.BASELINE]
    assert not outcome.ok and outcome.error == "RuntimeError"  # recorded by type only, never raised or quoted


def test_report_is_labelled_and_omits_transcripts_by_default(tmp_path):
    manifest = make_dataset(tmp_path)
    results = run(manifest, scripted_provider())
    report = build_report(results, measurement=Measurement.MOCK, settings=SETTINGS, split="dev", manifest_path=manifest)
    text = json.dumps(report)
    assert report["measurement"] == "mock" and report["warning"] == MOCK_WARNING
    assert report["transcripts_included"] is False
    for sentence in ("heavens dream", "dangerous", "Somnas"):
        assert sentence not in text
    assert FAKE_KEY not in text
    assert report["provider"] == {"model": "whisper-1", "host": "api.openai.com", "language": "en"}
    assert report["modes"] == {"baseline": {"prompt": None}, "mythology_hints": {"prompt": hint_prompt()}}
    assert report["utterances"][0]["modes"]["baseline"]["names_missed"] == ["Somnus"]
    markdown = render_markdown(report)
    assert "MOCK RUN" in markdown and "Paired comparison (3 utterances" in markdown and "heavens" not in markdown


def test_transcripts_only_with_explicit_opt_in(tmp_path):
    manifest = make_dataset(tmp_path)
    report = build_report(run(manifest, scripted_provider()), measurement=Measurement.MOCK, settings=SETTINGS,
                          split="dev", manifest_path=manifest, include_transcripts=True)
    assert report["utterances"][1]["reference"] == REFERENCES["u2"]
    assert report["utterances"][1]["modes"]["baseline"]["hypothesis"] == BASELINE_OUT["u2"]


def test_measurement_label_is_required(tmp_path):
    manifest = make_dataset(tmp_path)
    with pytest.raises(TypeError):
        build_report([], settings=SETTINGS, split="dev", manifest_path=manifest)  # type: ignore[call-arg]


def test_transcripts_are_never_logged(tmp_path, caplog):
    with caplog.at_level(logging.DEBUG):
        run(make_dataset(tmp_path), scripted_provider(fail=lambda uid, hinted: uid == "u1"))
    logged = "\n".join(record.getMessage() for record in caplog.records)
    for sentence in ("heavens", "dangerous", "Somnas", "upstream secret", FAKE_KEY):
        assert sentence not in logged
    assert "evaluated 3/3" in logged


@pytest.mark.parametrize(
    ("model", "supported"),
    [("whisper-1", True), ("gpt-4o-transcribe", True), ("gpt-4o-mini-transcribe-2025-03-20", True),
     ("whisper-large-v3-turbo", True), ("some-other-asr", False), ("gpt-4o-mini", False)],
)
def test_prompt_support(model, supported):
    assert model_supports_prompt(model) is supported


class TestCli:
    def test_dry_run_makes_no_requests(self, tmp_path, capsys):
        provider = scripted_provider()
        code = benchmark.main(["--manifest", str(make_dataset(tmp_path, missing=("u3",)))], settings=SETTINGS,
                              transport=httpx.MockTransport(provider))
        out = capsys.readouterr().out
        assert code == 0 and not provider.requests
        assert "Dry run: nothing was sent" in out and "4 transcription requests" in out and "u3: audio file not found" in out
        assert "heavens" not in out
        assert not (tmp_path / "results").exists()

    def test_test_split_needs_explicit_permission(self, tmp_path, capsys):
        code = benchmark.main(["--manifest", str(make_dataset(tmp_path)), "--split", "test", "--run"], settings=SETTINGS)
        assert code == 2 and "held out" in capsys.readouterr().out

    def test_model_without_prompt_support_is_refused(self, tmp_path, capsys):
        settings = Settings(api_key=FAKE_KEY, transcription_model="some-other-asr")
        code = benchmark.main(["--manifest", str(make_dataset(tmp_path)), "--run"], settings=settings)
        assert code == 2 and "not known to accept a vocabulary prompt" in capsys.readouterr().out

    def test_missing_key_is_refused_before_any_call(self, tmp_path, capsys):
        provider = scripted_provider()
        code = benchmark.main(["--manifest", str(make_dataset(tmp_path)), "--run"], settings=Settings(api_key=None),
                              transport=httpx.MockTransport(provider))
        assert code == 2 and not provider.requests and "OPENAI_API_KEY" in capsys.readouterr().out

    def test_bad_manifest(self, tmp_path, capsys):
        bad = tmp_path / "m.jsonl"
        bad.write_text("{oops\n")
        assert benchmark.main(["--manifest", str(bad)], settings=SETTINGS) == 2
        assert "line 1" in capsys.readouterr().out

    def test_run_writes_json_and_markdown(self, tmp_path, capsys):
        provider = scripted_provider()
        out_dir = tmp_path / "out"
        code = benchmark.main(["--manifest", str(make_dataset(tmp_path)), "--run", "--out", str(out_dir)],
                              settings=SETTINGS, transport=httpx.MockTransport(provider), measurement=Measurement.MOCK)
        assert code == 0 and len(provider.transcription_requests) == 6
        report = json.loads((out_dir / "results.json").read_text())
        assert report["measurement"] == "mock" and report["summary"]["paired_comparison"]["paired_utterances"] == 3
        assert "MOCK RUN" in (out_dir / "summary.md").read_text()
        assert "heavens" not in capsys.readouterr().out

    def test_limit(self, tmp_path):
        provider = scripted_provider()
        benchmark.main(["--manifest", str(make_dataset(tmp_path)), "--run", "--limit", "1", "--out", str(tmp_path / "o")],
                       settings=SETTINGS, transport=httpx.MockTransport(provider), measurement=Measurement.MOCK)
        assert len(provider.transcription_requests) == 2
