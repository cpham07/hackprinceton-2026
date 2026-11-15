"""Command line for the LOCAL Whisper baseline (M3). Run from backend/ after `pip install -r requirements-ml.txt`:

    python -m ml.local_benchmark --manifest ml/data/manifest.jsonl                  # dev split, whisper-base.en, auto device
    python -m ml.local_benchmark --manifest ml/data/manifest.jsonl --limit 1        # smoke test

No hosted provider is called. The first run downloads the pinned checkpoint into ml/models/ (git-ignored);
--offline then refuses any network access. The test split also needs --allow-test-split.
Scoring, aggregation and report files are the hosted benchmark's own (ml.evaluate), in baseline mode only.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Sequence

from errors import ServiceError
from speech import validate_audio
from ml.asr import Mode
from ml.dataset import ManifestError, load_manifest
from ml.evaluate import Measurement, build_report, render_markdown, run_benchmark, write_report
from ml.metrics import latency_stats

RESULTS_DIR = Path(__file__).parent / "results"
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # same limit as /transcribe
MODES = (Mode.BASELINE,)


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    from ml.local_asr import DEFAULT_MODEL, PINNED_REVISIONS

    parser = argparse.ArgumentParser(prog="python -m ml.local_benchmark", description="Unmodified local Whisper baseline.")
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--split", choices=("dev", "test"), default="dev")
    parser.add_argument("--allow-test-split", action="store_true", help="required to evaluate the held-out test split")
    parser.add_argument("--model", choices=sorted(PINNED_REVISIONS), default=DEFAULT_MODEL)
    parser.add_argument("--device", choices=("auto", "mps", "cpu"), default="auto")
    parser.add_argument("--limit", type=int, help="only the first N utterances of the split")
    parser.add_argument("--speakers", nargs="+", help="only these speaker ids")
    parser.add_argument("--warmup", type=int, default=1, help="untimed warm-up transcriptions before the run (default 1)")
    parser.add_argument("--offline", action="store_true", help="use the cached checkpoint only, never the network")
    parser.add_argument("--out", type=Path, help="output folder (default: results/<timestamp>-local-<model>-<split>)")
    parser.add_argument("--include-transcripts", action="store_true", help="also write reference and model transcripts")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None, *, make_transcriber: Callable[[argparse.Namespace], Any] | None = None) -> int:
    """Returns the exit code. `make_transcriber` lets tests inject a fake instead of loading torch."""
    args = parse_args(argv)
    say = print
    if args.split == "test" and not args.allow_test_split:
        say("The test split is held out. Evaluate on dev; re-run with --allow-test-split only for a frozen, final comparison.")
        return 2
    try:
        utterances = load_manifest(args.manifest, splits=[args.split])
    except ManifestError as exc:
        say(f"error: {exc}")
        return 2
    if args.speakers:
        utterances = [u for u in utterances if u.speaker_id in set(args.speakers)]
    if args.limit is not None:
        utterances = utterances[: max(args.limit, 0)]
    if not utterances:
        say(f"No {args.split} utterances selected from {args.manifest}.")
        return 2

    usable = []
    for utterance in utterances:
        try:
            usable.append((utterance, validate_audio(utterance.audio_path.read_bytes(), None, MAX_AUDIO_BYTES)))
        except (OSError, ServiceError):
            pass
    say(f"{args.split}: {len(utterances)} utterances from {len({u.speaker_id for u in utterances})} speaker(s); "
        f"{len(usable)} recordings readable.")
    if not usable:
        return 2

    if make_transcriber is None:
        from ml.local_asr import LocalWhisperTranscriber

        def make_transcriber(a: argparse.Namespace) -> Any:
            return LocalWhisperTranscriber(a.model, device=a.device, offline=a.offline)

    transcriber = make_transcriber(args)
    info: dict[str, Any] = transcriber.info.as_dict()
    say(f"Model {info['model_id']}@{info['revision'][:10]} on {info['device']} ({info['dtype']}, "
        f"{info['parameters'] / 1e6:.1f}M parameters, {info['weights_mb']} MB), loaded in {info['load_seconds']} s.")

    async def go():
        # Warm-up on the first usable recording: the first MPS call compiles kernels. Not timed or scored.
        first_utterance, first_format = usable[0]
        for _ in range(max(args.warmup, 0)):
            await transcriber(first_utterance.audio_path.read_bytes(), first_format, Mode.BASELINE)
        transcriber.inference_ms.clear()
        return await run_benchmark(utterances, transcriber, max_audio_bytes=MAX_AUDIO_BYTES, modes=MODES)

    results = asyncio.run(go())
    report = build_report(
        results,
        measurement=Measurement.LOCAL,
        settings=None,
        split=args.split,
        manifest_path=args.manifest,
        modes=MODES,
        include_transcripts=args.include_transcripts,
        provider={"model": f"{info['model_id']}@{info['revision'][:10]}", "host": f"local:{info['device']}", "language": "en"},
    )
    report["local_model"] = {
        **info,
        "decoding": "greedy, no prompt, checkpoint max_length",
        "warmup_utterances": max(args.warmup, 0),
        # Model-only time per utterance; the per-mode latency in `summary` also includes afconvert decoding.
        "inference_latency": latency_stats(transcriber.inference_ms),
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name = args.model.split("/")[-1]
    json_path, md_path = write_report(report, args.out or RESULTS_DIR / f"{stamp}-local-{name}-{args.split}")
    inference = report["local_model"]["inference_latency"]
    with md_path.open("a", encoding="utf-8") as md:
        md.write(f"\n## Local model\n\n- `{info['model_id']}` revision `{info['revision']}`, unchanged weights\n"
                 f"- Device `{info['device']}`, {info['dtype']}, {info['parameters']:,} parameters, "
                 f"{info['weights_mb']} MB safetensors\n"
                 f"- Model-only latency p50 / p90 / max: {inference['p50_ms']} / {inference['p90_ms']} / {inference['max_ms']} ms\n")
    say("")
    say(md_path.read_text(encoding="utf-8"))
    say(f"Wrote {json_path} and {md_path}")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
    for noisy in ("httpx", "httpx2", "huggingface_hub", "transformers", "torch"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    sys.exit(main())
