import type { Coordinate, WalkingRoute, RouteStep, LandmarkReference } from './schemas.js';
import type { FusedState } from './fusion-engine.js';
import { distanceMeters, bearingDegrees } from './geo.js';

export interface SequencedInstruction {
  instructionText: string;
  maneuver: string;
  distanceMeters: number;
  landmarkAnchor: string | null;
  isCrossingSafety: boolean;
  isRelocalizingFallback: boolean;
  isArrival: boolean;
  audioPrompt: string;
}

export interface HysteresisTracker {
  lastInstructionText: string;
  lastDistanceMeters: number;
  lastUpdatedTimestamp: number;
  lastLandmarkId: string | null;
}

const HYSTERESIS_MIN_DISTANCE_DELTA_METERS = 5;
const HYSTERESIS_MIN_TIME_DELTA_MS = 1500;
const CROSSING_WARNING_RADIUS_METERS = 25;
const TURN_PROXIMITY_THRESHOLD_METERS = 20;
const ARRIVAL_THRESHOLD_METERS = 15;

export class LandmarkInstructionSequencer {
  /**
   * Determine the current active route step based on remaining distance and along-track progress.
   */
  public findActiveStep(
    route: WalkingRoute,
    alongTrackMeters: number,
  ): { step: RouteStep; stepIndex: number; distanceToManeuverMeters: number } {
    if (route.steps.length === 0) {
      return {
        step: {
          sequence: 0,
          instruction: 'Proceed to destination',
          maneuver: 'straight',
          distanceMeters: route.distanceMeters,
          crossing: false,
        },
        stepIndex: 0,
        distanceToManeuverMeters: route.distanceMeters,
      };
    }

    let cumulativeDistance = 0;
    for (let i = 0; i < route.steps.length; i++) {
      cumulativeDistance += route.steps[i]!.distanceMeters;
      if (alongTrackMeters <= cumulativeDistance || i === route.steps.length - 1) {
        const stepStartDistance = cumulativeDistance - route.steps[i]!.distanceMeters;
        const stepProgress = Math.max(0, alongTrackMeters - stepStartDistance);
        const distanceToManeuver = Math.max(0, route.steps[i]!.distanceMeters - stepProgress);
        return { step: route.steps[i]!, stepIndex: i, distanceToManeuverMeters: distanceToManeuver };
      }
    }

    return {
      step: route.steps[0]!,
      stepIndex: 0,
      distanceToManeuverMeters: route.steps[0]!.distanceMeters,
    };
  }

