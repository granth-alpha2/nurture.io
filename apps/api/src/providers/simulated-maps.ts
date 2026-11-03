import { randomUUID } from 'node:crypto';
import { bearingDegrees, distanceMeters, formatBearingInstruction, interpolate } from '../domain/geo.js';
import type { Coordinate, WalkingRoute } from '../domain/schemas.js';

const simulatedWarning =
  'SIMULATED DEMO ONLY: this is a straight-line route, not a verified pedestrian path. Do not use it for real-world navigation.';

export class SimulatedMapsProvider {
  readonly mode = 'SIMULATED' as const;

  searchPlaces(query: string, near: Coordinate): Array<{
    providerPlaceId: string;
    displayName: string;
    formattedAddress: string;
    location: Coordinate;
    attribution: string;
  }> {
    return [0, 1, 2].map((index) => ({
      providerPlaceId: `simulated-${index + 1}`,
      displayName: `SIMULATED destination ${index + 1}: ${query}`,
      formattedAddress: 'Synthetic local demo result — not a real place',
      location: {
        latitude: near.latitude + 0.0015 * (index + 1),
        longitude: near.longitude + 0.001 * (index + 1),
      },
      attribution: 'SIMULATED local fixture; no external map provider used',
    }));
  }

  walkingRoute(origin: Coordinate, destination: Coordinate): WalkingRoute {
    const distance = distanceMeters(origin, destination);
    const direction = bearingDegrees(origin, destination);
    const segments = 10;
    const path = Array.from({ length: segments + 1 }, (_, index) =>
      interpolate(origin, destination, index / segments));

    return {
      routeId: randomUUID(),
      mode: this.mode,
      distanceMeters: Math.round(distance),
      durationSeconds: Math.ceil(distance / 1.2),
      path,
      steps: [{
        sequence: 0,
        instruction: formatBearingInstruction(direction),
        maneuver: 'continue',
        distanceMeters: Math.round(distance),
        crossing: false,
      }],
      warning: simulatedWarning,
    };
  }
}

export const simulatedRouteWarning = simulatedWarning;
