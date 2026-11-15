"""Train one speaker's LoRA adapter on that speaker's dev recordings, then compare it with the base model.

Run from backend/ (needs `pip install -r requirements-ml.txt` and the cached checkpoint from M3):

    python -m ml.adaptation.train --speaker xin --run-name smoke-xin --max-steps 2 --no-compare   # smoke test
    python -m ml.adaptation.train --speaker xin --run-name pilot-xin                             # pilot + comparison

Only dev recordings are read; the test split is never loaded. Audio is decoded in memory and never written.
"""

from __future__ import annotations

import argparse
import logging
import math
import platform
import sys
import time
from dataclasses import replace
from pathlib import Path
from typing import Any, Sequence

from ml.adaptation.config import AdaptConfig
from ml.adaptation.data import featurize, label_ids, pad_labels, split_speaker
from ml.adaptation.model import (
    CHECKPOINTS_DIR, apply_lora, file_sha256, mean_token_loss, set_seed, trainable_summary, write_run,
)
from ml.dataset import load_manifest
from ml.local_asr import decode_audio, load_pretrained
from speech import validate_audio

logger = logging.getLogger("backend.ml.adaptation")
MAX_AUDIO_BYTES = 10 * 1024 * 1024


def encode(utterances, processor, decoder_start_token_id) -> list[tuple[Any, list[int]]]:
    """(log-mel features, label ids) per utterance, decoded in memory exactly as for inference."""
    examples = []
    for u in utterances:
        audio = u.audio_path.read_bytes()
        samples = decode_audio(audio, validate_audio(audio, None, MAX_AUDIO_BYTES))
        examples.append((featurize(processor, samples), label_ids(processor.tokenizer, u.transcript, decoder_start_token_id)))
    return examples


def batches(examples, indices, batch_size, device):
    import torch

    for start in range(0, len(indices), batch_size):
        chunk = [examples[i] for i in indices[start : start + batch_size]]
        yield torch.stack([f for f, _ in chunk]).to(device), pad_labels([l for _, l in chunk]).to(device)


