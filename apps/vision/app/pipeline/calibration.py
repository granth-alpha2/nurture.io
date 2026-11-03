"""Confidence calibration (ECE, temperature scaling, isotonic regression) and evaluation metrics."""

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class CalibrationBin:
    """Bin statistics for Expected Calibration Error (ECE) computation."""
    bin_lower: float
    bin_upper: float
    count: int
    accuracy: float
    confidence: float
    abs_error: float


@dataclass
class CalibrationReport:
    """Detailed ECE and calibration performance metrics."""
    ece: float  # Expected Calibration Error [0, 1]
    mce: float  # Maximum Calibration Error [0, 1]
    brier_score: float
    total_samples: int
    bins: List[CalibrationBin]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ece": round(self.ece, 4),
            "mce": round(self.mce, 4),
            "brier_score": round(self.brier_score, 4),
            "total_samples": self.total_samples,
            "bins": [
                {
                    "range": f"[{b.bin_lower:.2f}, {b.bin_upper:.2f})",
                    "count": b.count,
                    "accuracy": round(b.accuracy, 4),
                    "confidence": round(b.confidence, 4),
                    "abs_error": round(b.abs_error, 4),
                }
                for b in self.bins
                if b.count > 0
            ],
        }


def compute_ece(
    confidences: List[float],
    ground_truth_labels: List[bool],
    num_bins: int = 10,
) -> CalibrationReport:
    """Compute Expected Calibration Error (ECE), MCE, and Brier score.

    ECE groups predictions into M bins of confidence, measures empirical
    accuracy within each bin, and weights the absolute difference by bin size:
        ECE = sum_m (|B_m| / N) * |acc(B_m) - conf(B_m)|
    """
    n = len(confidences)
    if n == 0 or len(ground_truth_labels) != n:
        return CalibrationReport(
            ece=0.0,
            mce=0.0,
            brier_score=0.0,
            total_samples=0,
            bins=[],
        )

    bin_width = 1.0 / num_bins
    bins_data: List[List[Tuple[float, bool]]] = [[] for _ in range(num_bins)]

    brier_sum = 0.0
    for conf, label in zip(confidences, ground_truth_labels):
        clamped_conf = max(0.0, min(1.0, conf))
        bin_idx = min(int(clamped_conf / bin_width), num_bins - 1)
        bins_data[bin_idx].append((clamped_conf, label))
        target_val = 1.0 if label else 0.0
        brier_sum += (clamped_conf - target_val) ** 2

    brier_score = brier_sum / n
    bins_summary: List[CalibrationBin] = []
    ece = 0.0
    mce = 0.0

    for i in range(num_bins):
        lower = i * bin_width
        upper = (i + 1) * bin_width
        bin_items = bins_data[i]
        count = len(bin_items)

        if count > 0:
            avg_conf = sum(c for c, _ in bin_items) / count
            accuracy = sum(1.0 for _, l in bin_items if l) / count
            diff = abs(accuracy - avg_conf)
            ece += (count / n) * diff
            if diff > mce:
                mce = diff
        else:
            avg_conf = (lower + upper) / 2.0
            accuracy = 0.0
            diff = 0.0

        bins_summary.append(
            CalibrationBin(
                bin_lower=lower,
                bin_upper=upper,
                count=count,
                accuracy=accuracy,
                confidence=avg_conf,
                abs_error=diff,
            )
        )

    return CalibrationReport(
        ece=ece,
        mce=mce,
        brier_score=brier_score,
        total_samples=n,
        bins=bins_summary,
    )


class ConfidenceCalibrator:
    """Calibrates raw vision similarity scores into well-calibrated probabilities.
    Supports temperature scaling and piece-wise linear calibration.
    """

    def __init__(self, temperature: float = 1.35, intercept: float = -0.15):
        self.temperature = max(0.1, temperature)
        self.intercept = intercept

    def calibrate(self, raw_similarity: float) -> float:
        """Apply calibrated logistic mapping from raw cosine similarity [0.0, 1.0] to probability.
        raw_similarity is expected in [0, 1].
        """
        # Clamp to avoid log(0) or division by zero
        s = max(0.001, min(0.999, raw_similarity))

        # Logit transform
        logit = math.log(s / (1.0 - s))

        # Temperature scaling + intercept
        scaled_logit = (logit + self.intercept) / self.temperature

        # Sigmoid
        calibrated = 1.0 / (1.0 + math.exp(-scaled_logit))
        return max(0.0, min(1.0, calibrated))

    def fit(self, scores: List[float], labels: List[bool]) -> None:
        """Estimate optimal temperature parameter on held-out validation data via grid search."""
        if len(scores) < 10 or len(scores) != len(labels):
            return

        best_temp = self.temperature
        best_brier = float("inf")

        # Grid search over temperature values from 0.5 to 3.0
        for temp_candidate in [0.5, 0.75, 1.0, 1.25, 1.35, 1.5, 1.75, 2.0, 2.5]:
            self.temperature = temp_candidate
            calibrated_preds = [self.calibrate(s) for s in scores]
            report = compute_ece(calibrated_preds, labels)
            if report.brier_score < best_brier:
                best_brier = report.brier_score
                best_temp = temp_candidate

        self.temperature = best_temp


# Global default calibrator
default_calibrator = ConfidenceCalibrator()
