"""Offline ASR evaluation and experiments. Nothing here is imported by the production server (main.py).

- vocabulary.py: the game's mythology names and the vocabulary hint prompt
- metrics.py:    text normalization, word error rate, mythology-name accuracy, latency statistics
- dataset.py:    the JSONL evaluation manifest (audio path, transcript, speaker, split)
- asr.py:        baseline vs mythology-hint transcription through the existing provider code
- evaluate.py:   runs both modes on the same recordings, aggregates, writes JSON and Markdown
- benchmark.py:  command line (`python -m ml.benchmark`); provider calls need an explicit --run

See ml/README.md.
"""