def train(config: AdaptConfig, *, manifest: Path, run_dir: Path, device: str = "auto", offline: bool = True) -> dict[str, Any]:
    import peft
    import torch
    import transformers

    if run_dir.exists():
        raise FileExistsError(f"{run_dir} already exists; choose another --run-name (runs are never overwritten)")
    utterances = load_manifest(manifest, splits=["dev"])  # the test split is never loaded
    split = split_speaker(utterances, config.speaker, n_validation=config.n_validation, seed=config.seed)

    processor, model, info, snapshot = load_pretrained(config.model_id, device=device, offline=offline)
    weights = snapshot / "model.safetensors"
    base_sha = file_sha256(weights)
    device_name = info.device
    start_id = model.config.decoder_start_token_id
    train_examples = encode(split.train, processor, start_id)
    val_examples = encode(split.validation, processor, start_id)
    val_order = list(range(len(val_examples)))

    def val_loss(m) -> float | None:
        return mean_token_loss(m, batches(val_examples, val_order, config.batch_size, device_name))

    base_val_loss = val_loss(model)  # epoch 0 = the unmodified checkpoint
    set_seed(config.seed)  # LoRA init and batch order depend only on the seed
    model = apply_lora(model, config)
    summary = trainable_summary(model)
    if not summary["only_lora_trainable"]:
        raise RuntimeError("something other than LoRA parameters is trainable")
    trainable = [p for p in model.parameters() if p.requires_grad]

    steps_per_epoch = math.ceil(len(train_examples) / config.batch_size)
    total_steps = steps_per_epoch * config.epochs
    if config.max_steps is not None:
        total_steps = min(total_steps, config.max_steps)
    optimizer = torch.optim.AdamW(trainable, lr=config.learning_rate, weight_decay=config.weight_decay)
    warmup = min(config.warmup_steps, max(total_steps - 1, 0))
    schedule = torch.optim.lr_scheduler.LambdaLR(
        optimizer,
        lambda step: (step + 1) / (warmup + 1) if step < warmup else max(0.0, (total_steps - step) / max(total_steps - warmup, 1)),
    )
    order = torch.Generator().manual_seed(config.seed)

    history: list[dict[str, Any]] = [{"epoch": 0, "step": 0, "train_loss": None, "val_loss": base_val_loss}]
    best = (base_val_loss if base_val_loss is not None else math.inf, 0)
    mps = getattr(torch, "mps", None)
    peak_allocated = 0
    step, started = 0, time.perf_counter()
    model.train()
    for epoch in range(1, config.epochs + 1):
        if step >= total_steps:
            break
        permutation = torch.randperm(len(train_examples), generator=order).tolist()
        losses, grad_norms = [], []
        for features, labels in batches(train_examples, permutation, config.batch_size, device_name):
            if step >= total_steps:
                break
            loss = model(input_features=features, labels=labels).loss  # mean over non-ignored label tokens
            loss.backward()
            grad_norms.append(float(torch.nn.utils.clip_grad_norm_(trainable, config.max_grad_norm)))
            optimizer.step()
            schedule.step()
            optimizer.zero_grad(set_to_none=True)
            losses.append(float(loss.item()))
            step += 1
            if device_name.startswith("mps") and mps is not None:
                peak_allocated = max(peak_allocated, mps.current_allocated_memory())
        epoch_val = val_loss(model)
        history.append({
            "epoch": epoch, "step": step, "train_loss": sum(losses) / len(losses), "val_loss": epoch_val,
            "max_grad_norm_before_clip": max(grad_norms), "lr": schedule.get_last_lr()[0],
        })
        logger.info("epoch %d step %d train_loss %.4f val_loss %.4f", epoch, step, history[-1]["train_loss"], epoch_val)
        if epoch_val is not None and epoch_val < best[0]:
            best = (epoch_val, epoch)
            model.save_pretrained(run_dir / "best_val_loss" / "adapter")
    duration = time.perf_counter() - started

    if file_sha256(weights) != base_sha:
        raise RuntimeError("the pretrained checkpoint changed on disk during training")
    metadata = {
        "kind": "whisper-lora-speaker-adapter",
        "provisional_labels": True,  # the references are script text not yet verified by ear
        "base_model": {"model_id": info.model_id, "revision": info.revision, "weights_sha256": base_sha},
        "config": config.as_dict(),
        "split": split.as_dict(),
        "trainable": summary,
        "device": device_name,
        "dtype": info.dtype,
        "train_steps": step,
        "train_seconds": round(duration, 1),
        "history": history,
        "final_epoch": history[-1]["epoch"],
        "best_val_loss_epoch": best[1],
        "mps_peak_allocated_mb": round(peak_allocated / 1e6, 1) if peak_allocated else None,
        "mps_driver_allocated_mb": round(mps.driver_allocated_memory() / 1e6, 1) if device_name.startswith("mps") else None,
        "versions": {"python": platform.python_version(), "torch": torch.__version__,
                     "transformers": transformers.__version__, "peft": peft.__version__},
        "base_weights_unchanged": True,
    }
    write_run(run_dir, model, metadata)
    return metadata


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m ml.adaptation.train", description="Train one speaker's LoRA adapter.")
    parser.add_argument("--manifest", type=Path, default=Path("ml/data/manifest.jsonl"))
    parser.add_argument("--speaker", required=True)
    parser.add_argument("--run-name", required=True, help="folder under ml/checkpoints/ (must not exist)")
    parser.add_argument("--device", choices=("auto", "mps", "cpu"), default="auto")
    parser.add_argument("--epochs", type=int)
    parser.add_argument("--max-steps", type=int, help="stop after N optimizer steps (smoke tests)")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--online", action="store_true", help="allow downloading the pinned checkpoint if missing")
    parser.add_argument("--no-compare", action="store_true", help="skip the base vs adapter comparison")
    parser.add_argument("--include-transcripts", action="store_true", help="write transcripts into the comparison reports")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    config = AdaptConfig(speaker=args.speaker)
    overrides = {k: v for k, v in {"epochs": args.epochs, "max_steps": args.max_steps, "seed": args.seed}.items() if v is not None}
    config = replace(config, **overrides)
    run_dir = CHECKPOINTS_DIR / args.run_name
    metadata = train(config, manifest=args.manifest, run_dir=run_dir, device=args.device, offline=not args.online)
    t = metadata["trainable"]
    print(f"Trained {metadata['train_steps']} steps in {metadata['train_seconds']} s on {metadata['device']}: "
          f"{t['trainable_parameters']:,} trainable of {t['total_parameters']:,} parameters.")
    print(f"Split: {len(metadata['split']['train_ids'])} train / {len(metadata['split']['validation_ids'])} validation "
          f"recordings (sentences {', '.join(metadata['split']['validation_sentences'])} held out).")
    for row in metadata["history"]:
        train_loss = "-" if row["train_loss"] is None else f"{row['train_loss']:.4f}"
        print(f"  epoch {row['epoch']:>2} step {row['step']:>3}  train {train_loss}  val {row['val_loss']:.4f}")
    print(f"Adapter: {run_dir / 'adapter'} (final epoch; best val-loss epoch {metadata['best_val_loss_epoch']} kept as a diagnostic)")
    if not args.no_compare:
        from ml.adaptation.compare import compare

        compare(run_dir, manifest=args.manifest, device=args.device, include_transcripts=args.include_transcripts)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
    for noisy in ("httpx", "httpx2", "huggingface_hub", "transformers", "torch", "peft"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    sys.exit(main())
