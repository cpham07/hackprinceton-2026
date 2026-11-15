"""Speaker adaptation (M4): split, label masking, freezing, adapter checkpoints, evaluation consistency.

No network and no download. Model tests use a tiny randomly initialised Whisper on CPU; the two tests that need
the real tokenizer or checkpoint are skipped unless the pinned M3 checkpoint is cached in ml/models/.
"""

import json
from pathlib import Path

import pytest

from ml.adaptation.config import AdaptConfig
from ml.adaptation.data import IGNORE_INDEX, sentence_key, split_speaker
from ml.dataset import Utterance

NAMES = ["Zeus is angry.", "Ask Athena.", "Hades waits.", "Ares fights.", "Lyra sings."]
PLAIN = ["The palace is closed.", "I am lost."]


def corpus(speakers=("xin", "kevin"), dev=20, test=10):
    rows = []
    for speaker in speakers:
        for n in range(1, dev + test + 1):
            text = PLAIN[n % 2] if n in (14, 16) else NAMES[n % len(NAMES)]
            rows.append(Utterance(f"{speaker}-{n:02d}", Path(f"/data/recordings/{speaker}/{n:02d}.m4a"), text, speaker,
                                  "dev" if n <= dev else "test"))
    return rows


# --- dataset splitting ----------------------------------------------------------------------------------------


def test_split_is_deterministic_disjoint_and_dev_only():
    rows = corpus()
    a = split_speaker(rows, "xin", n_validation=6, seed=1234)
    b = split_speaker(list(reversed(rows)), "xin", n_validation=6, seed=1234)
    assert a.as_dict() == b.as_dict()
    train_keys = {sentence_key(u) for u in a.train}
    assert len(a.train) == 14 and len(a.validation) == 6
    assert train_keys.isdisjoint(a.validation_keys)
    assert all(u.speaker_id == "xin" and u.split == "dev" for u in a.train + a.validation)
    assert split_speaker(rows, "xin", n_validation=6, seed=99).as_dict() != a.as_dict()


def test_split_keeps_a_sentence_without_names_in_validation():
    split = split_speaker(corpus(), "xin", n_validation=6, seed=1234)
    assert split.validation_keys & {"14", "16"}
    assert split.validation_keys - {"14", "16"}


def test_other_speaker_check_uses_only_held_out_sentences():
    rows = corpus()
    split = split_speaker(rows, "xin", n_validation=6, seed=1234)
    other = split.other_speaker_validation(rows)
    assert len(other) == 6 and {u.speaker_id for u in other} == {"kevin"}
    assert {sentence_key(u) for u in other} == split.validation_keys
    assert all(u.split == "dev" for u in other)


def test_split_refuses_bad_input():
    with pytest.raises(ValueError):
        split_speaker(corpus(), "nobody", n_validation=6, seed=1)
    with pytest.raises(ValueError):
        split_speaker(corpus(), "xin", n_validation=20, seed=1)
    rows = corpus() + [Utterance("xin-dup", Path("/data/recordings/xin/05.m4a"), "x", "xin", "dev")]
    with pytest.raises(ValueError):
        split_speaker(rows, "xin", n_validation=6, seed=1)


def test_split_record_has_ids_but_no_transcripts():
    record = json.dumps(split_speaker(corpus(), "xin", n_validation=6, seed=1).as_dict())
    assert not any(text in record for text in NAMES + PLAIN)


# --- tiny model helpers ---------------------------------------------------------------------------------------

torch = pytest.importorskip("torch")
pytest.importorskip("peft")
pytest.importorskip("transformers")

from ml.adaptation.data import pad_labels  # noqa: E402
from ml.adaptation.model import (  # noqa: E402
    AdapterCompatibilityError, apply_lora, check_compatibility, read_run, token_loss_sums, trainable_summary, write_run,
)

START, NO_TS, EOT = 50257, 50362, 50256


def tiny_model(seed=0):
    from transformers import WhisperConfig, WhisperForConditionalGeneration

    config = WhisperConfig(
        vocab_size=51864, num_mel_bins=80, d_model=32, encoder_layers=1, decoder_layers=1,
        encoder_attention_heads=2, decoder_attention_heads=2, encoder_ffn_dim=64, decoder_ffn_dim=64,
        max_source_positions=1500, max_target_positions=64,
        decoder_start_token_id=START, pad_token_id=EOT, eos_token_id=EOT, bos_token_id=EOT,
    )
    torch.manual_seed(seed)
    return WhisperForConditionalGeneration(config).eval()


