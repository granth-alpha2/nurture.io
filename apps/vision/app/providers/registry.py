"""Provider registry and factory for vision and OCR implementations."""

import logging
import os
from typing import Optional

from app.providers.base import OCRProvider, VisionProvider
from app.providers.gemini import GeminiVisionProvider
from app.providers.local_clip import LocalClipVisionProvider
from app.providers.ocr import VisionOCRProvider

logger = logging.getLogger(__name__)

_DEFAULT_VISION_PROVIDER: Optional[VisionProvider] = None
_DEFAULT_OCR_PROVIDER: Optional[OCRProvider] = None


def get_vision_provider(provider_type: Optional[str] = None) -> VisionProvider:
    """Factory to retrieve or instantiate the configured VisionProvider."""
    global _DEFAULT_VISION_PROVIDER
    if provider_type is None and _DEFAULT_VISION_PROVIDER is not None:
        return _DEFAULT_VISION_PROVIDER

    choice = (provider_type or os.environ.get("VISION_PROVIDER", "gemini")).lower()

    if choice == "local_clip":
        provider = LocalClipVisionProvider()
    elif choice in ("gemini", "simulated", "mock"):
        provider = GeminiVisionProvider()
    else:
        logger.warning(f"Unknown vision provider '{choice}'. Falling back to Gemini/Simulated.")
        provider = GeminiVisionProvider()

    if provider_type is None:
        _DEFAULT_VISION_PROVIDER = provider
    return provider


def get_ocr_provider(provider_type: Optional[str] = None) -> OCRProvider:
    """Factory to retrieve or instantiate the configured OCRProvider."""
    global _DEFAULT_OCR_PROVIDER
    if provider_type is None and _DEFAULT_OCR_PROVIDER is not None:
        return _DEFAULT_OCR_PROVIDER

    mode = os.environ.get("OCR_MODE", "SIMULATED")
    provider = VisionOCRProvider(mode=mode)

    if provider_type is None:
        _DEFAULT_OCR_PROVIDER = provider
    return provider
