"""Evaluation harness for benchmark datasets, precision/recall, and false-confident-match rate."""

import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

from app.pipeline.calibration import CalibrationReport, compute_ece
from app.pipeline.matcher import LandmarkMatcher
from app.schemas.models import LandmarkProvenance, LandmarkRecord

logger = logging.getLogger(__name__)


@dataclass
class EvalSample:
    """Individual labelled benchmark test sample."""
    sample_id: str
    condition: str  # 'daytime', 'night', 'rain', 'crowded', 'lookalike', 'distractor'
    query_vector: List[float]
    expected_landmark_id: Optional[str]  # None if distractor / negative
    user_lat: float
    user_lon: float
    user_heading_deg: float
    candidates: List[LandmarkRecord]


@dataclass
class ConditionMetrics:
    condition: str
    total: int
    true_positives: int
    false_positives: int
    false_negatives: int
    abstentions: int
    precision: float
    recall: float
    false_confident_matches: int


@dataclass
class EvaluationReport:
    """Comprehensive safety and calibration evaluation report."""
    total_samples: int
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: int
    precision: float
    recall: float
    f1_score: float
    abstention_rate: float
    false_confident_match_rate: float  # Primary safety metric
    safety_target_passed: bool
    calibration: CalibrationReport
    condition_breakdown: List[ConditionMetrics] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_samples": self.total_samples,
            "true_positives": self.true_positives,
            "false_positives": self.false_positives,
            "false_negatives": self.false_negatives,
            "true_negatives": self.true_negatives,
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1_score": round(self.f1_score, 4),
            "abstention_rate": round(self.abstention_rate, 4),
            "false_confident_match_rate": round(self.false_confident_match_rate, 4),
            "safety_target_passed": self.safety_target_passed,
            "calibration": self.calibration.to_dict(),
            "conditions": [asdict(c) for c in self.condition_breakdown],
        }


def generate_benchmark_dataset(size_per_condition: int = 15) -> List[EvalSample]:
    """Generate a representative synthetic benchmark dataset across varied operational conditions.
    Adheres to AGENTS.md: zero raw personal images stored in repository; metadata & synthetic vectors used.
    """
    conditions = ["daytime", "dusk_night", "occluded", "lookalike", "distractor"]
    samples: List[EvalSample] = []

    base_lat = 37.7749
    base_lon = -122.4194

    prov = LandmarkProvenance(
        license="SIMULATED",
        source="eval_benchmark",
        attribution="LandmarkNav Evaluation Manifest",
        is_simulated=True,
    )

    # Reference target landmark
    ref_embedding = [0.0] * 512
    ref_embedding[0] = 0.8
    ref_embedding[1] = 0.6  # normalized unit vector

    target_landmark = LandmarkRecord(
        landmark_id="lm_central_library",
        name="Central Library Column Portal",
        latitude=base_lat + 0.0003,
        longitude=base_lon + 0.0002,
        h3_index="h3_target",
        geohash="9q8yyk1",
        embedding=ref_embedding,
        ocr_tokens=["central", "library"],
        visual_tags=["stone_pillars", "archway"],
        provenance=prov,
    )

    # Distractor / lookalike landmark
    lookalike_embedding = [0.0] * 512
    lookalike_embedding[0] = 0.78
    lookalike_embedding[1] = 0.62  # very close vector (lookalike facade)

    lookalike_landmark = LandmarkRecord(
        landmark_id="lm_city_hall_annex",
        name="City Hall Annex Columns",
        latitude=base_lat + 0.00035,
        longitude=base_lon + 0.00025,
        h3_index="h3_lookalike",
        geohash="9q8yyk2",
        embedding=lookalike_embedding,
        ocr_tokens=["city", "hall"],
        visual_tags=["stone_pillars"],
        provenance=prov,
    )

    candidate_pool = [target_landmark, lookalike_landmark]

    sample_counter = 1
    for cond in conditions:
        for i in range(size_per_condition):
            sid = f"eval_{cond}_{sample_counter:03d}"
            sample_counter += 1

            if cond == "daytime":
                # Clear view of target
                q_vec = [x + 0.01 * (i % 3) for x in ref_embedding]
                norm = sum(x * x for x in q_vec) ** 0.5
                q_vec = [x / norm for x in q_vec]
                expected = target_landmark.landmark_id
                cands = [target_landmark]
                heading = 45.0
            elif cond == "dusk_night":
                # Slightly degraded vector
                q_vec = [x + 0.04 * (i % 2) for x in ref_embedding]
                norm = sum(x * x for x in q_vec) ** 0.5
                q_vec = [x / norm for x in q_vec]
                expected = target_landmark.landmark_id
                cands = [target_landmark]
                heading = 45.0
            elif cond == "occluded":
                # Partial occlusion: noise added
                q_vec = [0.0] * 512
                q_vec[0] = 0.5
                q_vec[1] = 0.4
                q_vec[2] = 0.7  # substantial occlusion
                expected = target_landmark.landmark_id
                cands = [target_landmark]
                heading = 45.0
            elif cond == "lookalike":
                # Both target and lookalike present; ambiguity test
                q_vec = [0.5 * ref_embedding[k] + 0.5 * lookalike_embedding[k] for k in range(512)]
                norm = sum(x * x for x in q_vec) ** 0.5
                q_vec = [x / norm for x in q_vec]
                expected = None  # Expected to ABSTAIN due to ambiguity gate
                cands = [target_landmark, lookalike_landmark]
                heading = 45.0
            else:  # distractor
                # Random scene with unrelated vector
                q_vec = [0.0] * 512
                q_vec[10] = 0.9
                q_vec[11] = 0.43
                expected = None  # Expected to ABSTAIN / reject
                cands = [target_landmark]
                heading = 45.0

            samples.append(
                EvalSample(
                    sample_id=sid,
                    condition=cond,
                    query_vector=q_vec,
                    expected_landmark_id=expected,
                    user_lat=base_lat,
                    user_lon=base_lon,
                    user_heading_deg=heading,
                    candidates=cands,
                )
            )

    return samples


