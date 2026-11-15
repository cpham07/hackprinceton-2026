"""Command line for the ASR benchmark. Run from backend/:

    python -m ml.benchmark --manifest ml/data/manifest.jsonl              # dry run: validates, no provider calls
    python -m ml.benchmark --manifest ml/data/manifest.jsonl --run        # real calls: 2 per utterance, may cost money

Without --run nothing is sent anywhere. The test split also needs --allow-test-split.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence
from urllib.parse import urlparse

import httpx

from config import ConfigError, Settings, load_settings
from errors import ServiceError
from speech import validate_audio
from ml.asr import ALL_MODES, ProviderTranscriber, model_supports_prompt
from ml.dataset import ManifestError, load_manifest
from ml.evaluate import Measurement, build_report, render_markdown, run_benchmark, write_report
from ml.vocabulary import hint_prompt

RESULTS_DIR = Path(__file__).parent / "results"


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m ml.benchmark", description="Baseline vs mythology-hint ASR benchmark.")
    parser.add_argument("--manifest", required=True, type=Path, help="JSONL manifest (see ml/README.md)")
    parser.add_argument("--split", choices=("dev", "test"), default="dev")
    parser.add_argument("--allow-test-split", action="store_true", help="required to evaluate the held-out test split")
    parser.add_argument("--run", action="store_true", help="actually call the speech provider (may incur costs)")
    parser.add_argument("--limit", type=int, help="only the first N utterances of the split")
    parser.add_argument("--out", type=Path, help=f"output folder (default: {RESULTS_DIR.name}/<timestamp>-<split>)")
    parser.add_argument("--include-transcripts", action="store_true", help="also write reference and model transcripts to results.json")
    parser.add_argument("--assume-prompt-support", action="store_true", help="the configured model accepts `prompt` although it is not on the known list")
    return parser.parse_args(argv)


def main(
    argv: Sequence[str] | None = None,
    *,
    settings: Settings | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
    measurement: Measurement = Measurement.REAL,
) -> int:
    """Returns the exit code. `settings`, `transport` and `measurement` exist so tests can run it against a mock."""
    args = parse_args(argv)
    say = print

    if args.split == "test" and not args.allow_test_split:
        say("The test split is held out. Tune on dev; once the prompt and settings are frozen, re-run with --allow-test-split.")
        return 2
    try:
        utterances = load_manifest(args.manifest, splits=[args.split])
        settings = settings or load_settings()
    except (ManifestError, ConfigError) as exc:
        say(f"error: {exc}")
        return 2
    if args.limit is not None:
        utterances = utterances[: max(args.limit, 0)]
    if not utterances:
        say(f"No {args.split} utterances in {args.manifest}.")
        return 2

    model = settings.transcription_model
    if not model_supports_prompt(model) and not args.assume_prompt_support:
        say(f"Model {model!r} is not known to accept a vocabulary prompt, so the experiment would be meaningless. "
            "Use a prompt-capable model (TRANSCRIPTION_MODEL) or pass --assume-prompt-support if you have checked it does.")
        return 2

    # Preflight: read and validate every file locally (no network).
    sendable, problems = 0, []
    for utterance in utterances:
        if not utterance.audio_path.is_file():
            problems.append(f"{utterance.id}: audio file not found")
            continue
        try:
            validate_audio(utterance.audio_path.read_bytes(), None, settings.max_audio_bytes)
            sendable += 1
        except ServiceError as exc:
            problems.append(f"{utterance.id}: {exc.detail}")
    speakers = len({u.speaker_id for u in utterances})
    host = urlparse(settings.transcription_credentials[1]).hostname
    say(f"{args.split}: {len(utterances)} utterances from {speakers} speaker(s); {sendable} recordings ready, {len(problems)} not usable.")
    for problem in problems:
        say(f"  - {problem}")
    say(f"Hint prompt: {hint_prompt()}")

    if not args.run:
        say(f"Dry run: nothing was sent. With --run this makes {sendable * len(ALL_MODES)} transcription requests "
            f"to {model} at {host} (one per mode per recording), which may incur costs.")
        return 0
    if sendable == 0:
        say("Nothing to send.")
        return 2
    if not settings.transcription_credentials[0]:
        say("Speech recognition is not configured: set OPENAI_API_KEY (or TRANSCRIPTION_API_KEY) in backend/.env.")
        return 2

    async def go():
        async with httpx.AsyncClient(transport=transport) as client:
            return await run_benchmark(utterances, ProviderTranscriber(settings, client), max_audio_bytes=settings.max_audio_bytes)

    results = asyncio.run(go())
    report = build_report(
        results,
        measurement=measurement,
        settings=settings,
        split=args.split,
        manifest_path=args.manifest,
        include_transcripts=args.include_transcripts,
    )
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path, md_path = write_report(report, args.out or RESULTS_DIR / f"{stamp}-{args.split}")
    say("")
    say(render_markdown(report))
    say(f"Wrote {json_path} and {md_path}")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # its INFO lines would list every provider URL
    sys.exit(main())
