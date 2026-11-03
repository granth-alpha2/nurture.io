"""Optical Character Recognition (OCR) provider with untrusted input sanitization."""

import logging
import re
from typing import Any, Dict, List, Optional, Set

from app.providers.base import OCRProvider

logger = logging.getLogger(__name__)

# Disallowed / dangerous substrings for prompt injection or system control
DISALLOWED_PATTERNS = [
    re.compile(r"ignore\s+all\s+previous", re.IGNORECASE),
    re.compile(r"system\s*:", re.IGNORECASE),
    re.compile(r"user\s*:", re.IGNORECASE),
    re.compile(r"instruction\s*:", re.IGNORECASE),
    re.compile(r"<[^>]+>", re.IGNORECASE),  # html tags
]


def sanitize_untrusted_text(raw_text: str, max_length: int = 256) -> str:
    """Sanitize OCR extracted text to eliminate control characters, prompt injections, and HTML tags.
    Treats OCR text strictly as passive perceptual evidence.
    """
    if not raw_text:
        return ""

    # Truncate
    text = raw_text[:max_length]

    # Neutralize potential prompt injection or system directive attempts
    for pat in DISALLOWED_PATTERNS:
        text = pat.sub("[REDACTED]", text)

    # Strip control characters except basic spaces
    cleaned = "".join(c for c in text if c.isprintable() or c in (" ", "\n"))
    return cleaned.strip()


def tokenize_text(text: str) -> List[str]:
    """Extract normalized alphanumeric word tokens for landmark matching."""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return [tok for tok in cleaned.split() if len(tok) >= 2]


def compute_token_match_ratio(tokens_a: List[str], tokens_b: List[str]) -> float:
    """Compute token Jaccard / overlap ratio between detected OCR and landmark reference tokens."""
    set_a = set(tok.lower() for tok in tokens_a)
    set_b = set(tok.lower() for tok in tokens_b)
    if not set_a or not set_b:
        return 0.0
    intersection = set_a.intersection(set_b)
    union = set_a.union(set_b)
    return len(intersection) / len(union)


class VisionOCRProvider(OCRProvider):
    """OCR service provider with strict untrusted-evidence sanitization.
    Supports Tesseract / EasyOCR if present; otherwise operates in SIMULATED mode.
    """

    def __init__(self, mode: str = "SIMULATED"):
        self._mode = mode
        self._tesseract_available = False
        try:
            import pytesseract  # type: ignore

            self._tesseract_available = True
        except ImportError:
            self._tesseract_available = False

    @property
    def name(self) -> str:
        return "vision_ocr"

    def is_simulated(self) -> bool:
        return not self._tesseract_available or self._mode == "SIMULATED"

    def extract_text(self, image_bytes: bytes) -> Dict[str, Any]:
        """Extract sign text from image frame as untrusted evidence."""
        if self.is_simulated():
            # In simulated mode, parse any simulated embedded watermark or mock text
            # Or return simulated signage
            simulated_text = "SIMULATED CAFE CENTRAL MAIN ENTRANCE"
            sanitized = sanitize_untrusted_text(simulated_text)
            tokens = tokenize_text(sanitized)
            return {
                "raw_text": sanitized,
                "tokens": tokens,
                "confidence": 0.88,
                "is_simulated": True,
                "safety_cleared": True,
            }

        # Production path using pytesseract
        try:
            import io
            import pytesseract  # type: ignore
            from PIL import Image

            image = Image.open(io.BytesIO(image_bytes))
            raw_text = pytesseract.image_to_string(image)
            sanitized = sanitize_untrusted_text(raw_text)
            tokens = tokenize_text(sanitized)
            return {
                "raw_text": sanitized,
                "tokens": tokens,
                "confidence": 0.75,
                "is_simulated": False,
                "safety_cleared": True,
            }
        except Exception as e:
            logger.warning(f"OCR extraction failed ({e}); returning empty evidence.")
            return {
                "raw_text": "",
                "tokens": [],
                "confidence": 0.0,
                "is_simulated": True,
                "safety_cleared": True,
            }
