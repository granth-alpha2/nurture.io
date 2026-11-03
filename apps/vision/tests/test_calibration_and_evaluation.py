"""Tests for Expected Calibration Error (ECE) and benchmark evaluation harness."""

import unittest
from app.pipeline.calibration import ConfidenceCalibrator, compute_ece
from app.pipeline.evaluation import evaluate_matcher, generate_benchmark_dataset
from app.pipeline.matcher import LandmarkMatcher


class TestCalibrationAndEvaluation(unittest.TestCase):

    def test_ece_computation_perfect_calibration(self):
        # 10 samples: conf=0.8 with 8 True and 2 False -> empirical accuracy = 0.8
        confidences = [0.8] * 10
        labels = [True] * 8 + [False] * 2

        report = compute_ece(confidences, labels, num_bins=10)
        self.assertEqual(report.total_samples, 10)
        # Expected error in the 0.8-0.9 bin is exactly 0.0
        self.assertAlmostEqual(report.ece, 0.0, places=4)

    def test_ece_computation_uncalibrated(self):
        # Overconfident: conf=0.95 but only 50% accurate
        confidences = [0.95] * 10
        labels = [True] * 5 + [False] * 5

        report = compute_ece(confidences, labels, num_bins=10)
        self.assertGreater(report.ece, 0.4)
        self.assertGreater(report.mce, 0.4)

    def test_calibrator_mapping(self):
        calibrator = ConfidenceCalibrator(temperature=1.5, intercept=-0.1)
        raw_score = 0.85
        calibrated = calibrator.calibrate(raw_score)
        self.assertGreater(calibrated, 0.0)
        self.assertLess(calibrated, 1.0)

        # Monotonicity check
        s1 = 0.6
        s2 = 0.8
        self.assertLess(calibrator.calibrate(s1), calibrator.calibrate(s2))

    def test_benchmark_evaluation_harness(self):
        matcher = LandmarkMatcher(
            min_similarity=0.70,
            min_top2_margin=0.08,
            max_distance_meters=150.0,
        )

        dataset = generate_benchmark_dataset(size_per_condition=10)
        self.assertEqual(len(dataset), 50)  # 5 conditions x 10 samples

        report = evaluate_matcher(
            matcher=matcher,
            dataset=dataset,
            high_confidence_safety_threshold=0.75,
            max_tolerated_false_confident_rate=0.02,
        )

        self.assertEqual(report.total_samples, 50)
        self.assertGreater(report.precision, 0.80)
        self.assertGreater(report.recall, 0.40)
        self.assertTrue(report.safety_target_passed)
        # Primary safety metric: false confident match rate should be <= 2%
        self.assertLessEqual(report.false_confident_match_rate, 0.02)
        # Verify stratified conditions present
        self.assertEqual(len(report.condition_breakdown), 5)


if __name__ == "__main__":
    unittest.main()
