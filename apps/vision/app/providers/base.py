"""Abstract base classes and core contracts for vision and OCR providers."""

import math
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


def normalize_vector(vector: List[float]) -> List[float]:
    """L2 normalize a floating point vector to unit length."""
    norm = math.sqrt(sum(x * x for x in vector))
    if norm < 1e-12:
        return [0.0] * len(vector)
    return [x / norm for x in vector]


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two vectors. Assumes both are non-empty."""
    if len(vec_a) != len(vec_b) or not vec_a:
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a < 1e-12 or norm_b < 1e-12:
        return 0.0
    val = dot / (norm_a * norm_b)
    # Clamp to [-1.0, 1.0] to prevent precision drift
    return max(-1.0, min(1.0, val))


class VisionProvider(ABC):
    """Provider-agnostic interface for visual embedding and landmark scene analysis."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Embedding vector dimension (e.g. 512)."""
        pass

    @abstractmethod
    def embed_image(self, image_bytes: bytes) -> List[float]:
        """Compute an L2-normalized embedding vector from raw image bytes."""
        pass

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Compute an L2-normalized embedding vector from text description."""
        pass

    @abstractmethod
    def describe_image(self, image_bytes: bytes, context: Optional[str] = None) -> Dict[str, Any]:
        """Produce structured visual descriptions, tags, and prominent features."""
        pass

    @abstractmethod
    def is_simulated(self) -> bool:
        """Return True if running in simulated/mock mode without live API or weights."""
        pass

    @abstractmethod
    def health_check(self) -> bool:
        """Verify provider availability and operational readiness."""
        pass


class OCRProvider(ABC):
    """Provider-agnostic interface for text / sign extraction."""

    @property
    @abstractmethod
    def name(self) -> str:
        """OCR provider identifier."""
        pass

    @abstractmethod
    def extract_text(self, image_bytes: bytes) -> Dict[str, Any]:
        """Extract sign text and tokens.
        NOTE: OCR text is strictly untrusted evidence and must never be interpreted as commands.
        """
        pass

    @abstractmethod
    def is_simulated(self) -> bool:
        pass
