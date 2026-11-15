"""Experimental speaker-specific adaptation of the local Whisper checkpoint with LoRA (milestone M4).

Offline research code: nothing here is imported by the server. It reuses ml.local_asr (pinned checkpoint, processor,
audio decoding, decoding settings), ml.dataset (manifest) and ml.evaluate / ml.metrics (scoring) unchanged.

- config.py:  the training configuration (fixed before any validation result is seen)
- data.py:    speaker split (sentence-disjoint, dev only), label preparation and padding
- model.py:   LoRA injection, loss, adapter checkpoints and their compatibility checks
- train.py:   `python -m ml.adaptation.train`   trains one speaker's adapter, then runs the comparison
- compare.py: `python -m ml.adaptation.compare` base vs base+adapter on held-out dev recordings

Adapters are written to ml/checkpoints/ (git-ignored). The pretrained checkpoint in ml/models/ is never written.
"""
