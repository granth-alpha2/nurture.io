import type { Coordinate } from './schemas.js';

export type ArCoreTrackingState = 'TRACKING' | 'PAUSED' | 'STOPPED';

export interface ArCoreGeospatialPose {
  latitude: number;
  longitude: number;
  altitude: number;
  headingDegrees: number;
  horizontalAccuracyMeters: number;
  verticalAccuracyMeters: number;
  headingAccuracyDegrees: number;
  trackingState: ArCoreTrackingState;
  timestampMs: number;
}

export type ArrowDisplayMode = '3D_AR_ARROW' | '2D_DIRECTIONAL_COMPASS' | 'DISABLED';

export interface ArArrowReadinessResult {
  readyForArArrow: boolean;
  displayMode: ArrowDisplayMode;
  reason?: string | undefined;
  horizontalAccuracyMeters: number;
  headingAccuracyDegrees: number;
  recommendedFallbackArrow?: string | undefined;
}

export interface ArCoreGeospatialEvaluationRecord {
  evaluationStatus: 'EVALUATION_ONLY' | 'REJECTED' | 'ACCEPTED_PILOT';
  coverageStatusIndia: string;
  deviceSupportAssessment: string;
  licensingComplianceCheck: string;
  costAssessment: string;
  adrReference: string;
}

export const ARCORE_MAX_HORIZONTAL_ACCURACY_METERS = 5.0;
export const ARCORE_MAX_HEADING_ACCURACY_DEGREES = 15.0;

export class ArCoreGeospatialAdapter {
  /**
   * Determine whether the ARCore Geospatial camera pose satisfies strict pedestrian safety thresholds
   * for projecting a 3D augmented-reality directional arrow in the camera viewport.
   * If thresholds are not met, safely falls back to a 2D directional arrow.
   */
  public evaluateArrowReadiness(
    pose: ArCoreGeospatialPose | null,
    targetBearingDegrees: number,
  ): ArArrowReadinessResult {
    // 1. Missing or uninitialized pose
    if (!pose) {
      return {
        readyForArArrow: false,
        displayMode: '2D_DIRECTIONAL_COMPASS',
        reason: 'ARCore Geospatial pose not available; falling back to 2D compass arrow.',
        horizontalAccuracyMeters: Number.POSITIVE_INFINITY,
        headingAccuracyDegrees: Number.POSITIVE_INFINITY,
        recommendedFallbackArrow: this.bearingToArrow(targetBearingDegrees),
      };
    }

    // 2. Tracking state verification
    if (pose.trackingState !== 'TRACKING') {
      return {
        readyForArArrow: false,
        displayMode: '2D_DIRECTIONAL_COMPASS',
        reason: `ARCore tracking state is ${pose.trackingState}; requires TRACKING for 3D overlay.`,
        horizontalAccuracyMeters: pose.horizontalAccuracyMeters,
        headingAccuracyDegrees: pose.headingAccuracyDegrees,
        recommendedFallbackArrow: this.bearingToArrow(targetBearingDegrees - pose.headingDegrees),
      };
    }

    // 3. Horizontal position accuracy threshold check (<= 5.0m)
    if (pose.horizontalAccuracyMeters > ARCORE_MAX_HORIZONTAL_ACCURACY_METERS) {
      return {
        readyForArArrow: false,
        displayMode: '2D_DIRECTIONAL_COMPASS',
        reason: `Geospatial horizontal accuracy (${pose.horizontalAccuracyMeters.toFixed(1)}m) exceeds ${ARCORE_MAX_HORIZONTAL_ACCURACY_METERS}m safety limit.`,
        horizontalAccuracyMeters: pose.horizontalAccuracyMeters,
        headingAccuracyDegrees: pose.headingAccuracyDegrees,
        recommendedFallbackArrow: this.bearingToArrow(targetBearingDegrees - pose.headingDegrees),
      };
    }

    // 4. Heading accuracy threshold check (<= 15.0 deg)
    if (pose.headingAccuracyDegrees > ARCORE_MAX_HEADING_ACCURACY_DEGREES) {
      return {
        readyForArArrow: false,
        displayMode: '2D_DIRECTIONAL_COMPASS',
        reason: `Geospatial heading accuracy (${pose.headingAccuracyDegrees.toFixed(1)}°) exceeds ${ARCORE_MAX_HEADING_ACCURACY_DEGREES}° safety limit.`,
        horizontalAccuracyMeters: pose.horizontalAccuracyMeters,
        headingAccuracyDegrees: pose.headingAccuracyDegrees,
        recommendedFallbackArrow: this.bearingToArrow(targetBearingDegrees - pose.headingDegrees),
      };
    }

    // All safety thresholds satisfied: safe for 3D AR arrow
    return {
      readyForArArrow: true,
      displayMode: '3D_AR_ARROW',
      horizontalAccuracyMeters: pose.horizontalAccuracyMeters,
      headingAccuracyDegrees: pose.headingAccuracyDegrees,
    };
  }

  /**
   * Translates relative angle in degrees into an 8-way cardinal arrow symbol.
   */
  public bearingToArrow(relativeDegrees: number): string {
    const normalized = (relativeDegrees + 360) % 360;
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    const index = Math.round(normalized / 45) % arrows.length;
    return arrows[index] ?? '↑';
  }

  /**
   * Return formal evaluation assessment per ADR 0006.
   */
  public getEvaluationRecord(): ArCoreGeospatialEvaluationRecord {
    return {
      evaluationStatus: 'EVALUATION_ONLY',
      coverageStatusIndia: 'Unverified / Partial. Street View VPS coverage is limited to select major metro corridors; not available in tier-2/tier-3 cities. Fallback required.',
      deviceSupportAssessment: 'Requires ARCore supported Android devices with ARCore APK and Google Play Services. Lower-end devices lack hardware support.',
      licensingComplianceCheck: 'Google Maps Platform Geospatial API terms require active billing account, per-session API quotas, and attribution constraints.',
      costAssessment: 'Geospatial API calls incur billing per VPS request; fallback to local fusion is required to contain operational cost.',
      adrReference: 'docs/adr/0006-arcore-geospatial-evaluation.md',
    };
  }
}
