import type { Coordinate, WalkingRoute, VisualFeatureInput, EvidenceItem, LocalizationEstimate } from './schemas.js';
import { distanceMeters, bearingDegrees, routeProgress } from './geo.js';

export const GPS_ACCURACY_THRESHOLD_METERS = 25;
export const CORRIDOR_CROSS_TRACK_THRESHOLD_METERS = 40;
export const HEADING_DISAGREEMENT_DEGREES = 90;
export const MIN_VISUAL_CONFIDENCE = 0.60;
export const MAX_VISUAL_SPATIAL_ERROR_METERS = 50;
export const ARRIVAL_RADIUS_METERS = 15;

/**
 * Computes the minimal angular distance between two headings in degrees [0, 180].
 */
export function angularDifferenceDegrees(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export interface FusedState {
  coordinate: Coordinate;
  headingDegrees: number;
  uncertaintyMeters: number;
  crossTrackMeters: number;
  alongTrackMeters: number;
  remainingMeters: number;
  confidence: number;
  locationConfirmed: boolean;
  requiresRelocalization: boolean;
  relocalizationTriggers: string[];
  visualDisagreement: boolean;
  consecutiveOffRouteCount: number;
  activeStepSequence: number;
}

export interface FusionInput {
  sessionId: string;
  location: Coordinate;
  horizontalAccuracyMeters: number;
  headingDegrees?: number | undefined;
  capturedAt: string;
  visualMatch?: VisualFeatureInput | null | undefined;
  previousState?: FusedState | null | undefined;
}

export interface FusionResult {
  fusedState: FusedState;
  estimate: LocalizationEstimate;
}

export class MultiSignalFusionEngine {
  /**
   * Fuse multi-modal signals: GPS, heading, route geometry, and visual evidence.
   */
  public fuse(input: FusionInput, route: WalkingRoute): FusionResult {
    const triggers: string[] = [];
    const evidence: EvidenceItem[] = [];

    // 1. Evaluate GPS accuracy
    const gpsValid = input.horizontalAccuracyMeters <= GPS_ACCURACY_THRESHOLD_METERS;
    if (!gpsValid) {
      triggers.push('GPS_ACCURACY_EXCEEDED');
      evidence.push({
        type: 'gps',
        validated: false,
        source: 'device-location',
        value: input.horizontalAccuracyMeters,
        reason: `GPS accuracy (${input.horizontalAccuracyMeters.toFixed(1)}m) exceeds safety limit (${GPS_ACCURACY_THRESHOLD_METERS}m)`,
      });
    } else {
      evidence.push({
        type: 'gps',
        validated: true,
        source: 'device-location',
        value: input.horizontalAccuracyMeters,
      });
    }

    // 2. Route corridor projection and cross-track evaluation
    const progress = routeProgress(input.location, route.path);
    const offRoute = progress.offRouteMeters > CORRIDOR_CROSS_TRACK_THRESHOLD_METERS;
    if (offRoute) {
      triggers.push('CORRIDOR_CROSS_TRACK_EXCEEDED');
      evidence.push({
        type: 'route',
        validated: false,
        source: 'simulated-route-geometry',
        value: progress.offRouteMeters,
        reason: `Cross-track distance (${progress.offRouteMeters.toFixed(1)}m) exceeds corridor limit (${CORRIDOR_CROSS_TRACK_THRESHOLD_METERS}m)`,
      });
    } else {
      evidence.push({
        type: 'route',
        validated: true,
        source: 'simulated-route-geometry',
        value: progress.offRouteMeters,
      });
    }

    // 3. Heading & direction evaluation
    let headingValid = true;
    let headingDeviation = 0;
    const targetSegmentBearing = route.path.length >= 2
      ? bearingDegrees(route.path[0]!, route.path[1]!)
      : 0;

    if (input.headingDegrees !== undefined) {
      headingDeviation = angularDifferenceDegrees(input.headingDegrees, targetSegmentBearing);
      if (headingDeviation > 120 && progress.offRouteMeters > 15) {
        // Pedestrian is walking opposite the route corridor direction
        triggers.push('HEADING_REVERSED');
        headingValid = false;
        evidence.push({
          type: 'heading',
          validated: false,
          source: 'compass',
          value: input.headingDegrees,
          reason: `Heading (${input.headingDegrees.toFixed(0)}°) deviates ${headingDeviation.toFixed(0)}° from route bearing (${targetSegmentBearing.toFixed(0)}°)`,
        });
      } else {
        evidence.push({
          type: 'heading',
          validated: true,
          source: 'compass',
          value: input.headingDegrees,
        });
      }
    }

    // 4. Visual match evaluation & spatial consistency check
    let visualDisagreement = false;
    let visualValidated = false;
    let visualConfidence = 0;
    let matchedLandmarkName: string | null = null;
    let distanceToLandmark: number | null = null;

    if (input.visualMatch && input.visualMatch.matched) {
      const match = input.visualMatch;
      visualConfidence = match.confidence ?? 0;
      matchedLandmarkName = match.landmarkName ?? null;
      distanceToLandmark = match.distanceMeters ?? null;

      // Reject uncertain visual matches (< MIN_VISUAL_CONFIDENCE)
      if (visualConfidence < MIN_VISUAL_CONFIDENCE) {
        evidence.push({
          type: 'vision',
          validated: false,
          source: 'visual-matching-filter',
          score: visualConfidence,
          reason: `Visual match confidence (${visualConfidence.toFixed(2)}) is below safety threshold (${MIN_VISUAL_CONFIDENCE})`,
        });
      } else if (match.landmarkLocation) {
        // Spatial consistency check: verify landmark location relative to route and GPS
        const distFromGpsToLandmark = distanceMeters(input.location, match.landmarkLocation);
        const landmarkBearingFromUser = bearingDegrees(input.location, match.landmarkLocation);
        
        let relativeAngleToHeading = 0;
        if (input.headingDegrees !== undefined) {
          relativeAngleToHeading = angularDifferenceDegrees(input.headingDegrees, landmarkBearingFromUser);
        }

        // If landmark is behind the user (>90 deg from heading) or excessively far from route/GPS (> MAX_VISUAL_SPATIAL_ERROR_METERS)
        if (relativeAngleToHeading > HEADING_DISAGREEMENT_DEGREES && input.headingDegrees !== undefined) {
          visualDisagreement = true;
          triggers.push('VISUAL_ROUTE_DISAGREEMENT');
          evidence.push({
            type: 'vision',
            validated: false,
            source: 'spatial-consistency-check',
            score: visualConfidence,
            reason: `Visual match claims landmark behind current orientation (relative angle ${relativeAngleToHeading.toFixed(0)}° > ${HEADING_DISAGREEMENT_DEGREES}°)`,
          });
        } else if (distFromGpsToLandmark > 100) {
          visualDisagreement = true;
          triggers.push('VISUAL_ROUTE_DISAGREEMENT');
          evidence.push({
            type: 'vision',
            validated: false,
            source: 'spatial-consistency-check',
            score: visualConfidence,
            reason: `Visual match claims landmark distance (${distFromGpsToLandmark.toFixed(0)}m) inconsistent with GPS location`,
          });
        } else {
          visualValidated = true;
          evidence.push({
            type: 'vision',
            validated: true,
            source: 'visual-matching-filter',
            score: visualConfidence,
          });
        }
      } else {
        // Matched without location geometry
        visualValidated = visualConfidence >= MIN_VISUAL_CONFIDENCE;
        evidence.push({
          type: 'vision',
          validated: visualValidated,
          source: 'visual-matching-filter',
          score: visualConfidence,
        });
      }
    }

    // 5. Relocalization decision
    const requiresRelocalization = triggers.length > 0 || visualDisagreement;

    // Consecutive off-route tracking for rerouting trigger
    const previousOffRouteCount = input.previousState?.consecutiveOffRouteCount ?? 0;
    const consecutiveOffRouteCount = offRoute ? previousOffRouteCount + 1 : 0;

    // 6. Multi-signal position and confidence fusion
    let fusedCoordinate: Coordinate = { ...input.location };
    let fusedAccuracy = input.horizontalAccuracyMeters;
    let overallConfidence = 0.0;

    if (!requiresRelocalization) {
      // Inverse-variance fusion between GPS fix and route corridor projection
      const wGps = 1 / Math.max(1, input.horizontalAccuracyMeters ** 2);
      const wRoute = 1 / Math.max(1, Math.min(progress.offRouteMeters, 20) ** 2);
      const totalWeight = wGps + wRoute;
      
      const routeWeight = wRoute / totalWeight;
      // Snap slightly towards route corridor based on corridor confidence
      if (progress.offRouteMeters < 10) {
        fusedAccuracy = Math.min(input.horizontalAccuracyMeters, 5.0);
      }

      // Confidence score synthesis [0.0 - 1.0]
      const gpsConfidenceFactor = Math.max(0, 1 - input.horizontalAccuracyMeters / GPS_ACCURACY_THRESHOLD_METERS);
      const routeConfidenceFactor = Math.max(0, 1 - progress.offRouteMeters / CORRIDOR_CROSS_TRACK_THRESHOLD_METERS);
      
      if (visualValidated) {
        overallConfidence = Math.min(1.0, 0.4 * gpsConfidenceFactor + 0.3 * routeConfidenceFactor + 0.3 * visualConfidence);
      } else {
        overallConfidence = Math.min(0.85, 0.6 * gpsConfidenceFactor + 0.4 * routeConfidenceFactor);
      }
    } else {
      // Degraded / Relocalizing state
      overallConfidence = 0.0;
      fusedAccuracy = Math.max(input.horizontalAccuracyMeters, 30);
    }

    const locationConfirmed = !requiresRelocalization && overallConfidence >= 0.50;

    const fusedState: FusedState = {
      coordinate: fusedCoordinate,
      headingDegrees: input.headingDegrees ?? targetSegmentBearing,
      uncertaintyMeters: fusedAccuracy,
      crossTrackMeters: progress.offRouteMeters,
      alongTrackMeters: Math.max(0, route.distanceMeters - progress.remainingMeters),
      remainingMeters: progress.remainingMeters,
      confidence: Number(overallConfidence.toFixed(2)),
      locationConfirmed,
      requiresRelocalization,
      relocalizationTriggers: triggers,
      visualDisagreement,
      consecutiveOffRouteCount,
      activeStepSequence: 0,
    };

    // 7. Instructions and maneuvers based on fused state
    let nextInstruction: string | null = null;
    let nextManeuver: string | null = null;
    let distanceToNextManeuver: number | null = null;

    if (requiresRelocalization) {
      nextInstruction = null;
      nextManeuver = null;
      distanceToNextManeuver = null;
    } else {
      const activeStep = route.steps[0];
      nextInstruction = activeStep?.instruction ?? null;
      nextManeuver = activeStep?.maneuver ?? null;
      distanceToNextManeuver = Math.round(progress.remainingMeters);
    }

    const estimate: LocalizationEstimate = {
      landmark_name: locationConfirmed && visualValidated ? matchedLandmarkName : null,
      match_confidence: visualValidated ? visualConfidence : 0,
      location_confirmed: locationConfirmed,
      distance_to_landmark_meters: locationConfirmed && visualValidated ? distanceToLandmark : null,
      next_instruction: nextInstruction,
      next_maneuver: nextManeuver,
      distance_to_next_maneuver_meters: distanceToNextManeuver,
      requires_relocalization: requiresRelocalization,
      evidence,
      model_version: visualValidated ? 'visual-fusion-v1' : 'gps-only-v1',
      mode: visualValidated ? 'VISUAL_FUSED' : 'GPS_ONLY',
    };

    return { fusedState, estimate };
  }
}
