"""Tests for landmark ingestion pipeline, licensing safety boundaries, and pgvector spatial indexing."""

import unittest
from app.pipeline.ingestion import (
    LandmarkStore,
    LicenseVerificationError,
    ingest_landmark,
)
from app.schemas.models import LandmarkProvenance


class TestIngestionAndLicensing(unittest.TestCase):

    def setUp(self):
        self.store = LandmarkStore()

    def test_ingest_permitted_license(self):
        prov = LandmarkProvenance(
            license="CC-BY-4.0",
            source="open_street_level",
            attribution="Contributor Alice, OpenStreetMap Community",
            is_simulated=False,
        )

        record = ingest_landmark(
            landmark_id="lm_001",
            name="Town Hall Clock Tower",
            latitude=37.7749,
            longitude=-122.4194,
            provenance=prov,
            text_description="Victorian stone clock tower with arched doorway",
            ocr_tokens=["town", "hall"],
            visual_tags=["clock", "stone_tower"],
            store=self.store,
        )

        self.assertEqual(record.landmark_id, "lm_001")
        self.assertEqual(self.store.count(), 1)
        self.assertEqual(len(record.embedding), 512)
        self.assertTrue(record.geohash.startswith("9q8yy"))
        self.assertTrue(record.h3_index.startswith("h3_9_"))

    def test_ingest_forbidden_google_derived_license_fails_closed(self):
        """ADR 0005 & prompt.md §7.4: Fail closed on Google Street View or Places imagery."""
        prov = LandmarkProvenance(
            license="Google Maps Platform Terms",
            source="Google Street View Static API",
            attribution="Google LLC",
            is_simulated=False,
        )

        with self.assertRaises(LicenseVerificationError) as ctx:
            ingest_landmark(
                landmark_id="lm_forbidden",
                name="Forbidden Storefront",
                latitude=37.7749,
                longitude=-122.4194,
                provenance=prov,
                text_description="Storefront photo",
                store=self.store,
            )

        self.assertIn("not permitted", str(ctx.exception))
        self.assertEqual(self.store.count(), 0)

    def test_ingest_unknown_license_fails_closed(self):
        prov = LandmarkProvenance(
            license="unknown",
            source="unverified_web_scraping",
            attribution="unknown",
            is_simulated=False,
        )

        with self.assertRaises(LicenseVerificationError):
            ingest_landmark(
                landmark_id="lm_unknown",
                name="Unverified Landmark",
                latitude=37.7749,
                longitude=-122.4194,
                provenance=prov,
                store=self.store,
            )

    def test_spatial_radius_and_vector_search(self):
        prov = LandmarkProvenance(
            license="SIMULATED",
            source="test",
            attribution="Test",
            is_simulated=True,
        )

        # Ingest 2 landmarks near (37.7749, -122.4194)
        ingest_landmark(
            landmark_id="lm_near",
            name="Near Landmark",
            latitude=37.77492,
            longitude=-122.41942,
            provenance=prov,
            text_description="Blue facade cafe",
            store=self.store,
        )

        # Ingest 1 landmark 5 km away
        ingest_landmark(
            landmark_id="lm_far",
            name="Far Landmark",
            latitude=37.8200,
            longitude=-122.4194,
            provenance=prov,
            text_description="Blue facade cafe distant",
            store=self.store,
        )

        # Radius search 100m
        nearby = self.store.search_by_radius(37.7749, -122.4194, radius_meters=100.0)
        self.assertEqual(len(nearby), 1)
        self.assertEqual(nearby[0][0].landmark_id, "lm_near")

        # Nearest vector search
        q_vec = nearby[0][0].embedding
        nearest = self.store.search_nearest_vectors(q_vec, top_k=2)
        self.assertEqual(len(nearest), 2)
        # Top match should be the exact same vector
        self.assertEqual(nearest[0][0].landmark_id, "lm_near")
        self.assertAlmostEqual(nearest[0][1], 1.0, places=3)


if __name__ == "__main__":
    unittest.main()
