# ML milestone M1: ASR benchmark and mythology vocabulary

An offline evaluation of the speech recognition behind `POST /transcribe`, and one experiment: does giving the model the
game's mythology names as a prompt make it recognise them better, without hurting everything else?

Nothing here is used by the running server. `main.py` and `/transcribe` are unchanged; the benchmark calls the same
`speech.transcribe` function with a copy of the settings whose only difference is the prompt.

| Mode | Prompt sent to the provider |
| --- | --- |
| `baseline` | none (even if `TRANSCRIPTION_PROMPT` is set in `.env`) |
| `mythology_hints` | `Aphrodite, Athena, Ares, Hades, Zeus, Olympus, Argos, Theron, Lyra, Somnus, Master Lightning Bolt.` |

Both modes send the same bytes, model, language and temperature. Transcripts are scored as returned: nothing is
post-edited, and no sound-alike word ("Aries", "Lira") is ever mapped to a name. Mode order alternates per recording,
which spreads warm-up and caching effects across both modes.

## Commands (from `backend/`)

```bash
source .venv/bin/activate
pip install -r requirements-dev.txt

# Unit tests: mocked provider, no network, no cost.
pytest tests/test_ml_metrics.py tests/test_ml_dataset.py tests/test_ml_evaluate.py
pytest                                   # everything, including the existing backend tests

# Dry run (the default): validates the manifest and every audio file and prints how many requests --run would make.
python -m ml.benchmark --manifest ml/data/manifest.jsonl

# Real evaluation on the dev split: 2 provider requests per recording, billed to OPENAI_API_KEY in backend/.env.
python -m ml.benchmark --manifest ml/data/manifest.jsonl --run
python -m ml.benchmark --manifest ml/data/manifest.jsonl --run --limit 5     # cheap smoke test first

# Held-out test split: only once the hint prompt and settings are frozen.
python -m ml.benchmark --manifest ml/data/manifest.jsonl --split test --allow-test-split --run
```

