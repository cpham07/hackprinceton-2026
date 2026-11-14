"""Audio similarity via embeddings."""

import math


def embed(audio_bytes: bytes) -> list[float]:
    """Turn raw audio into an embedding vector."""
    raise NotImplementedError


def similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two embedding vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0
