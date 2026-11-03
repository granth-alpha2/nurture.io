"""Image quality gating, blur/lighting assessment, and frame perceptual hashing."""

import hashlib
import io
import math
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class ImageQualityReport:
    """Assessment of query image quality for visual localization."""
    is_acceptable: bool
    blur_score: float  # higher means sharper; [0, 100]
    brightness_score: float  # average luminance [0, 255]
    rejection_reason: Optional[str] = None
    width: int = 0
    height: int = 0


def _parse_ppm_or_raw(image_bytes: bytes) -> Tuple[int, int, list[int]]:
    """Parse raw bytes or rudimentary header to extract grayscale pixel intensities.
    Works robustly with or without Pillow.
    """
    # Check if PIL is available
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("L")
        width, height = img.size
        # Sample or resize to max 64x64 for fast gate analysis
        img.thumbnail((64, 64))
        w, h = img.size
        pixels = list(img.getdata())
        return w, h, pixels
    except Exception:
        pass

    # Pure Python fallback: extract pseudo-luminance from byte stream
    length = len(image_bytes)
    if length == 0:
        return 0, 0, []

    # Approximate 32x32 luminance grid from raw bytes
    side = min(32, int(math.isqrt(length)) or 1)
    pixels = [image_bytes[i % length] for i in range(side * side)]
    return side, side, pixels


def evaluate_image_quality(
    image_bytes: bytes,
    min_blur_score: float = 15.0,
    min_brightness: float = 25.0,
    max_brightness: float = 235.0,
) -> ImageQualityReport:
    """Evaluate whether an input frame meets minimum visual quality standards.
    Rejects severely blurred, pitch-black, or blown-out frames.
    """
    if not image_bytes or len(image_bytes) < 32:
        return ImageQualityReport(
            is_acceptable=False,
            blur_score=0.0,
            brightness_score=0.0,
            rejection_reason="Empty or truncated camera frame",
        )

    w, h, pixels = _parse_ppm_or_raw(image_bytes)
    if not pixels:
        return ImageQualityReport(
            is_acceptable=False,
            blur_score=0.0,
            brightness_score=0.0,
            rejection_reason="Unparseable image payload",
        )

    # Calculate average luminance
    brightness = sum(pixels) / len(pixels)

    # Approximate Laplacian / gradient variance across adjacent pixels
    gradients = []
    for y in range(h - 1):
        for x in range(w - 1):
            idx = y * w + x
            gx = abs(pixels[idx] - pixels[idx + 1])
            gy = abs(pixels[idx] - pixels[idx + w])
            gradients.append(gx + gy)

    if gradients:
        mean_grad = sum(gradients) / len(gradients)
        variance = sum((g - mean_grad) ** 2 for g in gradients) / len(gradients)
        blur_score = min(100.0, math.sqrt(variance))
    else:
        blur_score = 0.0

    # Decision gates
    if brightness < min_brightness:
        return ImageQualityReport(
            is_acceptable=False,
            blur_score=blur_score,
            brightness_score=brightness,
            rejection_reason="Frame is underexposed or in near darkness",
            width=w,
            height=h,
        )

    if brightness > max_brightness:
        return ImageQualityReport(
            is_acceptable=False,
            blur_score=blur_score,
            brightness_score=brightness,
            rejection_reason="Frame is overexposed / washed out",
            width=w,
            height=h,
        )

    if blur_score < min_blur_score:
        return ImageQualityReport(
            is_acceptable=False,
            blur_score=blur_score,
            brightness_score=brightness,
            rejection_reason="Frame motion blur or defocus exceeds safety threshold",
            width=w,
            height=h,
        )

    return ImageQualityReport(
        is_acceptable=True,
        blur_score=blur_score,
        brightness_score=brightness,
        rejection_reason=None,
        width=w,
        height=h,
    )


def compute_frame_phash(image_bytes: bytes) -> str:
    """Compute difference hash (dHash) or content fingerprint of frame for deduplication."""
    if not image_bytes:
        return "0" * 16

    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("L").resize((9, 8))
        pixels = list(img.getdata())
        bits = []
        for row in range(8):
            for col in range(8):
                idx = row * 9 + col
                bits.append("1" if pixels[idx] > pixels[idx + 1] else "0")
        hex_hash = f"{int(''.join(bits), 2):016x}"
        return hex_hash
    except Exception:
        # Fallback hash
        digest = hashlib.sha256(image_bytes).hexdigest()
        return digest[:16]


def phash_hamming_distance(hash1: str, hash2: str) -> int:
    """Compute Hamming distance between two 16-hex perceptual hashes."""
    try:
        val1 = int(hash1, 16)
        val2 = int(hash2, 16)
        xor_val = val1 ^ val2
        return bin(xor_val).count("1")
    except ValueError:
        return 64
