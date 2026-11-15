"""Run baseline and experimental transcription on the same recordings, score them, and write the results.

Every report states whether it is a real provider measurement or a mock run. Transcripts are kept
in memory for scoring; they reach the results file only with include_transcripts=True and are never logged.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Sequence
from urllib.parse import urlparse

from config import Settings
from errors import ServiceError
from speech import validate_audio
from ml.asr import ALL_MODES, Mode, Transcriber, prompt_for
from ml.dataset import Utterance
from ml.metrics import ErrorCounts, NameCounts, latency_stats, name_counts, word_errors
from ml.vocabulary import MYTHOLOGY_TERMS, hint_prompt

logger = logging.getLogger("backend.ml")

SCHEMA_VERSION = 1


class Measurement(str, Enum):
    REAL = "real_provider"
    MOCK = "mock"


MOCK_WARNING = "MOCK RUN: the transcriber was a test double. These numbers do not describe any real speech model."


@dataclass
class ModeOutcome:
    mode: Mode
    ok: bool
    hypothesis: str | None = None
    latency_ms: float | None = None
    error: str | None = None
    errors: ErrorCounts | None = None
    names: NameCounts | None = None


@dataclass
class UtteranceResult:
    utterance: Utterance
    status: str  # "ok" (audio was sent), "audio_missing" or "invalid_audio"
    detail: str | None = None
    outcomes: dict[Mode, ModeOutcome] = field(default_factory=dict)

    def all_ok(self, modes: Sequence[Mode]) -> bool:
        return self.status == "ok" and all(mode in self.outcomes and self.outcomes[mode].ok for mode in modes)


async def run_benchmark(
    utterances: Sequence[Utterance],
    transcriber: Transcriber,
    *,
    max_audio_bytes: int,
    modes: Sequence[Mode] = ALL_MODES,
) -> list[UtteranceResult]:
    """Transcribe every utterance once per mode, sequentially, alternating which mode goes first.

    The same bytes are sent in every mode. A missing or invalid file is recorded without any provider
    call; a failed provider call fails only that mode for that utterance.
    """
    results: list[UtteranceResult] = []
    for index, utterance in enumerate(utterances):
        try:
            audio = utterance.audio_path.read_bytes()
        except FileNotFoundError:
            results.append(UtteranceResult(utterance, "audio_missing", "audio file not found"))
            continue
        except OSError as exc:
            results.append(UtteranceResult(utterance, "audio_missing", f"audio file unreadable ({type(exc).__name__})"))
            continue
        try:
            audio_format = validate_audio(audio, None, max_audio_bytes)
        except ServiceError as exc:
            results.append(UtteranceResult(utterance, "invalid_audio", exc.detail))
            continue

        result = UtteranceResult(utterance, "ok")
        order = list(modes) if index % 2 == 0 else list(reversed(modes))  # spreads warm-up/caching effects
        for mode in order:
            started = time.perf_counter()
            try:
                hypothesis = await transcriber(audio, audio_format, mode)
            except ServiceError as exc:
                result.outcomes[mode] = ModeOutcome(mode, False, error=f"{exc.status_code}: {exc.detail}")
                logger.warning("utterance %s mode=%s failed status=%d", utterance.id, mode.value, exc.status_code)
                continue
            except Exception as exc:  # noqa: BLE001 - one bad call must not lose the whole run
                result.outcomes[mode] = ModeOutcome(mode, False, error=type(exc).__name__)
                logger.warning("utterance %s mode=%s failed: %s", utterance.id, mode.value, type(exc).__name__)
                continue
            latency = (time.perf_counter() - started) * 1000
            result.outcomes[mode] = ModeOutcome(
                mode,
                True,
                hypothesis=hypothesis,
                latency_ms=latency,
                errors=word_errors(utterance.transcript, hypothesis),
                names=name_counts(utterance.transcript, hypothesis),
            )
        results.append(result)
        logger.info("evaluated %d/%d id=%s", index + 1, len(utterances), utterance.id)
    return results


# --- aggregation ---------------------------------------------------------------------------------


def _ratio(value: float | None) -> float | None:
    return None if value is None else round(value, 4)


def _score(outcomes: Sequence[ModeOutcome]) -> dict[str, Any]:
    errors = sum((o.errors for o in outcomes if o.errors), ErrorCounts())
    names = sum((o.names for o in outcomes if o.names), NameCounts())
    return {
        "utterances": len(outcomes),
        "wer": _ratio(errors.wer),
        "substitutions": errors.substitutions,
        "deletions": errors.deletions,
        "insertions": errors.insertions,
        "reference_words": errors.reference_words,
        "name_accuracy": _ratio(names.accuracy),
        "names_in_reference": names.reference,
        "names_matched": names.matched,
        "names_inserted": names.inserted,
    }


def summarize(results: Sequence[UtteranceResult], modes: Sequence[Mode] = ALL_MODES) -> dict[str, Any]:
    """Per-mode totals over every successful call, plus a paired comparison over utterances where all modes succeeded."""
    sent = [r for r in results if r.status == "ok"]
    paired = [r for r in results if r.all_ok(modes)]

    per_mode: dict[str, Any] = {}
    for mode in modes:
        ok = [r.outcomes[mode] for r in sent if mode in r.outcomes and r.outcomes[mode].ok]
        silence = [r.outcomes[mode] for r in sent if not r.utterance.transcript.strip() and mode in r.outcomes and r.outcomes[mode].ok]
        per_mode[mode.value] = {
            "attempted": len(sent),
            "succeeded": len(ok),
            "failed": len(sent) - len(ok),
            **{k: v for k, v in _score(ok).items() if k != "utterances"},
            "silence_clips": len(silence),
            "silence_clips_with_output": sum(1 for o in silence if o.hypothesis and o.hypothesis.strip()),
            "latency": latency_stats([o.latency_ms for o in ok if o.latency_ms is not None]),
        }

    comparison: dict[str, Any] = {"paired_utterances": len(paired)}
    for mode in modes:
        comparison[mode.value] = _score([r.outcomes[mode] for r in paired])
    if len(modes) == 2:
        base, exp = modes
        b, e = comparison[base.value], comparison[exp.value]
        comparison["delta"] = {
            "wer": None if b["wer"] is None or e["wer"] is None else round(e["wer"] - b["wer"], 4),
            "name_accuracy": None
            if b["name_accuracy"] is None or e["name_accuracy"] is None
            else round(e["name_accuracy"] - b["name_accuracy"], 4),
            "names_inserted": e["names_inserted"] - b["names_inserted"],
        }
        better = worse = same = 0
        for r in paired:
            diff = r.outcomes[exp].errors.errors - r.outcomes[base].errors.errors  # type: ignore[union-attr]
            better += diff < 0
            worse += diff > 0
            same += diff == 0
        comparison["per_utterance"] = {"fewer_errors": better, "more_errors": worse, "same_errors": same}

    speakers: dict[str, Any] = {}
    for speaker in sorted({r.utterance.speaker_id for r in paired}):
        mine = [r for r in paired if r.utterance.speaker_id == speaker]
        speakers[speaker] = {mode.value: _score([r.outcomes[mode] for r in mine]) for mode in modes}

    return {
        "utterances_total": len(results),
        "audio_missing": sum(r.status == "audio_missing" for r in results),
        "invalid_audio": sum(r.status == "invalid_audio" for r in results),
        "modes": per_mode,
        "paired_comparison": comparison,
        "per_speaker": speakers,
    }


# --- reports -------------------------------------------------------------------------------------


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_report(
    results: Sequence[UtteranceResult],
    *,
    measurement: Measurement,
    settings: Settings,
    split: str,
    manifest_path: Path,
    hint: str | None = None,
    modes: Sequence[Mode] = ALL_MODES,
    include_transcripts: bool = False,
) -> dict[str, Any]:
    """The machine-readable result. `measurement` has no default so no caller can forget to label a mock run."""
    hint = hint if hint is not None else hint_prompt()
    utterances = []
    for r in results:
        entry: dict[str, Any] = {"id": r.utterance.id, "speaker_id": r.utterance.speaker_id, "status": r.status}
        if r.detail:
            entry["detail"] = r.detail
        if include_transcripts:
            entry["reference"] = r.utterance.transcript
        entry["modes"] = {}
        for mode, o in r.outcomes.items():
            item: dict[str, Any] = {"ok": o.ok}
            if o.ok and o.errors and o.names:
                item.update(
                    latency_ms=round(o.latency_ms or 0, 1),
                    wer=_ratio(o.errors.wer),
                    substitutions=o.errors.substitutions,
                    deletions=o.errors.deletions,
                    insertions=o.errors.insertions,
                    reference_words=o.errors.reference_words,
                    names_missed=list(o.names.missed),
                    names_inserted=list(o.names.spurious),
                )
                if include_transcripts:
                    item["hypothesis"] = o.hypothesis
            else:
                item["error"] = o.error
            entry["modes"][mode.value] = item
        utterances.append(entry)

    report: dict[str, Any] = {"schema_version": SCHEMA_VERSION, "measurement": measurement.value}
    if measurement is Measurement.MOCK:
        report["warning"] = MOCK_WARNING
    report.update(
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        manifest={"file": manifest_path.name, "sha256": file_sha256(manifest_path), "split": split},
        provider={
            "model": settings.transcription_model,
            "host": urlparse(settings.transcription_credentials[1]).hostname,
            "language": settings.transcription_language,
        },
        modes={mode.value: {"prompt": prompt_for(mode, hint)} for mode in modes},
        vocabulary=[term.canonical for term in MYTHOLOGY_TERMS],
        transcripts_included=include_transcripts,
        summary=summarize(results, modes),
        utterances=utterances,
    )
    return report


def _pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def _ms(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.0f} ms"


def render_markdown(report: dict[str, Any]) -> str:
    """Human-readable summary of a report from build_report."""
    s = report["summary"]
    lines = [f"# ASR benchmark: {report['manifest']['split']} split", ""]
    if report["measurement"] == Measurement.MOCK.value:
        lines += [f"> **{report['warning']}**", ""]
    else:
        lines += ["Real provider measurement.", ""]
    lines += [
        f"- Model: `{report['provider']['model']}` at `{report['provider']['host']}`, language `{report['provider']['language']}`",
        f"- Manifest: `{report['manifest']['file']}` (sha256 {report['manifest']['sha256'][:12]}), created {report['created_at']}",
        f"- Utterances: {s['utterances_total']} ({s['audio_missing']} audio missing, {s['invalid_audio']} invalid audio)",
        f"- Hint prompt: `{report['modes'].get(Mode.MYTHOLOGY_HINTS.value, {}).get('prompt')}`",
        "",
        "## All successful calls per mode",
        "",
        "| Mode | OK / sent | WER | Name accuracy | Names inserted | Output on silence | Latency p50 / p90 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for mode, m in s["modes"].items():
        lat = m["latency"]
        lines.append(
            f"| {mode} | {m['succeeded']} / {m['attempted']} | {_pct(m['wer'])} | {_pct(m['name_accuracy'])} "
            f"({m['names_matched']}/{m['names_in_reference']}) | {m['names_inserted']} | "
            f"{m['silence_clips_with_output']}/{m['silence_clips']} | {_ms(lat['p50_ms'])} / {_ms(lat['p90_ms'])} |"
        )
    c = s["paired_comparison"]
    lines += ["", f"## Paired comparison ({c['paired_utterances']} utterances where every mode succeeded)", ""]
    if "delta" in c:
        d, p = c["delta"], c["per_utterance"]
        wer_delta = "n/a" if d["wer"] is None else f"{d['wer'] * 100:+.1f} points"
        acc_delta = "n/a" if d["name_accuracy"] is None else f"{d['name_accuracy'] * 100:+.1f} points"
        lines += [
            f"- WER change (hints minus baseline): {wer_delta} (lower is better)",
            f"- Name accuracy change: {acc_delta} (higher is better)",
            f"- Extra inserted names with hints: {d['names_inserted']:+d} (should stay at or below 0)",
            f"- Per utterance with hints: {p['fewer_errors']} fewer errors, {p['more_errors']} more, {p['same_errors']} same",
        ]
        if c["paired_utterances"] < 30:
            lines.append("- Small sample: treat differences as anecdotal, not significant.")
    if s["per_speaker"]:
        lines += ["", "## Per speaker (paired)", "", "| Speaker | " + " | ".join(f"{m} WER" for m in s["modes"]) + " |",
                  "| --- |" + " --- |" * len(s["modes"])]
        for speaker, scores in s["per_speaker"].items():
            lines.append(f"| {speaker} | " + " | ".join(_pct(scores[m]["wer"]) for m in s["modes"]) + " |")
    failures = [
        (u["id"], u.get("detail") or "; ".join(f"{m}: {v['error']}" for m, v in u["modes"].items() if not v["ok"]))
        for u in report["utterances"]
        if u["status"] != "ok" or not all(v["ok"] for v in u["modes"].values())
    ]
    if failures:
        lines += ["", "## Failures", ""] + [f"- `{uid}`: {why}" for uid, why in failures]
    return "\n".join(lines) + "\n"


def write_report(report: dict[str, Any], out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path, md_path = out_dir / "results.json", out_dir / "summary.md"
    json_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")
    return json_path, md_path
