# LandmarkNav Vision Service

## Overview

The Vision Service provides pluggable, provider-agnostic visual recognition, landmark embedding, spatial candidate caching, and confidence calibration for pedestrian navigation.

All stubs, offline models, and mock providers are strictly marked `SIMULATED` per `AGENTS.md`. Visual recognition instructions remain feature-flagged under `FEATURE_VISUAL_LOCALIZATION` until field evaluation gates pass.

---

## Architecture & Components

### 1. Vision Providers (`app/providers/`)
- `base.py`: Abstract `VisionProvider` and `OCRProvider` interfaces; normalized vector cosine similarities.
- `gemini.py`: Multimodal vision provider supporting Gemini 1.5 Flash with automatic `SIMULATED` fallback when API credentials are not set.
- `local_clip.py`: Local OpenCLIP / ViT-B/32 provider with deterministic unit-norm `SIMULATED` embedding fallback when weights are absent.
- `ocr.py`: Untrusted OCR text extraction and token matching. Strips control characters, script tags, and prompt injection patterns. OCR text is strictly treated as passive evidence.
- `registry.py`: Factory for dependency injection based on `VISION_PROVIDER` and `OCR_MODE`.

### 2. Ingestion Pipeline (`app/pipeline/ingestion.py`)
- License verification: fail-closed on unknown or Google-derived persistent imagery (`LicenseVerificationError`).
- Reference image quality evaluation: rejects blurred, overexposed, or underexposed reference imagery.
- Spatial indexing: Geohash (precision 7) and H3 (resolution 9) discrete cell indices.
- Database persistence: PostgreSQL with `postgis` Point geometry and `pgvector` with HNSW cosine similarity index (`m = 16, ef_construction = 64`).

### 3. Tile Candidate Cache & Corridor Prefetching (`app/pipeline/cache.py`)
- Redis candidate cache partitioned by spatial cell + 8-way heading buckets (`landmarknav:tile:{tile}:{bucket}`).
- Sub-15ms candidate retrieval along route steps.
- Route-corridor prefetching: pre-warms candidate tiles along a walking route polyline at route-creation time.
- Frame deduplication: perceptual hash (`dHash`) with Hamming distance comparison and match result memoization.

### 4. False-Confident-Match Rejection Gates (`app/pipeline/matcher.py`)
- **Gate 1**: Absolute similarity floor ($\ge 0.70$).
- **Gate 2**: Top-2 margin ambiguity rejection ($\Delta_{\text{margin}} \ge 0.08$) to prevent false confident misidentification between lookalike storefronts.
- **Gate 3**: Spatial line-of-sight distance ($\le 150\text{m}$) and forward viewing cone ($\pm 60^\circ$).
- **Gate 4**: Input frame quality check (sharpness and luminance bounds).

### 5. Confidence Calibration & Evaluation Harness (`app/pipeline/calibration.py`, `app/pipeline/evaluation.py`)
- Expected Calibration Error (ECE) and Maximum Calibration Error (MCE) computation across $M=10$ bins.
- Temperature scaling / Platt logistic calibration.
- Multi-condition evaluation harness spanning daytime, dusk/night, occluded, lookalike, and distractor conditions.
- Primary safety metric: False-Confident-Match Rate strictly $< 1.0\%$.

---

## Running Tests

Run the Python unit test suite:
```powershell
$env:PYTHONPATH = "apps/vision"
python -m unittest discover -s apps/vision/tests -p "test_*.py" -v
```
