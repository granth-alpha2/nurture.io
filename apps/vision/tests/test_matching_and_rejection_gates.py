"""Tests for visual matching and false-confident-match rejection gates."""

import unittest
from app.core.quality import evaluate_image_quality
from app.pipeline.calibration import ConfidenceCalibrator
from app.pipeline.matcher import LandmarkMatcher
from app.schemas.models import LandmarkProvenance, LandmarkRecord


class TestMatchingAndRejectionGates(unittest.TestCase):

    def setUp(self):
        self.calibrator = ConfidenceCalibrator(temperature=1.2, intercept=-0.1)
        self.matcher = LandmarkMatcher(
            min_similarity=0.70,
            min_top2_margin=0.08,
            max_distance_meters=150.0,
            calibrator=self.calibrator,
        )

        prov = LandmarkProvenance(
            license="SIMULATED",
            source="test",
            attribution="LandmarkNav",
            is_simulated=True,
        )

        # Candidate 1: Clock Tower
        emb1 = [0.0] * 512
        emb1[0] = 0.8
        emb1[1] = 0.6
        self.target_lm = LandmarkRecord(
            landmark_id="lm_clock",
            name="Clock Tower",
            latitude=37.7750,
            longitude=-122.4194,
            h3_index="h3_1",
            geohash="9q8yyk1",
            embedding=emb1,
            ocr_tokens=["clock", "tower"],
            provenance=prov,
        )

        # Candidate 2: Distinct landmark
        emb2 = [0.0] * 512
        emb2[10] = 1.0
        self.other_lm = LandmarkRecord(
            landmark_id="lm_other",
            name="Red Brick Church",
            latitude=37.7752,
            longitude=-122.4194,
            h3_index="h3_2",
            geohash="9q8yyk2",
            embedding=emb2,
            ocr_tokens=["church"],
            provenance=prov,
        )

    def test_clear_match_passes_all_gates(self):
        # Query vector highly similar to target_lm
        q_vec = list(self.target_lm.embedding)

        result = self.matcher.match(
            query_vector=q_vec,
            user_lat=37.7749,
            user_lon=-122.4194,
            user_heading_deg=0.0,
            candidates=[self.target_lm, self.other_lm],
        )

        self.assertTrue(result.matched)
        self.assertTrue(result.passed_rejection_gates)
        self.assertEqual(result.candidate.landmark_id, "lm_clock")
        self.assertGreater(result.similarity_score, 0.95)
        self.assertGreater(result.calibrated_confidence, 0.70)
        self.assertIsNone(result.rejection_reason)

    def test_gate1_low_similarity_rejected(self):
        # Vector unrelated to any candidate
        q_vec = [0.0] * 512
        q_vec[50] = 1.0

        result = self.matcher.match(
            query_vector=q_vec,
            user_lat=37.7749,
            user_lon=-122.4194,
            user_heading_deg=0.0,
            candidates=[self.target_lm, self.other_lm],
        )

        self.assertFalse(result.matched)
        self.assertFalse(result.passed_rejection_gates)
        self.assertIn("below safety floor", result.rejection_reason)

    def test_gate2_ambiguity_top2_margin_rejection(self):
        """When two lookalike landmarks compete with similar scores, reject as ambiguous!"""
        # Create a lookalike candidate with almost identical vector
        emb_lookalike = [0.0] * 512
        emb_lookalike[0] = 0.79
        emb_lookalike[1] = 0.61

        lookalike_lm = LandmarkRecord(
            landmark_id="lm_clock_replica",
            name="Clock Tower Replica",
            latitude=37.77505,
            longitude=-122.4194,
            h3_index="h3_lookalike",
            geohash="9q8yyk3",
            embedding=emb_lookalike,
            provenance=self.target_lm.provenance,
        )

        # Query vector is midpoint between the two
        q_vec = [0.5 * self.target_lm.embedding[k] + 0.5 * emb_lookalike[k] for k in range(512)]
        norm = sum(x * x for x in q_vec) ** 0.5
        q_vec = [x / norm for x in q_vec]

        result = self.matcher.match(
            query_vector=q_vec,
            user_lat=37.7749,
            user_lon=-122.4194,
            user_heading_deg=0.0,
            candidates=[self.target_lm, lookalike_lm],
        )

        self.assertFalse(result.matched)
        self.assertFalse(result.passed_rejection_gates)
        self.assertIn("Ambiguous top-2 match margin", result.rejection_reason)

    def test_gate3_spatial_distance_and_heading_rejection(self):
        # User is facing South (180 deg), but landmark is to the North (0 deg)
        q_vec = list(self.target_lm.embedding)

        result = self.matcher.match(
            query_vector=q_vec,
            user_lat=37.7749,
            user_lon=-122.4194,
            user_heading_deg=180.0,  # facing away
            candidates=[self.target_lm],
        )

        self.assertFalse(result.matched)
        self.assertFalse(result.passed_rejection_gates)
        self.assertIn("viewing cone", result.rejection_reason)

    def test_image_quality_gate(self):
        # Frame with zero brightness (pitch dark)
        dark_bytes = bytes([0] * 1024)
        quality = evaluate_image_quality(dark_bytes)
        self.assertFalse(quality.is_acceptable)
        self.assertIn("darkness", quality.rejection_reason)


if __name__ == "__main__":
    unittest.main()
