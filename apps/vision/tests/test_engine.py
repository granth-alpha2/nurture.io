"""Tests for end-to-end 12-step VisionLocalizationEngine pipeline."""

import unittest
from app.pipeline.cache import TileCandidateCache
from app.pipeline.calibration import ConfidenceCalibrator
from app.pipeline.engine import (
    DwellStabilizer,
    VisionLocalizationEngine,
    generate_constrained_instruction,
)
from app.pipeline.ingestion import LandmarkStore, ingest_landmark
from app.schemas.models import LandmarkProvenance


class TestEnginePipeline(unittest.TestCase):

    def setUp(self):
        self.store = LandmarkStore()
        self.cache = TileCandidateCache()
        self.calibrator = ConfidenceCalibrator()
        self.stabilizer = DwellStabilizer(min_dwell_seconds=0.0)  # zero dwell for deterministic testing

        prov = LandmarkProvenance(
            license="CC-BY-4.0",
            source="open_street_level",
            attribution="LandmarkNav Open Data",
            is_simulated=True,
        )

        emb = [0.0] * 512
        emb[0] = 0.85
        emb[1] = 0.52

        self.lm = ingest_landmark(
            landmark_id="lm_art_museum",
            name="Art Museum Grand Steps",
            latitude=37.77495,
            longitude=-122.4194,
            provenance=prov,
            ocr_tokens=["art", "museum"],
            visual_tags=["stone_steps", "bronze_statue"],
            store=self.store,
        )

        # Pre-seed candidate vector to match
        self.lm.embedding = emb

        self.engine = VisionLocalizationEngine(
            store=self.store,
            cache=self.cache,
            calibrator=self.calibrator,
            stabilizer=self.stabilizer,
        )

    def test_full_pipeline_successful_localization(self):
        # Query with matching feature vector and good GPS
        q_vec = list(self.lm.embedding)

        estimate = self.engine.process(
            session_id="test_session_1",
            user_lat=37.7749,
            user_lon=-122.4194,
            horizontal_accuracy_meters=8.0,
            heading_deg=0.0,
            feature_vector=q_vec,
            route_step_sequence=1,
            next_maneuver="turn_right",
            visual_consent=True,
        )

        self.assertEqual(estimate.landmark_name, "Art Museum Grand Steps")
        self.assertTrue(estimate.location_confirmed)
        self.assertFalse(estimate.requires_relocalization)
        self.assertGreater(estimate.match_confidence, 0.70)
        self.assertIn("Turn right at Art Museum Grand Steps", estimate.next_instruction)
        self.assertEqual(estimate.mode, "SIMULATED")

    def test_degraded_gps_requests_relocalization(self):
        """GPS accuracy > 25m triggers safety abstention and relocalization request."""
        q_vec = list(self.lm.embedding)

        estimate = self.engine.process(
            session_id="test_session_1",
            user_lat=37.7749,
            user_lon=-122.4194,
            horizontal_accuracy_meters=45.0,  # degraded accuracy
            heading_deg=0.0,
            feature_vector=q_vec,
            visual_consent=True,
        )

        self.assertIsNone(estimate.landmark_name)
        self.assertFalse(estimate.location_confirmed)
        self.assertTrue(estimate.requires_relocalization)
        self.assertIn("accuracy degraded", estimate.next_instruction)

    def test_no_visual_consent_falls_back(self):
        q_vec = list(self.lm.embedding)

        estimate = self.engine.process(
            session_id="test_session_1",
            user_lat=37.7749,
            user_lon=-122.4194,
            horizontal_accuracy_meters=5.0,
            heading_deg=0.0,
            feature_vector=q_vec,
            visual_consent=False,  # no consent
        )

        self.assertIsNone(estimate.landmark_name)
        self.assertFalse(estimate.location_confirmed)
        self.assertFalse(estimate.requires_relocalization)

    def test_constrained_instruction_hindi(self):
        instruction = generate_constrained_instruction(
            landmark_name="रेलवे स्टेशन",
            distance_meters=30.0,
            next_maneuver="turn_right",
            language="hi",
        )
        self.assertIn("दाएं मुड़ें", instruction)
        self.assertIn("30 मीटर", instruction)


if __name__ == "__main__":
    unittest.main()