Other options: `--out DIR` (default `ml/results/<UTC timestamp>-<split>/`), `--include-transcripts` (also writes the
reference and model transcripts to `results.json` for error analysis), `--assume-prompt-support` (for a model that is not on
the known list: `whisper*`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`; without it the benchmark refuses to run).

`ml/data/`, `ml/results/`, `ml/checkpoints/` and any audio file under `ml/` are git-ignored. Keep real manifests,
recordings and results there.

### Local scripted dataset (M1.5)

Three speakers each read the same 30 numbered sentences: `ml/data/recordings/<speaker>/01.m4a` … `30.m4a`, ids
`<speaker>-NN`, recordings 01–20 in `dev` and 21–30 in `test`. `python ml/data/build_manifest.py` (local, git-ignored)
writes `ml/data/manifest.jsonl` from the script and never overwrites an existing entry's transcript or tags, so it can
be re-run after hand corrections (`--check` reports without writing). The script text is not ground truth: every entry
starts with the tag `reference-unverified`. Listen to the recording, correct `transcript` to what was actually said,
then remove the tag.

## Recording format

- One utterance per file, spoken naturally, roughly 1–15 seconds. Any format `/transcribe` accepts: WebM/Opus, Ogg, MP4/M4A,
  MP3 or WAV, up to `MAX_AUDIO_BYTES` (10 MB). The format is detected from the bytes.
- Prefer recordings made the way the game records them (browser `MediaRecorder`, usually WebM/Opus), so the benchmark
  matches production conditions.
- Include sentences *without* mythology names, so you can see whether the hints hurt ordinary speech, and a few silence or
  room-noise clips with an empty transcript (`""`), so you can see whether the prompt gets echoed back as text.
- Speaker IDs are pseudonyms (`p01`). Only record people who agreed to it. Never commit recordings.

## Manifest (JSONL, one object per line)

```json
{"id": "p01-dev-001", "audio_path": "recordings/p01/dev-001.webm", "transcript": "Somnus, let the heavens dream.", "speaker_id": "p01", "split": "dev"}
{"id": "p01-dev-005", "audio_path": "recordings/p01/dev-005.webm", "transcript": "", "speaker_id": "p01", "split": "dev", "tags": ["silence"]}
```

| Field | Rule |
| --- | --- |
| `id` | unique |
| `audio_path` | relative to the manifest's folder and inside it |
| `transcript` | exactly what was said, numbers written as words; `""` for silence |
| `speaker_id` | pseudonym |
| `split` | `dev` (tune freely) or `test` (held out); one recording cannot be in both |
| `tags` | optional list of strings |

Unknown fields are rejected, to catch typos. `ml/examples/manifest.example.jsonl` shows the format. Its audio files do
not exist: it is an example, not a dataset. A suggested layout:

```
backend/ml/data/manifest.jsonl
backend/ml/data/recordings/p01/dev-001.webm
```

## Local pretrained Whisper (M3)

An unmodified local checkpoint as a second transcriber, scored by the same code (`ml.evaluate`, baseline mode only,
no prompt). Not used by `/transcribe`.

```bash
pip install -r requirements-ml.txt            # torch 2.15.0 + transformers 5.23.0 (~1 GB in .venv)
python -m ml.local_benchmark --manifest ml/data/manifest.jsonl --limit 1              # smoke test; first run downloads ~290 MB
python -m ml.local_benchmark --manifest ml/data/manifest.jsonl --offline --include-transcripts   # 60 dev recordings
python -m ml.local_benchmark --manifest ml/data/manifest.jsonl --offline --device cpu  # same model on CPU
```

- Models: `openai/whisper-base.en` (default) or `openai/whisper-tiny.en`, each pinned to a commit in `ml/local_asr.py`
  (`PINNED_REVISIONS`). Only `model.safetensors` and config/tokenizer files are downloaded, into `ml/models/` (git-ignored).
- `--device auto` uses PyTorch MPS when available. The report records where the weights actually were (`mps:0` or `cpu`).
- Audio is decoded with macOS `afconvert` to 16 kHz mono (no ffmpeg); recordings are never modified.
- Greedy decoding. One untimed warm-up transcription precedes the run (`--warmup`). The report's `local_model` section has
  model-only latency; the summary latency also includes audio decoding.
- `--speakers charles xin` restricts the run. The test split needs `--allow-test-split`, as in the hosted benchmark.

## Metrics

- **WER**: word-level Levenshtein, (S + D + I) / reference words, after normalization (case, punctuation, accents and
  hyphens are ignored; edge apostrophes dropped). Corpus WER sums the counts over utterances. A silence clip has no
  per-utterance WER, but any words the model outputs there count as insertions in the corpus total.
- **Name accuracy**: occurrences of vocabulary names in the reference that also appear in the hypothesis (per name,
  order-independent; possessives count as the name; "Master Lightning Bolt" only when complete). **Names inserted**
  counts names the model output that were not said, which is how over-eager hints show up.
- **Latency**: wall-clock time per provider call (mean, p50, p90, max). It is mostly network and provider time, so compare
  modes within one run, not across days.
- **Paired comparison**: only recordings where both modes succeeded, with deltas and a per-recording count of
  fewer/more/same errors. Under 30 recordings the summary marks the difference as anecdotal.

Failures are recorded, not hidden: a missing or invalid file gets no provider call, and a failed request fails only that
mode for that recording (it then drops out of the paired comparison).

## Honesty and privacy

- Every `results.json` has `"measurement": "real_provider"` or `"mock"`; mock reports also carry a warning that is
  repeated in `summary.md`. The unit tests are mock runs. They check the plumbing and the scoring, not any speech model.
- Provider calls happen only with `--run`. API keys stay in `backend/.env` and never appear in results.
- Neither audio nor transcripts are logged; logs carry ids, counts and status codes. Transcripts reach `results.json` only
  with `--include-transcripts`.
- No real measurements have been made yet: there are no numbers in this repository.