def features(n=2, seed=1):
    return torch.randn(n, 80, 3000, generator=torch.Generator().manual_seed(seed))


LABELS = [[NO_TS, 400, 401, 402, 403, EOT], [NO_TS, 500, EOT]]


def tiny_config():
    return AdaptConfig(speaker="xin", lora_rank=4, lora_alpha=8, lora_dropout=0.0)


# --- label masking --------------------------------------------------------------------------------------------


def test_pad_labels_uses_the_ignore_index():
    padded = pad_labels(LABELS)
    assert padded.tolist()[1] == [NO_TS, 500, EOT, IGNORE_INDEX, IGNORE_INDEX, IGNORE_INDEX]


def test_padding_does_not_contribute_to_the_loss():
    model, feats = tiny_model(), features()
    with torch.no_grad():
        batch_sum, batch_count = token_loss_sums(model, feats, pad_labels(LABELS))
        singles = [token_loss_sums(model, feats[i : i + 1], pad_labels([LABELS[i]])) for i in range(2)]
        hf_mean = model(input_features=feats, labels=pad_labels(LABELS)).loss.item()
    assert batch_count == sum(len(l) for l in LABELS)
    assert batch_sum == pytest.approx(sum(s for s, _ in singles), rel=1e-5)
    assert hf_mean == pytest.approx(batch_sum / batch_count, rel=1e-5)  # the training loss masks padding too


def test_labels_from_the_real_tokenizer():
    from ml.adaptation.data import label_ids

    tokenizer = cached_tokenizer()
    ids = label_ids(tokenizer, "Zeus is angry.", START)
    tokens = tokenizer.convert_ids_to_tokens(ids)
    assert tokens[0] == "<|notimestamps|>" and tokens[-1] == "<|endoftext|>" and START not in ids
    assert tokens[1].startswith("Ġ")  # leading space, as Whisper itself emits the first word


# --- parameter freezing ---------------------------------------------------------------------------------------


def test_only_lora_parameters_train_and_base_weights_never_change():
    model = apply_lora(tiny_model(), tiny_config())
    summary = trainable_summary(model)
    assert summary["only_lora_trainable"] and summary["trainable_parameters"] > 0
    assert summary["trainable_parameters"] < summary["total_parameters"] / 20
    before = {n: p.detach().clone() for n, p in model.named_parameters()}
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=1e-2)
    model.train()
    model(input_features=features(), labels=pad_labels(LABELS)).loss.backward()
    optimizer.step()
    changed = {n for n, p in model.named_parameters() if not torch.equal(p, before[n])}
    assert changed and all("lora_" in n for n in changed)
    assert any("lora_B" in n for n in changed)


# --- adapter loading, inference, compatibility ---------------------------------------------------------------


def trained_adapter(tmp_path):
    model = apply_lora(tiny_model(), tiny_config())
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=1e-2)
    model.train()
    for _ in range(2):
        model(input_features=features(), labels=pad_labels(LABELS)).loss.backward()
        optimizer.step()
        optimizer.zero_grad()
    metadata = {"base_model": {"model_id": "openai/whisper-base.en", "revision": "911407f4214e0e1d82085af863093ec0b66f9cd6",
                               "weights_sha256": "a" * 64}}
    write_run(tmp_path / "run", model, metadata)
    return model.eval()


def test_saved_adapter_reloads_onto_a_fresh_base_with_identical_outputs(tmp_path):
    from peft import PeftModel

    trained = trained_adapter(tmp_path)
    reloaded = PeftModel.from_pretrained(tiny_model(), tmp_path / "run" / "adapter").eval()
    feats, labels = features(1, seed=7), pad_labels(LABELS[:1])
    with torch.no_grad():
        assert torch.allclose(trained(input_features=feats, labels=labels).logits,
                              reloaded(input_features=feats, labels=labels).logits, atol=1e-6)
        assert not torch.allclose(tiny_model()(input_features=feats, labels=labels).logits,
                                  reloaded(input_features=feats, labels=labels).logits, atol=1e-6)