  /**
   * Generate sequenced, accessible landmark turn guidance with safety overrides and hysteresis.
   */
  public sequence(
    fused: FusedState,
    route: WalkingRoute,
    previousTracker?: HysteresisTracker | null,
    now: number = Date.now(),
  ): { instruction: SequencedInstruction; tracker: HysteresisTracker } {
    // 1. Relocalization / Degraded Mode Fallback
    if (fused.requiresRelocalization) {
      let fallbackText = 'GPS signal degraded. Walk forward along the sidewalk and point camera at street signs.';
      if (fused.crossTrackMeters > 40) {
        fallbackText = `Off route by ${Math.round(fused.crossTrackMeters)}m. Walk toward the street to rejoin your route.`;
      } else if (fused.visualDisagreement) {
        fallbackText = 'Landmark mismatch detected. Continue straight and verify street name.';
      }

      const instruction: SequencedInstruction = {
        instructionText: fallbackText,
        maneuver: 'relocalize',
        distanceMeters: Math.round(fused.remainingMeters),
        landmarkAnchor: null,
        isCrossingSafety: false,
        isRelocalizingFallback: true,
        isArrival: false,
        audioPrompt: fallbackText,
      };

      const tracker: HysteresisTracker = {
        lastInstructionText: fallbackText,
        lastDistanceMeters: Math.round(fused.remainingMeters),
        lastUpdatedTimestamp: now,
        lastLandmarkId: null,
      };

      return { instruction, tracker };
    }

    // 2. Find active step and associated landmarks
    const { step, stepIndex, distanceToManeuverMeters } = this.findActiveStep(route, fused.alongTrackMeters);
    const stepLandmarks = step.landmarks ?? [];
    const isFinalStep = stepIndex === route.steps.length - 1;
    const distanceToManeuver = Math.round(distanceToManeuverMeters);

    // 3. Arrival Check (Must be on final step AND remaining distance to destination <= ARRIVAL_THRESHOLD_METERS)
    if (isFinalStep && fused.remainingMeters <= ARRIVAL_THRESHOLD_METERS) {
      const arrivalText = 'You have arrived at your destination.';
      const instruction: SequencedInstruction = {
        instructionText: arrivalText,
        maneuver: 'arrive',
        distanceMeters: 0,
        landmarkAnchor: null,
        isCrossingSafety: false,
        isRelocalizingFallback: false,
        isArrival: true,
        audioPrompt: 'You have arrived at your destination.',
      };

      return {
        instruction,
        tracker: {
          lastInstructionText: arrivalText,
          lastDistanceMeters: 0,
          lastUpdatedTimestamp: now,
          lastLandmarkId: null,
        },
      };
    }

    // 4. Pedestrian Crossing Safety Override
    if (step.crossing) {
      const crossingText = 'Pedestrian crossing ahead. Check both directions and cross safely. Screen paused.';
      const instruction: SequencedInstruction = {
        instructionText: crossingText,
        maneuver: 'cross',
        distanceMeters: distanceToManeuver,
        landmarkAnchor: null,
        isCrossingSafety: true,
        isRelocalizingFallback: false,
        isArrival: false,
        audioPrompt: crossingText,
      };

      return {
        instruction,
        tracker: {
          lastInstructionText: crossingText,
          lastDistanceMeters: distanceToManeuver,
          lastUpdatedTimestamp: now,
          lastLandmarkId: null,
        },
      };
    }

    // 5. Landmark-Anchored Turn Guidance
    const primaryLandmark = stepLandmarks[0] ?? null;
    let instructionText = step.instruction;
    let landmarkAnchor: string | null = null;

    if (primaryLandmark) {
      landmarkAnchor = primaryLandmark.name;
      if (distanceToManeuver > TURN_PROXIMITY_THRESHOLD_METERS) {
        // Approaching landmark
        instructionText = `Walk ${distanceToManeuver}m towards ${primaryLandmark.name}`;
      } else {
        // At or turning past landmark
        const maneuverName = step.maneuver.toLowerCase();
        if (maneuverName.includes('left') || maneuverName.includes('right')) {
          instructionText = `${step.maneuver} past ${primaryLandmark.name}`;
        } else {
          instructionText = `Continue straight past ${primaryLandmark.name}`;
        }
      }
    } else {
      // Step without explicit landmark: clean distance-anchored step
      instructionText = `${step.maneuver}: ${step.instruction} (${distanceToManeuver}m)`;
    }

    // 6. Anti-Flicker & Hysteresis Smoothing
    if (previousTracker) {
      const distanceDelta = Math.abs(distanceToManeuver - previousTracker.lastDistanceMeters);
      const timeDelta = now - previousTracker.lastUpdatedTimestamp;

      // If text hasn't changed maneuver type and distance delta is small within short duration, keep previous distance
      if (
        previousTracker.lastInstructionText.split(' ')[0] === instructionText.split(' ')[0]
        && distanceDelta < HYSTERESIS_MIN_DISTANCE_DELTA_METERS
        && timeDelta < HYSTERESIS_MIN_TIME_DELTA_MS
      ) {
        instructionText = previousTracker.lastInstructionText;
      }
    }

    const instruction: SequencedInstruction = {
      instructionText,
      maneuver: step.maneuver,
      distanceMeters: distanceToManeuver,
      landmarkAnchor,
      isCrossingSafety: false,
      isRelocalizingFallback: false,
      isArrival: false,
      audioPrompt: instructionText,
    };

    const tracker: HysteresisTracker = {
      lastInstructionText: instructionText,
      lastDistanceMeters: distanceToManeuver,
      lastUpdatedTimestamp: now,
      lastLandmarkId: primaryLandmark?.landmarkId ?? null,
    };

    return { instruction, tracker };
  }
}
