"""Training configuration. The defaults were fixed before any validation result was seen, and are not tuned on it.

Conservative on purpose (about 14 training recordings): small rank, attention query/value projections only,
a short schedule with warm-up and linear decay, gradient clipping, and the final epoch as the pre-specified
checkpoint (the best-validation-loss epoch is saved too, but only as a diagnostic).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from ml.local_asr import DEFAULT_MODEL


@dataclass(frozen=True)
class AdaptConfig:
    speaker: str
    model_id: str = DEFAULT_MODEL
    seed: int = 1234
    # split (dev recordings of `speaker` only; sentence-disjoint)
    n_validation: int = 6
    # LoRA
    lora_rank: int = 8
    lora_alpha: int = 16
    lora_dropout: float = 0.1
    target_modules: tuple[str, ...] = ("q_proj", "v_proj")
    # optimisation
    learning_rate: float = 5e-4
    weight_decay: float = 0.0
    batch_size: int = 4
    epochs: int = 10
    warmup_steps: int = 4
    max_grad_norm: float = 1.0
    max_steps: int | None = None  # smoke tests only
    extra: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["target_modules"] = list(self.target_modules)
        return data
