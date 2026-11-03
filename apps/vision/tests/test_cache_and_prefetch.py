"""Tests for Redis tile candidate caching, route-corridor prefetching, and frame deduplication."""

import unittest
from app.core.geo import compute_corridor_tiles, encode_geohash, heading_to_bucket
from app.core.quality import compute_frame_phash, phash_hamming_distance
from app.pipeline.cache import (
    TileCandidateCache,
    prefetch_route_corridor,
    retrieve_candidates,
)
from app.pipeline.ingestion import LandmarkStore, ingest_landmark
from app.schemas.models import LandmarkProvenance


class TestCacheAndPrefetch(unittest.TestCase):

    def setUp(self):
        self.store = LandmarkStore()
        self.cache = TileCandidateCache(redis_url=None)  # Uses in-memory fallback
        self.cache.clear()

        prov = LandmarkProvenance(
            license="SIMULATED",
            source="seed",
            attribution="LandmarkNav",
            is_simulated=True,
        )

        # Ingest 3 landmarks along a synthetic route
        self.lm1 = ingest_landmark(
            landmark_id="lm_step1",
            name="Bakery on Corner",
            latitude=37.7749,
            longitude=-122.4194,
            provenance=prov,
            text_description="Corner bakery with red awning",
            store=self.store,
        )
        self.lm2 = ingest_landmark(
            landmark_id="lm_step2",
            name="Bank Columns",
            latitude=37.7758,
            longitude=-122.4194,
            provenance=prov,
            text_description="Ionic columned bank facade",
            store=self.store,
        )

    def test_tile_candidate_cache_set_and_get(self):
        tile_key = encode_geohash(37.7749, -122.4194, precision=7)
        bucket = "N"

        # Initially empty
        self.assertIsNone(self.cache.get(tile_key, bucket))

        # Cache candidates
        self.cache.set(tile_key, bucket, [self.lm1])

        # Hit
        cached = self.cache.get(tile_key, bucket)
        self.assertIsNotNone(cached)
        self.assertEqual(len(cached), 1)
        self.assertEqual(cached[0].landmark_id, "lm_step1")

    def test_route_corridor_prefetching(self):
        # Synthetic walking route coordinates
        route_polyline = [
            (37.7749, -122.4194),
            (37.7753, -122.4194),
            (37.7758, -122.4194),
        ]

        # Prefetch route corridor
        num_tiles = prefetch_route_corridor(
            polyline=route_polyline,
            store=self.store,
            cache=self.cache,
        )
        self.assertGreater(num_tiles, 0)

        # Retrieval at step 1 should now hit cache immediately
        cands = retrieve_candidates(
            user_lat=37.7749,
            user_lon=-122.4194,
            user_heading_deg=0.0,
            store=self.store,
            cache=self.cache,
        )
        self.assertTrue(any(c.landmark_id == "lm_step1" for c in cands))

    def test_frame_deduplication_and_memoization(self):
        # Two identical image byte payloads
        img1 = b"frame_sample_bytes_identical_sequence_12345"
        img2 = b"frame_sample_bytes_identical_sequence_12345"
        img3 = b"completely_different_frame_image_bytes_9876543210"

        phash1 = compute_frame_phash(img1)
        phash2 = compute_frame_phash(img2)
        phash3 = compute_frame_phash(img3)

        self.assertEqual(phash1, phash2)
        self.assertEqual(phash_hamming_distance(phash1, phash2), 0)

        # Memoize match for phash1
        tile_key = "9q8yyk1"
        self.cache.memoize_match(phash1, tile_key, {"landmark": "lm_step1", "conf": 0.88})

        memo = self.cache.get_memoized_match(phash2, tile_key)
        self.assertIsNotNone(memo)
        self.assertEqual(memo["landmark"], "lm_step1")

        # Different frame should not hit memoized match
        self.assertIsNone(self.cache.get_memoized_match(phash3, tile_key))


if __name__ == "__main__":
    unittest.main()
