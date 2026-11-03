"""Data models and schemas for LandmarkNav Vision service."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class EvidenceItem:
    """Multi-signal evidence item contributing to localization estimate."""
    type: str  # 'visual' | 'ocr' | 'gps' | 'route'
    validated: bool
    source: str = "simulated"
    score: Optional[float] = None
    timestamp: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "type": self.type,
            "validated": self.validated,
            "source": self.source,
        }
        if self.score is not None:
            d["score"] = round(self.score, 4)
        if self.timestamp is not None:
            d["timestamp"] = self.timestamp
        return d


@dataclass
class LandmarkProvenance:
    """Provenance and license tracking for persistent landmark reference data."""
    license: str  # e.g. 'CC-BY-4.0', 'CC-BY-SA-4.0', 'operator_owned', 'SIMULATED'
    source: str
    attribution: str
    is_simulated: bool = True
    ingested_at: Optional[str] = None

    def is_license_permitted(self) -> bool:
        """Enforce strict safety boundary: fail-closed on unknown or Google-derived persistent imagery."""
        disallowed = ["google", "street_view", "unknown", "proprietary_unlicensed"]
        lic_lower = self.license.lower()
        src_lower = self.source.lower()
        for term in disallowed:
            if term in lic_lower or term in src_lower:
                return False
        return lic_lower in [
            "cc-by-4.0",
            "cc-by-sa-4.0",
            "cc0",
            "operator_owned",
            "open_street_imagery",
            "simulated",
            "synthetic",
        ]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LandmarkRecord:
    """Ingested reference landmark with spatial coordinates and embedding vector."""
    landmark_id: str
    name: str
    latitude: float
    longitude: float
    h3_index: str
    geohash: str
    embedding: List[float] = field(default_factory=list)
    ocr_tokens: List[str] = field(default_factory=list)
    visual_tags: List[str] = field(default_factory=list)
    provenance: LandmarkProvenance = field(
        default_factory=lambda: LandmarkProvenance(
            license="SIMULATED",
            source="synthetic_seed",
            attribution="LandmarkNav synthetic test data",
            is_simulated=True,
        )
    )
    distance_meters: Optional[float] = None
    bearing_degrees: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "landmark_id": self.landmark_id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "h3_index": self.h3_index,
            "geohash": self.geohash,
            "embedding": self.embedding,
            "ocr_tokens": self.ocr_tokens,
            "visual_tags": self.visual_tags,
            "provenance": self.provenance.to_dict(),
            "distance_meters": round(self.distance_meters, 1) if self.distance_meters is not None else None,
            "bearing_degrees": round(self.bearing_degrees, 1) if self.bearing_degrees is not None else None,
        }


@dataclass
class VisualMatchResult:
    """Outcome of visual candidate matching and rejection gates."""
    matched: bool
    candidate: Optional[LandmarkRecord]
    similarity_score: float  # raw cosine similarity [-1, 1] -> normalized [0, 1]
    calibrated_confidence: float  # calibrated probability/score [0, 1]
    passed_rejection_gates: bool
    rejection_reason: Optional[str] = None
    evidence: List[EvidenceItem] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "matched": self.matched,
            "candidate": self.candidate.to_dict() if self.candidate else None,
            "similarity_score": round(self.similarity_score, 4),
            "calibrated_confidence": round(self.calibrated_confidence, 4),
            "passed_rejection_gates": self.passed_rejection_gates,
            "rejection_reason": self.rejection_reason,
            "evidence": [e.to_dict() for e in self.evidence],
        }


@dataclass
class LocalizationEstimate:
    """Standard versioned localization estimate conforming to OpenAPI contract."""
    landmark_name: Optional[str]
    match_confidence: float
    location_confirmed: bool
    distance_to_landmark_meters: Optional[float]
    next_instruction: Optional[str]
    next_maneuver: Optional[str]
    distance_to_next_maneuver_meters: Optional[float]
    requires_relocalization: bool
    evidence: List[EvidenceItem]
    model_version: str = "v1.0.0-simulated"
    mode: str = "SIMULATED"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "landmark_name": self.landmark_name,
            "match_confidence": round(self.match_confidence, 4),
            "location_confirmed": self.location_confirmed,
            "distance_to_landmark_meters": (
                round(self.distance_to_landmark_meters, 1)
                if self.distance_to_landmark_meters is not None
                else None
            ),
            "next_instruction": self.next_instruction,
            "next_maneuver": self.next_maneuver,
            "distance_to_next_maneuver_meters": (
                round(self.distance_to_next_maneuver_meters, 1)
                if self.distance_to_next_maneuver_meters is not None
                else None
            ),
            "requires_relocalization": self.requires_relocalization,
            "evidence": [e.to_dict() for e in self.evidence],
            "model_version": self.model_version,
            "mode": self.mode,
        }
