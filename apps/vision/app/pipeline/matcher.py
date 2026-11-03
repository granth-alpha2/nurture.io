"""Landmark visual matching engine with false-confident-match rejection gates."""

import logging
from typing import List, Optional, Tuple

from app.core.geo import haversine_distance_meters, is_within_heading_cone
from app.core.quality import evaluate_image_quality
from app.pipeline.calibration import ConfidenceCalibrator, default_calibrator
from app.providers.base import OCRProvider, VisionProvider, cosine_similarity
from app.providers.ocr import compute_token_match_ratio
from app.providers.registry import get_ocr_provider, get_vision_provider
from app.schemas.models import EvidenceItem, LandmarkRecord, VisualMatchResult

logger = logging.getLogger(__name__)

# Safety thresholds per docs/07-ml-pipeline.md and prompt.md §5
DEFAULT_MIN_SIMILARITY_THRESHOLD = 0.70  # Gate 1: absolute similarity floor
DEFAULT_MIN_TOP2_MARGIN = 0.08  # Gate 2: ambiguous match rejection margin
DEFAULT_MAX_DISTANCE_METERS = 150.0  # Gate 3: visual line-of-sight boundary
DEFAULT_HEADING_CONE_DEG = 60.0  # Gate 4: forward viewing cone


class LandmarkMatcher:
    """Evaluates visual candidates against query frame with safety rejection gates."""

    def __init__(
        self,
        min_similarity: float = DEFAULT_MIN_SIMILARITY_THRESHOLD,
        min_top2_margin: float = DEFAULT_MIN_TOP2_MARGIN,
        max_distance_meters: float = DEFAULT_MAX_DISTANCE_METERS,
        vision_provider: Optional[VisionProvider] = None,
        ocr_provider: Optional[OCRProvider] = None,
        calibrator: Optional[ConfidenceCalibrator] = None,
    ):
        self.min_similarity = min_similarity
        self.min_top2_margin = min_top2_margin
        self.max_distance_meters = max_distance_meters
        self.vision_provider = vision_provider or get_vision_provider()
        self.ocr_provider = ocr_provider or get_ocr_provider()
        self.calibrator = calibrator or default_calibrator

    def match(
        self,
        query_image_bytes: Optional[bytes] = None,
        query_vector: Optional[List[float]] = None,
        user_lat: Optional[float] = None,
        user_lon: Optional[float] = None,
        user_heading_deg: Optional[float] = None,
        horizontal_accuracy_meters: float = 10.0,
        candidates: Optional[List[LandmarkRecord]] = None,
    ) -> VisualMatchResult:
        """Execute full matching pipeline and evaluate false-confident-match rejection gates.

        If any safety gate fails (quality, ambiguity, low score, spatial mismatch),
        the engine abstains, returning matched=False and passed_rejection_gates=False.
        """
        evidence_list: List[EvidenceItem] = []

        # 1. Image Quality Gate
        if query_image_bytes:
            quality = evaluate_image_quality(query_image_bytes)
            if not quality.is_acceptable:
                return VisualMatchResult(
                    matched=False,
                    candidate=None,
                    similarity_score=0.0,
                    calibrated_confidence=0.0,
                    passed_rejection_gates=False,
                    rejection_reason=f"Quality gate rejected frame: {quality.rejection_reason}",
                    evidence=[
                        EvidenceItem(
                            type="visual",
                            validated=False,
                            source=self.vision_provider.name,
                            score=0.0,
                        )
                    ],
                )

        # 2. Extract or use query feature embedding
        if query_vector:
            q_vec = query_vector
        elif query_image_bytes:
            q_vec = self.vision_provider.embed_image(query_image_bytes)
        else:
            return VisualMatchResult(
                matched=False,
                candidate=None,
                similarity_score=0.0,
                calibrated_confidence=0.0,
                passed_rejection_gates=False,
                rejection_reason="No visual frame or embedding provided",
            )

        # 3. Empty candidates check
        if not candidates:
            return VisualMatchResult(
                matched=False,
                candidate=None,
                similarity_score=0.0,
                calibrated_confidence=0.0,
                passed_rejection_gates=False,
                rejection_reason="No spatial candidates available in viewing radius",
            )

        # 4. Score all candidates by cosine similarity
        scored_candidates: List[Tuple[LandmarkRecord, float]] = []
        for cand in candidates:
            sim = cosine_similarity(q_vec, cand.embedding)
            # Map [-1, 1] to [0, 1]
            norm_score = max(0.0, (sim + 1.0) / 2.0)
            scored_candidates.append((cand, norm_score))

        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        top1_cand, top1_score = scored_candidates[0]

        evidence_list.append(
            EvidenceItem(
                type="visual",
                validated=True,
                source=self.vision_provider.name,
                score=top1_score,
            )
        )

        # 5. Extract OCR untrusted evidence if query image is present
        ocr_evidence_score = 0.0
        if query_image_bytes:
            ocr_res = self.ocr_provider.extract_text(query_image_bytes)
            detected_tokens = ocr_res.get("tokens", [])
            if detected_tokens and top1_cand.ocr_tokens:
                ratio = compute_token_match_ratio(detected_tokens, top1_cand.ocr_tokens)
                if ratio > 0.0:
                    ocr_evidence_score = ratio
                    evidence_list.append(
                        EvidenceItem(
                            type="ocr",
                            validated=True,
                            source=self.ocr_provider.name,
                            score=ratio,
                        )
                    )

        # 6. Apply False-Confident-Match Rejection Gates

        # Gate 1: Absolute similarity floor
        if top1_score < self.min_similarity:
            return VisualMatchResult(
                matched=False,
                candidate=top1_cand,
                similarity_score=top1_score,
                calibrated_confidence=self.calibrator.calibrate(top1_score),
                passed_rejection_gates=False,
                rejection_reason=f"Similarity score {top1_score:.3f} below safety floor {self.min_similarity:.2f}",
                evidence=evidence_list,
            )

        # Gate 2: Top-2 margin ambiguity rejection (prevent false confident confusion between lookalikes)
        if len(scored_candidates) > 1:
            top2_cand, top2_score = scored_candidates[1]
            margin = top1_score - top2_score
            if margin < self.min_top2_margin:
                return VisualMatchResult(
                    matched=False,
                    candidate=top1_cand,
                    similarity_score=top1_score,
                    calibrated_confidence=self.calibrator.calibrate(top1_score),
                    passed_rejection_gates=False,
                    rejection_reason=(
                        f"Ambiguous top-2 match margin {margin:.3f} < threshold {self.min_top2_margin:.2f} "
                        f"between '{top1_cand.name}' and '{top2_cand.name}'"
                    ),
                    evidence=evidence_list,
                )

        # Gate 3: Spatial proximity & heading consistency
        if user_lat is not None and user_lon is not None:
            dist = haversine_distance_meters(user_lat, user_lon, top1_cand.latitude, top1_cand.longitude)
            top1_cand.distance_meters = dist
            if dist > self.max_distance_meters:
                return VisualMatchResult(
                    matched=False,
                    candidate=top1_cand,
                    similarity_score=top1_score,
                    calibrated_confidence=self.calibrator.calibrate(top1_score),
                    passed_rejection_gates=False,
                    rejection_reason=f"Candidate distance {dist:.1f}m exceeds visual line-of-sight maximum ({self.max_distance_meters}m)",
                    evidence=evidence_list,
                )

            if user_heading_deg is not None:
                if not is_within_heading_cone(
                    user_lat,
                    user_lon,
                    user_heading_deg,
                    top1_cand.latitude,
                    top1_cand.longitude,
                    cone_half_angle_deg=DEFAULT_HEADING_CONE_DEG,
                ):
                    return VisualMatchResult(
                        matched=False,
                        candidate=top1_cand,
                        similarity_score=top1_score,
                        calibrated_confidence=self.calibrator.calibrate(top1_score),
                        passed_rejection_gates=False,
                        rejection_reason="Candidate is outside user forward viewing cone",
                        evidence=evidence_list,
                    )

        # 7. Compute Calibrated Confidence
        calibrated_conf = self.calibrator.calibrate(top1_score)

        return VisualMatchResult(
            matched=True,
            candidate=top1_cand,
            similarity_score=top1_score,
            calibrated_confidence=calibrated_conf,
            passed_rejection_gates=True,
            rejection_reason=None,
            evidence=evidence_list,
        )
