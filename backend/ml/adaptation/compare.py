"""Base checkpoint vs the same checkpoint + a speaker adapter, scored by the existing evaluator (ml.evaluate).

    python -m ml.adaptation.compare --run ml/checkpoints/pilot-xin

Both conditions use LocalWhisperTranscriber.transcribe_samples (same audio decoding, features, greedy decoding,
no prompt) and run_benchmark/summarize (same normalization, WER and name scoring). Groups:
- target_validation:          the adapted speaker's held-out dev sentences (the result that matters)
- other_speakers_validation:  other speakers reading the same held-out sentences (regression check)
- target_training:            the recordings the adapter was trained on (fit only, NOT evidence of generalization)
Only dev recordings are read. Reports go to ml/results/ (git-ignored).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Sequence

from ml.adaptation.data import split_speaker
from ml.adaptation.model import load_adapted, mean_token_loss, read_run
from ml.asr import Mode
from ml.dataset import load_manifest
from ml.evaluate import Measurement, build_report, run_benchmark, summarize, write_report
from ml.local_asr import LocalWhisperTranscriber, load_pretrained
from ml.metrics import latency_stats

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
MODES = (Mode.BASELINE,)
MAX_AUDIO_BYTES = 10 * 1024 * 1024
GROUPS = ("target_validation", "other_speakers_validation", "target_training")


def paired(base_results, adapted_results) -> dict[str, int]:
    by_id = {r.utterance.id: r for r in base_results}
    counts = {"fewer_errors": 0, "more_errors": 0, "same_errors": 0}
    for r in adapted_results:
        b = by_id.get(r.utterance.id)
        if not (b and r.all_ok(MODES) and b.all_ok(MODES)):
            continue
        diff = r.outcomes[Mode.BASELINE].errors.errors - b.outcomes[Mode.BASELINE].errors.errors
        counts["fewer_errors" if diff < 0 else "more_errors" if diff > 0 else "same_errors"] += 1
    return counts


def compare(run_dir: Path, *, manifest: Path, device: str = "auto", include_transcripts: bool = False, out: Path | None = None) -> dict[str, Any]:
    from ml.adaptation.train import batches, encode

    metadata = read_run(run_dir)
    config = metadata["config"]
    utterances = load_manifest(manifest, splits=["dev"])
    split = split_speaker(utterances, config["speaker"], n_validation=config["n_validation"], seed=config["seed"])
    recorded = metadata["split"]
    if [u.id for u in split.train] != recorded["train_ids"] or [u.id for u in split.validation] != recorded["validation_ids"]:
        raise RuntimeError("the manifest no longer gives the split this adapter was trained with")
    groups = {
        "target_validation": list(split.validation),
        "other_speakers_validation": split.other_speaker_validation(utterances),
        "target_training": list(split.train),
    }

    processor, base_model, info, _ = load_pretrained(config["model_id"], device=device, offline=True)
    a_processor, adapted_model, a_info, _ = load_adapted(run_dir, device=device)
    conditions = {
        "base": (LocalWhisperTranscriber.from_loaded(processor, base_model, info), base_model),
        "adapted": (LocalWhisperTranscriber.from_loaded(a_processor, adapted_model, a_info), adapted_model),
    }
    out = out or RESULTS_DIR / f"adaptation-{run_dir.name}"
    start_id = base_model.config.decoder_start_token_id
    warm = groups["target_validation"][0]

    async def evaluate(transcriber, group):
        return await run_benchmark(group, transcriber, max_audio_bytes=MAX_AUDIO_BYTES, modes=MODES)

    for transcriber, _ in conditions.values():  # untimed warm-up, as in ml.local_benchmark
        transcriber.transcribe_samples(_samples(warm))

    rows: dict[str, Any] = {}
    for group, members in groups.items():
        examples = encode(members, processor, start_id)
        order = list(range(len(examples)))
        row: dict[str, Any] = {"recordings": len(members), "ids": [u.id for u in members]}
        results = {}
        for name, (transcriber, model) in conditions.items():
            transcriber.inference_ms.clear()
            results[name] = asyncio.run(evaluate(transcriber, members))
            summary = summarize(results[name], MODES)
            scores = summary["modes"]["baseline"]
            row[name] = {
                "wer": scores["wer"],
                "errors": scores["substitutions"] + scores["deletions"] + scores["insertions"],
                "reference_words": scores["reference_words"],
                "name_accuracy": scores["name_accuracy"],
                "names_matched": scores["names_matched"],
                "names_in_reference": scores["names_in_reference"],
                "names_inserted": scores["names_inserted"],
                "val_loss": mean_token_loss(model, batches(examples, order, 4, str(next(model.parameters()).device))),
                "inference_latency": latency_stats(transcriber.inference_ms),
                "per_speaker_wer": {s: v["baseline"]["wer"] for s, v in summary["per_speaker"].items()},
                "failed": scores["failed"],
            }
            report = build_report(
                results[name], measurement=Measurement.LOCAL, settings=None, split="dev", manifest_path=manifest,
                modes=MODES, include_transcripts=include_transcripts,
                provider={"model": f"{info.model_id}@{info.revision[:10]}" + (f"+adapter:{run_dir.name}" if name == "adapted" else ""),
                          "host": f"local:{info.device}", "language": "en"},
            )
            report["adaptation"] = {"run": run_dir.name, "group": group, "condition": name, "provisional_labels": metadata.get("provisional_labels")}
            write_report(report, out / f"{group}-{name}")
        row["paired"] = paired(results["base"], results["adapted"])
        rows[group] = row

    comparison = {
        "run": run_dir.name,
        "speaker": config["speaker"],
        "provisional_labels": metadata.get("provisional_labels"),
        "base_model": metadata["base_model"],
        "device": info.device,
        "decoding": "greedy, no prompt, identical for both conditions (LocalWhisperTranscriber.transcribe_samples)",
        "trainable": metadata["trainable"],
        "train_seconds": metadata["train_seconds"],
        "groups": rows,
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "comparison.json").write_text(json.dumps(comparison, indent=2) + "\n", encoding="utf-8")
    markdown = render(comparison)
    (out / "comparison.md").write_text(markdown, encoding="utf-8")
    print(markdown)
    print(f"Wrote {out / 'comparison.json'} and per-condition reports in {out}")
    return comparison


def _samples(utterance):
    from ml.local_asr import decode_audio
    from speech import validate_audio

    audio = utterance.audio_path.read_bytes()
    return decode_audio(audio, validate_audio(audio, None, MAX_AUDIO_BYTES))


def _pct(v) -> str:
    return "n/a" if v is None else f"{v * 100:.1f}%"


def render(c: dict[str, Any]) -> str:
    lines = [f"# Speaker adaptation: {c['speaker']} ({c['run']})", ""]
    if c.get("provisional_labels"):
        lines += ["> Labels are the unverified script text (`reference-unverified`): treat every number as provisional.", ""]
    t = c["trainable"]
    lines += [
        f"- Base `{c['base_model']['model_id']}@{c['base_model']['revision'][:10]}` on `{c['device']}`; adapter trains "
        f"{t['trainable_parameters']:,} of {t['total_parameters']:,} parameters; training {c['train_seconds']} s",
        f"- Decoding: {c['decoding']}",
        "",
        "| Group | Recordings | WER base → adapted | Errors | Names base → adapted | Val loss base → adapted | Per recording (adapted) | Model latency p50 base / adapted |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for group, r in c["groups"].items():
        b, a, p = r["base"], r["adapted"], r["paired"]
        label = group + (" (fit only)" if group == "target_training" else "")
        lines.append(
            f"| {label} | {r['recordings']} | {_pct(b['wer'])} → {_pct(a['wer'])} | {b['errors']} → {a['errors']} of {b['reference_words']} | "
            f"{b['names_matched']}/{b['names_in_reference']} → {a['names_matched']}/{a['names_in_reference']} | "
            f"{b['val_loss']:.4f} → {a['val_loss']:.4f} | {p['fewer_errors']} fewer, {p['more_errors']} more, {p['same_errors']} same | "
            f"{b['inference_latency']['p50_ms']} / {a['inference_latency']['p50_ms']} ms |"
        )
    other = c["groups"]["other_speakers_validation"]
    lines += ["", "Other speakers, per speaker WER (base → adapted): " + ", ".join(
        f"{s} {_pct(other['base']['per_speaker_wer'].get(s))} → {_pct(other['adapted']['per_speaker_wer'].get(s))}"
        for s in sorted(other["base"]["per_speaker_wer"])
    )]
    return "\n".join(lines) + "\n"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ml.adaptation.compare")
    parser.add_argument("--run", type=Path, required=True, help="adapter run folder, e.g. ml/checkpoints/pilot-xin")
    parser.add_argument("--manifest", type=Path, default=Path("ml/data/manifest.jsonl"))
    parser.add_argument("--device", choices=("auto", "mps", "cpu"), default="auto")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--include-transcripts", action="store_true")
    args = parser.parse_args(argv)
    compare(args.run, manifest=args.manifest, device=args.device, include_transcripts=args.include_transcripts, out=args.out)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s:%(name)s: %(message)s")
    sys.exit(main())