def test_checkpoint_compatibility_is_enforced(tmp_path):
    trained_adapter(tmp_path)
    metadata = read_run(tmp_path / "run")
    rev = "911407f4214e0e1d82085af863093ec0b66f9cd6"
    check_compatibility(metadata, model_id="openai/whisper-base.en", revision=rev, base_sha256="a" * 64)
    with pytest.raises(AdapterCompatibilityError):
        check_compatibility(metadata, model_id="openai/whisper-tiny.en", revision=rev, base_sha256="a" * 64)
    with pytest.raises(AdapterCompatibilityError):
        check_compatibility(metadata, model_id="openai/whisper-base.en", revision="0" * 40, base_sha256="a" * 64)
    with pytest.raises(AdapterCompatibilityError):
        check_compatibility(metadata, model_id="openai/whisper-base.en", revision=rev, base_sha256="b" * 64)
    with pytest.raises(AdapterCompatibilityError):
        read_run(tmp_path / "missing")


def test_training_never_overwrites_a_run(tmp_path):
    from ml.adaptation.train import train

    (tmp_path / "existing").mkdir()
    with pytest.raises(FileExistsError):
        train(tiny_config(), manifest=tmp_path / "unused.jsonl", run_dir=tmp_path / "existing")


def test_comparison_refuses_a_manifest_that_changed_the_split(tmp_path):
    from ml.adaptation.compare import compare

    rows = corpus(speakers=("xin",))
    manifest = tmp_path / "manifest.jsonl"
    manifest.write_text("".join(json.dumps({"id": u.id, "audio_path": f"recordings/xin/{sentence_key(u)}.m4a",
                                            "transcript": u.transcript, "speaker_id": u.speaker_id, "split": u.split}) + "\n"
                                for u in rows))
    run = tmp_path / "run"
    run.mkdir()
    (run / "run.json").write_text(json.dumps({"config": AdaptConfig(speaker="xin").as_dict(),
                                              "split": {"train_ids": ["xin-01"], "validation_ids": ["xin-02"]}}))
    with pytest.raises(RuntimeError, match="no longer gives the split"):
        compare(run, manifest=manifest)


# --- evaluation consistency -----------------------------------------------------------------------------------


def test_an_untrained_adapter_is_exactly_the_base_model():
    base = tiny_model()
    adapted = apply_lora(tiny_model(), tiny_config()).eval()  # LoRA B starts at zero
    feats, labels = features(1, seed=3), pad_labels(LABELS[:1])
    with torch.no_grad():
        assert torch.equal(base(input_features=feats, labels=labels).logits, adapted(input_features=feats, labels=labels).logits)


def test_base_and_untrained_adapter_decode_identically_through_the_shared_transcriber():
    """Both conditions go through LocalWhisperTranscriber.transcribe_samples with identical settings."""
    import numpy as np

    from ml.local_asr import LocalWhisperTranscriber, load_pretrained

    try:
        processor, base, info, _ = load_pretrained(device="cpu", offline=True)
        _, other, _, _ = load_pretrained(device="cpu", offline=True)
    except Exception:  # noqa: BLE001
        pytest.skip("the pinned checkpoint is not cached in ml/models/")
    adapted = apply_lora(other, AdaptConfig(speaker="xin")).eval()
    t = np.arange(16000 * 2) / 16000
    samples = (0.1 * np.sin(2 * np.pi * 220 * t) * (t % 0.5 < 0.25)).astype(np.float32)
    a = LocalWhisperTranscriber.from_loaded(processor, base, info).transcribe_samples(samples)
    b = LocalWhisperTranscriber.from_loaded(processor, adapted, info).transcribe_samples(samples)
    assert a == b


def cached_tokenizer():
    from huggingface_hub import snapshot_download
    from transformers import WhisperTokenizer

    from ml.local_asr import CHECKPOINT_FILES, MODELS_DIR, PINNED_REVISIONS

    try:
        path = snapshot_download("openai/whisper-base.en", revision=PINNED_REVISIONS["openai/whisper-base.en"],
                                 cache_dir=MODELS_DIR, allow_patterns=CHECKPOINT_FILES, local_files_only=True)
    except Exception:  # noqa: BLE001
        pytest.skip("the pinned tokenizer is not cached in ml/models/")
    return WhisperTokenizer.from_pretrained(path)
