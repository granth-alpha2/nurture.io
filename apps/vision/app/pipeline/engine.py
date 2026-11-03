"""End-to-end 12-step vision localization pipeline engine orchestrating retrieval, matching, and calibration."""

import base64
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from app.core.geo import haversine_distance_meters
from app.core.quality import compute_frame_phash, evaluate_image_quality, phash_hamming_distance
from app.pipeline.cache import TileCandidateCache, default_tile_cache, retrieve_candidates
from app.pipeline.calibration import ConfidenceCalibrator, default_calibrator
from app.pipeline.ingestion import LandmarkStore, default_landmark_store
from app.pipeline.matcher import LandmarkMatcher
from app.providers.base import OCRProvider, VisionProvider
from app.providers.registry import get_ocr_provider, get_vision_provider
from app.schemas.models import EvidenceItem, LandmarkRecord, LocalizationEstimate, VisualMatchResult

logger = logging.getLogger(__name__)


class DwellStabilizer:
    """Implements dwell-time hysteresis to prevent flickering between candidates."""

    def __init__(self, min_dwell_seconds: float = 3.0):
        self.min_dwell_seconds = min_dwell_seconds
        self._current_landmark_id: Optional[str] = None
        self._first_seen_timestamp: float = 0.0
        self._last_confirmed_landmark: Optional[str] = None

    def update(self, candidate_id: Optional[str]) -> Tuple[Optional[str], bool]:
        """Update candidate and return (stable_landmark_id, is_stabilized)."""
        now = time.time()
        if candidate_id is None:
            self._current_landmark_id = None
            self._first_seen_timestamp = 0.0
            return None, False

        if candidate_id != self._current_landmark_id:
            # New candidate seen; reset dwell timer
            self._current_landmark_id = candidate_id
            self._first_seen_timestamp = now
            if self.min_dwell_seconds <= 0.0:
                self._last_confirmed_landmark = candidate_id
                return candidate_id, True
            return self._last_confirmed_landmark, False

        # Same candidate seen continuously
        dwell_time = now - self._first_seen_timestamp
        if dwell_time >= self.min_dwell_seconds:
            self._last_confirmed_landmark = candidate_id
            return candidate_id, True

        return self._last_confirmed_landmark, False


def generate_constrained_instruction(
    landmark_name: str,
    distance_meters: float,
    next_maneuver: Optional[str] = "continue",
    language: str = "en",
) -> str:
    """Generate constrained template-based pedestrian instruction from validated landmark data.
    Strictly avoids free-form hallucinations; supports English and Hindi templates.
    """
    dist_int = max(5, int(round(distance_meters / 5.0) * 5))
    if language == "hi":
        if next_maneuver == "turn_right":
            return f"{landmark_name} के पास दाएं मुड़ें ({dist_int} मीटर)"
        elif next_maneuver == "turn_left":
            return f"{landmark_name} के पास बाएं मुड़ें ({dist_int} मीटर)"
        return f"{landmark_name} के आगे सीधे चलते रहें ({dist_int} मीटर)"

    # Default English
    if next_maneuver == "turn_right":
        return f"Turn right at {landmark_name} in {dist_int} meters"
    elif next_maneuver == "turn_left":
        return f"Turn left at {landmark_name} in {dist_int} meters"
    return f"Continue straight past {landmark_name} for {dist_int} meters"


