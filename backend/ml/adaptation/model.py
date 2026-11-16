"""LoRA injection, the teacher-forced loss, and adapter checkpoints.

An adapter run folder (under ml/checkpoints/, git-ignored) holds:
    adapter/                  PEFT adapter (adapter_config.json + adapter_model.safetensors): the final epoch
    best_val_loss/adapter/    diagnostic only: the epoch with the lowest validation loss
    run.json                  base model id + pinned revision + sha256 of the base weights, config, split ids,
                              loss history, library versions, device, duration (no transcripts, no audio)
Loading checks run.json against the pinned revision and the base weights on disk, so an adapter can only be
applied to the exact checkpoint it was trained on.
"""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path
from typing import Any, Iterable

from ml.adaptation.config import AdaptConfig
from ml.adaptation.data import IGNORE_INDEX
from ml.local_asr import PINNED_REVISIONS

RUN_FILE = "run.json"
ADAPTER_DIR = "adapter"
CHECKPOINTS_DIR = Path(__file__).resolve().parent.parent / "checkpoints"


class AdapterCompatibilityError(RuntimeError):
    pass


def set_seed(seed: int) -> None:
    import numpy as np
    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)  # also seeds MPS


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def apply_lora(model: Any, config: AdaptConfig) -> Any:
    """Freeze every base weight and add trainable LoRA matrices to the target attention projections."""
    from peft import LoraConfig, get_peft_model

    for parameter in model.parameters():
        parameter.requires_grad_(False)
    lora = LoraConfig(
        r=config.lora_rank,
        lora_alpha=config.lora_alpha,
        lora_dropout=config.lora_dropout,
        target_modules=list(config.target_modules),
        bias="none",
    )
    return get_peft_model(model, lora)


def trainable_summary(model: Any) -> dict[str, int | bool]:
    trainable = [(n, p) for n, p in model.named_parameters() if p.requires_grad]
    return {
        "trainable_parameters": sum(p.numel() for _, p in trainable),
        "total_parameters": sum(p.numel() for p in model.parameters()),
        "trainable_tensors": len(trainable),
        "only_lora_trainable": all("lora_" in n for n, _ in trainable),
    }


def token_loss_sums(model: Any, features: Any, labels: Any) -> tuple[float, int]:
    """Teacher-forced cross-entropy summed over real label tokens, and their count (padding excluded).

    The model builds its decoder inputs by shifting `labels` right behind <|startoftranscript|>.
    """
    import torch
    import torch.nn.functional as F

    logits = model(input_features=features, labels=labels).logits
    loss = F.cross_entropy(logits.reshape(-1, logits.shape[-1]).float(), labels.reshape(-1), ignore_index=IGNORE_INDEX, reduction="sum")
    return float(loss.item()), int((labels != IGNORE_INDEX).sum().item())


def mean_token_loss(model: Any, batches: Iterable[tuple[Any, Any]]) -> float | None:
    """Token-weighted mean loss over (features, labels) batches, in eval mode and without gradients."""
    import torch

    was_training = model.training
    model.eval()
    total, count = 0.0, 0
    with torch.no_grad():
        for features, labels in batches:
            loss, n = token_loss_sums(model, features, labels)
            total, count = total + loss, count + n
    model.train(was_training)
    return total / count if count else None


# --- checkpoints ---------------------------------------------------------------------------------------------


def write_run(run_dir: Path, model: Any, metadata: dict[str, Any], *, subdir: str = ADAPTER_DIR) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(run_dir / subdir)
    (run_dir / RUN_FILE).write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


def read_run(run_dir: Path) -> dict[str, Any]:
    path = run_dir / RUN_FILE
    if not path.is_file():
        raise AdapterCompatibilityError(f"{run_dir} has no {RUN_FILE}; not an adapter run folder")
    return json.loads(path.read_text(encoding="utf-8"))


def check_compatibility(metadata: dict[str, Any], *, model_id: str, revision: str, base_sha256: str) -> None:
    """Refuse an adapter trained on anything but this exact, unmodified pinned checkpoint."""
    base = metadata.get("base_model", {})
    if base.get("model_id") != model_id:
        raise AdapterCompatibilityError(f"adapter was trained on {base.get('model_id')!r}, not {model_id!r}")
    if base.get("revision") != revision or PINNED_REVISIONS.get(model_id) != revision:
        raise AdapterCompatibilityError("adapter was trained on a different checkpoint revision than the pinned one")
    if base.get("weights_sha256") != base_sha256:
        raise AdapterCompatibilityError("the base weights on disk differ from the ones the adapter was trained on")


def load_adapted(run_dir: Path, *, device: str = "auto", offline: bool = True, subdir: str = ADAPTER_DIR) -> tuple[Any, Any, Any, dict]:
    """(processor, base model + adapter in eval mode, info, run metadata) after the compatibility checks."""
    from peft import PeftModel

    from ml.local_asr import load_pretrained

    metadata = read_run(run_dir)
    model_id = metadata.get("base_model", {}).get("model_id", "")
    if model_id not in PINNED_REVISIONS:
        raise AdapterCompatibilityError(f"unknown base model {model_id!r}")
    processor, model, info, path = load_pretrained(model_id, device=device, offline=offline)
    check_compatibility(metadata, model_id=model_id, revision=info.revision, base_sha256=file_sha256(path / "model.safetensors"))
    adapted = PeftModel.from_pretrained(model, run_dir / subdir).eval()
    for parameter in adapted.parameters():
        parameter.requires_grad_(False)
    return processor, adapted, info, metadata
