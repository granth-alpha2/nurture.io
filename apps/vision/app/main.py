"""LandmarkNav Vision Service API.
Supports Phase 3 Vision & ML Pipeline, provider-agnostic embeddings,
pgvector spatial landmark ingestion, Redis tile candidate cache,
confidence calibration, and evaluation harness.
"""

import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.pipeline.cache import (
    default_tile_cache,
    prefetch_route_corridor,
    retrieve_candidates,
)
from app.pipeline.calibration import compute_ece, default_calibrator
from app.pipeline.engine import VisionLocalizationEngine
from app.pipeline.evaluation import evaluate_matcher, generate_benchmark_dataset
from app.pipeline.ingestion import (
    LicenseVerificationError,
    default_landmark_store,
    ingest_landmark,
)
from app.providers.registry import get_ocr_provider, get_vision_provider
from app.schemas.models import LandmarkProvenance

MODE = os.environ.get("VISION_MODE", "SIMULATED")
FEATURE_VISUAL_LOCALIZATION = (
    os.environ.get("FEATURE_VISUAL_LOCALIZATION", "false").lower() in ("true", "1")
)

app = FastAPI(
    title="LandmarkNav Vision Service",
    version="0.3.0",
    description="Phase 3 Vision & ML Pipeline Service.",
)

# Engine instance
engine = VisionLocalizationEngine()


@app.get("/healthz")
def health() -> dict[str, str]:
    recognition_status = "active_simulated" if FEATURE_VISUAL_LOCALIZATION else "disabled"
    return {
        "status": "ok",
        "mode": "SIMULATED",
        "recognition": "disabled" if not FEATURE_VISUAL_LOCALIZATION else "active_simulated",
        "provider": get_vision_provider().name,
        "ocr": get_ocr_provider().name,
    }


@app.get("/readyz")
def ready() -> dict[str, Any]:
    return {
        "status": "ready",
        "mode": "SIMULATED",
        "recognition": "disabled" if not FEATURE_VISUAL_LOCALIZATION else "active_simulated",
        "redis_connected": default_tile_cache.is_redis_connected(),
        "landmarks_in_memory": default_landmark_store.count(),
    }


class LocalizePayload(BaseModel):
    sessionId: str = "default_session"
    location: Optional[Dict[str, float]] = None
    horizontalAccuracyMeters: float = 10.0
    headingDegrees: Optional[float] = 0.0
    routeStepSequence: Optional[int] = 0
    visualConsent: bool = True
    frameBase64: Optional[str] = None
    featureVector: Optional[List[float]] = None
    nextManeuver: Optional[str] = "straight"


@app.post("/v1/localize")
async def localize(
    request: Request,
    x_request_id: Optional[str] = Header(None, alias="x-request-id"),
    x_enable_visual: Optional[str] = Header(None, alias="x-enable-visual"),
) -> JSONResponse:
    req_id = x_request_id or "unknown"
    enable_visual = FEATURE_VISUAL_LOCALIZATION or (x_enable_visual == "true")

    # If visual recognition is disabled, maintain strict Phase 1 contract fallback
    if not enable_visual:
        return JSONResponse(
            status_code=503,
            media_type="application/problem+json",
            content={
                "type": "https://landmarknav.invalid/problems/feature-unavailable",
                "title": "Visual localization unavailable",
                "status": 503,
                "detail": "Phase 1 is GPS-only. No image or visual feature was processed.",
                "requestId": req_id,
                "mode": "SIMULATED",
            },
        )

    try:
        body = await request.json()
    except Exception:
        body = {}

    loc = body.get("location") or {"latitude": 37.7749, "longitude": -122.4194}
    lat = loc.get("latitude", 37.7749)
    lon = loc.get("longitude", -122.4194)

    estimate = engine.process(
        session_id=body.get("sessionId", "session_1"),
        user_lat=lat,
        user_lon=lon,
        horizontal_accuracy_meters=body.get("horizontalAccuracyMeters", 10.0),
        heading_deg=body.get("headingDegrees", 0.0),
        image_base64=body.get("frameBase64"),
        feature_vector=body.get("featureVector"),
        route_step_sequence=body.get("routeStepSequence", 0),
        next_maneuver=body.get("nextManeuver", "straight"),
        visual_consent=body.get("visualConsent", True),
    )

    return JSONResponse(status_code=200, content=estimate.to_dict())


class IngestPayload(BaseModel):
    landmark_id: str
    name: str
    latitude: float
    longitude: float
    license: str = "SIMULATED"
    source: str = "synthetic_seed"
    attribution: str = "LandmarkNav"
    text_description: Optional[str] = None
    ocr_tokens: List[str] = []
    visual_tags: List[str] = []


@app.post("/v1/ingest")
async def ingest_landmark_endpoint(payload: IngestPayload) -> JSONResponse:
    """Ingest a landmark into the spatial reference store with license verification."""
    provenance = LandmarkProvenance(
        license=payload.license,
        source=payload.source,
        attribution=payload.attribution,
        is_simulated=True,
    )

    try:
        record = ingest_landmark(
            landmark_id=payload.landmark_id,
            name=payload.name,
            latitude=payload.latitude,
            longitude=payload.longitude,
            provenance=provenance,
            text_description=payload.text_description,
            ocr_tokens=payload.ocr_tokens,
            visual_tags=payload.visual_tags,
        )
        return JSONResponse(status_code=201, content=record.to_dict())
    except LicenseVerificationError as e:
        return JSONResponse(
            status_code=403,
            media_type="application/problem+json",
            content={
                "type": "https://landmarknav.invalid/problems/license-violation",
                "title": "Persistent reference license forbidden",
                "status": 403,
                "detail": str(e),
                "mode": "SIMULATED",
            },
        )


class PrefetchPayload(BaseModel):
    polyline: List[List[float]]  # list of [lat, lon]


@app.post("/v1/prefetch")
async def prefetch_route_endpoint(payload: PrefetchPayload) -> JSONResponse:
    """Prefetch route corridor tiles into Redis candidate cache."""
    points = [(p[0], p[1]) for p in payload.polyline if len(p) >= 2]
    num_tiles = prefetch_route_corridor(points)
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "corridor_tiles_prewarmed": num_tiles, "mode": "SIMULATED"},
    )


@app.post("/v1/evaluate")
async def evaluate_pipeline_endpoint() -> JSONResponse:
    """Run evaluation benchmark harness across conditions, computing ECE & safety metrics."""
    report = evaluate_matcher(engine.matcher)
    return JSONResponse(status_code=200, content=report.to_dict())