class VisionLocalizationEngine:
    """Executes the discrete 12-step pipeline for visual localization."""

    def __init__(
        self,
        store: Optional[LandmarkStore] = None,
        cache: Optional[TileCandidateCache] = None,
        vision_provider: Optional[VisionProvider] = None,
        ocr_provider: Optional[OCRProvider] = None,
        calibrator: Optional[ConfidenceCalibrator] = None,
        stabilizer: Optional[DwellStabilizer] = None,
    ):
        self.store = store or default_landmark_store
        self.cache = cache or default_tile_cache
        self.vision_provider = vision_provider or get_vision_provider()
        self.ocr_provider = ocr_provider or get_ocr_provider()
        self.calibrator = calibrator or default_calibrator
        self.stabilizer = stabilizer or DwellStabilizer()
        self.matcher = LandmarkMatcher(
            vision_provider=self.vision_provider,
            ocr_provider=self.ocr_provider,
            calibrator=self.calibrator,
        )

    def process(
        self,
        session_id: str,
        user_lat: float,
        user_lon: float,
        horizontal_accuracy_meters: float,
        heading_deg: Optional[float] = None,
        image_base64: Optional[str] = None,
        feature_vector: Optional[List[float]] = None,
        route_step_sequence: Optional[int] = None,
        next_maneuver: Optional[str] = "straight",
        visual_consent: bool = False,
    ) -> LocalizationEstimate:
        """Process incoming localization query frame or features.
        Enforces privacy: camera images are NEVER persisted by default.
        """
        evidence_items: List[EvidenceItem] = []

        # Always add GPS evidence
        gps_valid = horizontal_accuracy_meters <= 25.0
        evidence_items.append(
            EvidenceItem(
                type="gps",
                validated=gps_valid,
                source="device_gps",
                score=max(0.0, 1.0 - (horizontal_accuracy_meters / 50.0)),
            )
        )

        # Safety Check 1: GPS uncertainty too large (> 25m) -> visual matching cannot safely confirm location
        if not gps_valid:
            return LocalizationEstimate(
                landmark_name=None,
                match_confidence=0.0,
                location_confirmed=False,
                distance_to_landmark_meters=None,
                next_instruction="GPS accuracy degraded. Please walk to an open area.",
                next_maneuver=next_maneuver,
                distance_to_next_maneuver_meters=None,
                requires_relocalization=True,
                evidence=evidence_items,
                model_version=f"{self.vision_provider.name}-v1",
                mode="SIMULATED",
            )

        # Safety Check 2: Visual consent check
        if not visual_consent:
            return LocalizationEstimate(
                landmark_name=None,
                match_confidence=0.0,
                location_confirmed=False,
                distance_to_landmark_meters=None,
                next_instruction=None,
                next_maneuver=next_maneuver,
                distance_to_next_maneuver_meters=None,
                requires_relocalization=False,
                evidence=evidence_items,
                model_version=f"{self.vision_provider.name}-v1",
                mode="SIMULATED",
            )

        # Decode image if provided
        image_bytes: Optional[bytes] = None
        if image_base64:
            try:
                image_bytes = base64.b64decode(image_base64)
            except Exception:
                logger.warning("Failed to decode base64 image payload")

        # 1-2. Candidate retrieval (tile cache -> spatial cone)
        candidates = retrieve_candidates(
            user_lat=user_lat,
            user_lon=user_lon,
            user_heading_deg=heading_deg,
            max_radius_meters=150.0,
            store=self.store,
            cache=self.cache,
        )

        if not candidates:
            return LocalizationEstimate(
                landmark_name=None,
                match_confidence=0.0,
                location_confirmed=False,
                distance_to_landmark_meters=None,
                next_instruction=None,
                next_maneuver=next_maneuver,
                distance_to_next_maneuver_meters=None,
                requires_relocalization=False,
                evidence=evidence_items,
                model_version=f"{self.vision_provider.name}-v1",
                mode="SIMULATED",
            )

        # 3-7. Visual & OCR Matching with rejection gates
        match_result = self.matcher.match(
            query_image_bytes=image_bytes,
            query_vector=feature_vector,
            user_lat=user_lat,
            user_lon=user_lon,
            user_heading_deg=heading_deg,
            horizontal_accuracy_meters=horizontal_accuracy_meters,
            candidates=candidates,
        )

        evidence_items.extend(match_result.evidence)

        if not match_result.matched or not match_result.passed_rejection_gates or not match_result.candidate:
            # Pipeline abstains on rejection
            return LocalizationEstimate(
                landmark_name=None,
                match_confidence=0.0,
                location_confirmed=False,
                distance_to_landmark_meters=None,
                next_instruction=None,
                next_maneuver=next_maneuver,
                distance_to_next_maneuver_meters=None,
                requires_relocalization=False,
                evidence=evidence_items,
                model_version=f"{self.vision_provider.name}-v1",
                mode="SIMULATED",
            )

        # 11. Hysteresis & Dwell Stabilization
        stable_id, is_stable = self.stabilizer.update(match_result.candidate.landmark_id)
        if not is_stable:
            # Candidate seen, but dwell threshold not yet met -> abstain from premature instruction switch
            return LocalizationEstimate(
                landmark_name=None,
                match_confidence=match_result.calibrated_confidence,
                location_confirmed=False,
                distance_to_landmark_meters=match_result.candidate.distance_meters,
                next_instruction=None,
                next_maneuver=next_maneuver,
                distance_to_next_maneuver_meters=None,
                requires_relocalization=False,
                evidence=evidence_items,
                model_version=f"{self.vision_provider.name}-v1",
                mode="SIMULATED",
            )

        # 12. Constrained instruction generation from validated landmark
        dist = match_result.candidate.distance_meters or 20.0
        instruction = generate_constrained_instruction(
            landmark_name=match_result.candidate.name,
            distance_meters=dist,
            next_maneuver=next_maneuver,
            language="en",
        )

        return LocalizationEstimate(
            landmark_name=match_result.candidate.name,
            match_confidence=match_result.calibrated_confidence,
            location_confirmed=True,
            distance_to_landmark_meters=dist,
            next_instruction=instruction,
            next_maneuver=next_maneuver,
            distance_to_next_maneuver_meters=dist + 15.0,
            requires_relocalization=False,
            evidence=evidence_items,
            model_version=f"{self.vision_provider.name}-v1",
            mode="SIMULATED",
        )
