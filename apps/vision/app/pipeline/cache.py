"""Tile-based candidate caching and route-corridor prefetching with Redis and in-memory fallback."""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

from app.core.geo import (
    compute_corridor_tiles,
    encode_geohash,
    heading_to_bucket,
    is_within_heading_cone,
)
from app.pipeline.ingestion import LandmarkStore, default_landmark_store
from app.schemas.models import LandmarkProvenance, LandmarkRecord

logger = logging.getLogger(__name__)


class TileCandidateCache:
    """Redis-backed candidate cache with automatic in-memory fallback."""

    def __init__(self, redis_url: Optional[str] = None, default_ttl_seconds: int = 3600):
        self.default_ttl = default_ttl_seconds
        self._memory_cache: Dict[str, Tuple[float, str]] = {}
        self._redis_client = None

        url = redis_url or os.environ.get("REDIS_URL")
        if url:
            try:
                import redis  # type: ignore

                self._redis_client = redis.from_url(url, decode_responses=True)
                # Quick ping test
                self._redis_client.ping()
                logger.info(f"TileCandidateCache connected to Redis at {url}")
            except Exception as e:
                logger.warning(f"Could not connect to Redis ({e}); using in-memory cache fallback.")
                self._redis_client = None

    def is_redis_connected(self) -> bool:
        return self._redis_client is not None

    def _make_key(self, tile_key: str, heading_bucket: str) -> str:
        return f"landmarknav:tile:{tile_key}:{heading_bucket}"

    def get(self, tile_key: str, heading_bucket: str) -> Optional[List[LandmarkRecord]]:
        key = self._make_key(tile_key, heading_bucket)
        data_str: Optional[str] = None

        if self._redis_client:
            try:
                data_str = self._redis_client.get(key)
            except Exception as e:
                logger.warning(f"Redis get error: {e}")

        if data_str is None:
            # Check in-memory cache
            entry = self._memory_cache.get(key)
            if entry:
                expires_at, val = entry
                if time.time() < expires_at:
                    data_str = val
                else:
                    del self._memory_cache[key]

        if not data_str:
            return None

        try:
            records_data = json.loads(data_str)
            records = []
            for d in records_data:
                prov_data = d.get("provenance", {})
                prov = LandmarkProvenance(
                    license=prov_data.get("license", "SIMULATED"),
                    source=prov_data.get("source", "simulated"),
                    attribution=prov_data.get("attribution", ""),
                    is_simulated=prov_data.get("is_simulated", True),
                    ingested_at=prov_data.get("ingested_at"),
                )
                rec = LandmarkRecord(
                    landmark_id=d["landmark_id"],
                    name=d["name"],
                    latitude=d["latitude"],
                    longitude=d["longitude"],
                    h3_index=d.get("h3_index", ""),
                    geohash=d.get("geohash", ""),
                    embedding=d.get("embedding", []),
                    ocr_tokens=d.get("ocr_tokens", []),
                    visual_tags=d.get("visual_tags", []),
                    provenance=prov,
                )
                records.append(rec)
            return records
        except Exception as e:
            logger.warning(f"Failed to deserialize cached candidate records: {e}")
            return None

    def set(
        self,
        tile_key: str,
        heading_bucket: str,
        candidates: List[LandmarkRecord],
        ttl_seconds: Optional[int] = None,
    ) -> None:
        key = self._make_key(tile_key, heading_bucket)
        ttl = ttl_seconds or self.default_ttl
        payload = json.dumps([c.to_dict() for c in candidates])

        if self._redis_client:
            try:
                self._redis_client.setex(key, ttl, payload)
            except Exception as e:
                logger.warning(f"Redis set error: {e}")

        # Always keep in memory fallback
        self._memory_cache[key] = (time.time() + ttl, payload)

    def memoize_match(self, phash: str, tile_key: str, match_data: dict, ttl_seconds: int = 10) -> None:
        """Memoize recent visual match to avoid re-evaluating identical consecutive frames."""
        key = f"landmarknav:memo:{phash}:{tile_key}"
        payload = json.dumps(match_data)
        if self._redis_client:
            try:
                self._redis_client.setex(key, ttl_seconds, payload)
            except Exception:
                pass
        self._memory_cache[key] = (time.time() + ttl_seconds, payload)

    def get_memoized_match(self, phash: str, tile_key: str) -> Optional[dict]:
        key = f"landmarknav:memo:{phash}:{tile_key}"
        data_str: Optional[str] = None
        if self._redis_client:
            try:
                data_str = self._redis_client.get(key)
            except Exception:
                pass
        if data_str is None:
            entry = self._memory_cache.get(key)
            if entry and time.time() < entry[0]:
                data_str = entry[1]

        if data_str:
            try:
                return json.loads(data_str)
            except Exception:
                return None
        return None

    def clear(self) -> None:
        self._memory_cache.clear()
        if self._redis_client:
            try:
                keys = self._redis_client.keys("landmarknav:*")
                if keys:
                    self._redis_client.delete(*keys)
            except Exception:
                pass


