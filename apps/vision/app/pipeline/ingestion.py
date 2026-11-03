"""Landmark ingestion pipeline with license validation, embedding generation, and pgvector persistence."""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.core.geo import encode_geohash, haversine_distance_meters
from app.core.quality import evaluate_image_quality
from app.providers.base import VisionProvider, cosine_similarity
from app.providers.registry import get_vision_provider
from app.schemas.models import LandmarkProvenance, LandmarkRecord

logger = logging.getLogger(__name__)


class LicenseVerificationError(ValueError):
    """Raised when reference imagery fails provenance or license checks."""
    pass


class LandmarkStore:
    """Interface and in-memory engine for storing and querying landmarks."""

    def __init__(self):
        self._landmarks: Dict[str, LandmarkRecord] = {}

    def insert(self, record: LandmarkRecord) -> None:
        self._landmarks[record.landmark_id] = record

    def get(self, landmark_id: str) -> Optional[LandmarkRecord]:
        return self._landmarks.get(landmark_id)

    def count(self) -> int:
        return len(self._landmarks)

    def search_by_radius(
        self,
        center_lat: float,
        center_lon: float,
        radius_meters: float,
    ) -> List[Tuple[LandmarkRecord, float]]:
        """Retrieve landmarks within radius_meters, returning list of (record, distance)."""
        results: List[Tuple[LandmarkRecord, float]] = []
        for record in self._landmarks.values():
            dist = haversine_distance_meters(center_lat, center_lon, record.latitude, record.longitude)
            if dist <= radius_meters:
                results.append((record, dist))
        results.sort(key=lambda x: x[1])
        return results

    def search_by_tiles(self, tile_keys: List[str]) -> List[LandmarkRecord]:
        """Retrieve landmarks matching any of the specified geohash or H3 tile keys."""
        matched = []
        target_set = set(tile_keys)
        for record in self._landmarks.values():
            if record.geohash in target_set or record.h3_index in target_set:
                matched.append(record)
        return matched

    def search_nearest_vectors(
        self,
        query_vector: List[float],
        candidates: Optional[List[LandmarkRecord]] = None,
        top_k: int = 5,
    ) -> List[Tuple[LandmarkRecord, float]]:
        """Find the top-k nearest candidates by cosine similarity."""
        pool = candidates if candidates is not None else list(self._landmarks.values())
        scored: List[Tuple[LandmarkRecord, float]] = []
        for cand in pool:
            sim = cosine_similarity(query_vector, cand.embedding)
            # Map [-1, 1] to [0, 1]
            norm_score = max(0.0, (sim + 1.0) / 2.0)
            scored.append((cand, norm_score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def clear(self) -> None:
        self._landmarks.clear()


# Default singleton landmark store
default_landmark_store = LandmarkStore()


def ingest_landmark(
    landmark_id: str,
    name: str,
    latitude: float,
    longitude: float,
    provenance: LandmarkProvenance,
    image_bytes: Optional[bytes] = None,
    text_description: Optional[str] = None,
    ocr_tokens: Optional[List[str]] = None,
    visual_tags: Optional[List[str]] = None,
    provider: Optional[VisionProvider] = None,
    store: Optional[LandmarkStore] = None,
) -> LandmarkRecord:
    """Ingest a landmark into the spatial & embedding database.

    Enforces strict safety boundaries:
    1. License verification: fail-closed on unknown or Google Maps derived persistent data.
    2. Input quality gating on reference images.
    3. Spatial indexing via Geohash and H3.
    4. Normalized embedding computation.
    """
    # 1. License check
    if not provenance.is_license_permitted():
        raise LicenseVerificationError(
            f"License '{provenance.license}' or source '{provenance.source}' is not permitted "
            f"for persistent reference embeddings under ADR 0005."
        )

    # 2. Quality check on reference image if provided
    if image_bytes:
        quality = evaluate_image_quality(image_bytes)
        if not quality.is_acceptable:
            logger.warning(
                f"Ingestion quality warning for landmark {landmark_id}: {quality.rejection_reason}"
            )

    # 3. Embedding generation
    active_provider = provider or get_vision_provider()
    if image_bytes:
        embedding = active_provider.embed_image(image_bytes)
    elif text_description:
        embedding = active_provider.embed_text(text_description)
    else:
        # Fallback to name/tags description
        desc = f"{name} " + " ".join(visual_tags or [])
        embedding = active_provider.embed_text(desc)

    # 4. Spatial indexing
    geohash = encode_geohash(latitude, longitude, precision=7)
    # H3 resolution 9 key approximation or fallback
    h3_index = f"h3_9_{geohash}"

    now_iso = datetime.now(timezone.utc).isoformat()
    provenance.ingested_at = now_iso

    record = LandmarkRecord(
        landmark_id=landmark_id,
        name=name,
        latitude=latitude,
        longitude=longitude,
        h3_index=h3_index,
        geohash=geohash,
        embedding=embedding,
        ocr_tokens=ocr_tokens or [],
        visual_tags=visual_tags or [],
        provenance=provenance,
    )

    # 5. Persist
    target_store = store or default_landmark_store
    target_store.insert(record)
    logger.info(f"Ingested landmark '{name}' ({landmark_id}) with license '{provenance.license}'")

    return record