def evaluate_matcher(
    matcher: LandmarkMatcher,
    dataset: Optional[List[EvalSample]] = None,
    high_confidence_safety_threshold: float = 0.75,
    max_tolerated_false_confident_rate: float = 0.01,
) -> EvaluationReport:
    """Run evaluation benchmark across conditions and compute safety & calibration metrics."""
    data = dataset or generate_benchmark_dataset()

    tp = 0
    fp = 0
    fn = 0
    tn = 0
    false_confident_count = 0
    abstentions = 0

    confidences: List[float] = []
    labels: List[bool] = []

    condition_data: Dict[str, Dict[str, int]] = {}

    for sample in data:
        cond = sample.condition
        if cond not in condition_data:
            condition_data[cond] = {
                "total": 0,
                "tp": 0,
                "fp": 0,
                "fn": 0,
                "abstentions": 0,
                "false_confident": 0,
            }
        condition_data[cond]["total"] += 1

        res = matcher.match(
            query_vector=sample.query_vector,
            user_lat=sample.user_lat,
            user_lon=sample.user_lon,
            user_heading_deg=sample.user_heading_deg,
            candidates=sample.candidates,
        )

        matched_id = res.candidate.landmark_id if (res.matched and res.candidate) else None
        conf = res.calibrated_confidence

        if not res.matched:
            abstentions += 1
            condition_data[cond]["abstentions"] += 1

            if sample.expected_landmark_id is None:
                # Correct abstention on distractor or ambiguous sample
                tn += 1
            else:
                # Missed a true landmark
                fn += 1
                condition_data[cond]["fn"] += 1
        else:
            # Match claimed
            is_correct = (matched_id == sample.expected_landmark_id)
            confidences.append(conf)
            labels.append(is_correct)

            if is_correct:
                tp += 1
                condition_data[cond]["tp"] += 1
            else:
                fp += 1
                condition_data[cond]["fp"] += 1
                if conf >= high_confidence_safety_threshold:
                    false_confident_count += 1
                    condition_data[cond]["false_confident"] += 1

    total = len(data)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    abstention_rate = abstentions / total if total > 0 else 0.0
    false_confident_rate = false_confident_count / total if total > 0 else 0.0

    safety_passed = false_confident_rate <= max_tolerated_false_confident_rate

    calib_report = compute_ece(confidences, labels)

    cond_metrics: List[ConditionMetrics] = []
    for cond, stats in condition_data.items():
        c_tp = stats["tp"]
        c_fp = stats["fp"]
        c_fn = stats["fn"]
        c_prec = c_tp / (c_tp + c_fp) if (c_tp + c_fp) > 0 else 1.0
        c_rec = c_tp / (c_tp + c_fn) if (c_tp + c_fn) > 0 else 0.0
        cond_metrics.append(
            ConditionMetrics(
                condition=cond,
                total=stats["total"],
                true_positives=c_tp,
                false_positives=c_fp,
                false_negatives=c_fn,
                abstentions=stats["abstentions"],
                precision=round(c_prec, 4),
                recall=round(c_rec, 4),
                false_confident_matches=stats["false_confident"],
            )
        )

    return EvaluationReport(
        total_samples=total,
        true_positives=tp,
        false_positives=fp,
        false_negatives=fn,
        true_negatives=tn,
        precision=precision,
        recall=recall,
        f1_score=f1,
        abstention_rate=abstention_rate,
        false_confident_match_rate=false_confident_rate,
        safety_target_passed=safety_passed,
        calibration=calib_report,
        condition_breakdown=cond_metrics,
    )