# Default singleton tile cache
default_tile_cache = TileCandidateCache()


def prefetch_route_corridor(
    polyline: List[Tuple[float, float]],
    store: Optional[LandmarkStore] = None,
    cache: Optional[TileCandidateCache] = None,
    corridor_buffer_meters: float = 100.0,
) -> int:
    """Pre-warm candidate cache along all corridor tiles for a walking route.

    Asynchronously called when a route is created so that walking navigation
    hits cached candidates along every step with zero database query latency.
    """
    target_store = store or default_landmark_store
    target_cache = cache or default_tile_cache

    tiles = compute_corridor_tiles(polyline, precision=7)
    prewarmed_count = 0

    all_heading_buckets = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

    for tile in tiles:
        # Retrieve landmarks in this tile
        tile_landmarks = target_store.search_by_tiles([tile])
        if not tile_landmarks:
            continue

        for bucket in all_heading_buckets:
            # Cache candidates for each heading bucket
            target_cache.set(tile, bucket, tile_landmarks)
            prewarmed_count += 1

    logger.info(f"Route prefetch complete: pre-warmed {len(tiles)} corridor tiles across {prewarmed_count} heading buckets.")
    return len(tiles)


def retrieve_candidates(
    user_lat: float,
    user_lon: float,
    user_heading_deg: Optional[float] = None,
    max_radius_meters: float = 150.0,
    store: Optional[LandmarkStore] = None,
    cache: Optional[TileCandidateCache] = None,
) -> List[LandmarkRecord]:
    """Retrieve filtered candidate landmarks for the current user location and heading cone.
    Uses tile cache if present; otherwise queries spatial store and populates cache.
    """
    target_store = store or default_landmark_store
    target_cache = cache or default_tile_cache

    tile_key = encode_geohash(user_lat, user_lon, precision=7)
    heading = user_heading_deg if user_heading_deg is not None else 0.0
    h_bucket = heading_to_bucket(heading)

    # 1. Check tile candidate cache
    cached = target_cache.get(tile_key, h_bucket)
    if cached is not None:
        logger.debug(f"Candidate cache HIT for tile {tile_key}:{h_bucket}")
        # Apply heading cone and radius filter
        filtered = []
        for cand in cached:
            if is_within_heading_cone(user_lat, user_lon, heading, cand.latitude, cand.longitude):
                filtered.append(cand)
        return filtered

    # 2. Cache miss -> query spatial store
    logger.debug(f"Candidate cache MISS for tile {tile_key}:{h_bucket}")
    raw_results = target_store.search_by_radius(user_lat, user_lon, max_radius_meters)

    candidates: List[LandmarkRecord] = []
    for cand, dist in raw_results:
        cand.distance_meters = dist
        if is_within_heading_cone(user_lat, user_lon, heading, cand.latitude, cand.longitude):
            candidates.append(cand)

    # 3. Populate cache
    target_cache.set(tile_key, h_bucket, candidates)
    return candidates
