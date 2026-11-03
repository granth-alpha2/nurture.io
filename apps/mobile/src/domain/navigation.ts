export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface LandmarkReference {
  landmarkId: string;
  name: string;
  location: Coordinate;
}

export interface RouteStep {
  sequence: number;
  instruction: string;
  maneuver: string;
  distanceMeters: number;
  crossing: boolean;
  landmarks?: LandmarkReference[];
}

export interface WalkingRoute {
  routeId: string;
  mode: 'SIMULATED';
  distanceMeters: number;
  durationSeconds: number;
  path: Coordinate[];
  steps: RouteStep[];
  warning: string;
}

export interface LocalizationEstimate {
  landmark_name: string | null;
  match_confidence: number;
  location_confirmed: boolean;
  distance_to_landmark_meters: number | null;
  next_instruction: string | null;
  next_maneuver: string | null;
  distance_to_next_maneuver_meters: number | null;
  requires_relocalization: boolean;
  evidence: Array<{ type: string; validated: boolean; source: string }>;
  model_version: string;
  mode: 'GPS_ONLY' | 'VISUAL_FUSED' | 'SIMULATED';
}

const earthRadiusMeters = 6_371_000;
const toRadians = (degrees: number) => degrees * Math.PI / 180;

export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const latitudeA = toRadians(from.latitude);
  const latitudeB = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const latitudeA = toRadians(from.latitude);
  const latitudeB = toRadians(to.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeB);
  const x =
    Math.cos(latitudeA) * Math.sin(latitudeB)
    - Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function bearingArrow(degrees: number): string {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[Math.round(degrees / 45) % arrows.length] ?? '↑';
}

export function relativeBearingDegrees(bearing: number, heading: number): number {
  return (bearing - heading + 360) % 360;
}

export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

export function isNearDestination(meters: number): boolean {
  return meters <= 15;
}

export function shouldReroute(consecutiveOffRouteFixes: number): boolean {
  return consecutiveOffRouteFixes >= 2;
}

export function gpsOnlyOfflineInstruction(
  current: Coordinate,
  destination: Coordinate,
): string {
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const direction = directions[Math.round(bearingDegrees(current, destination) / 45) % directions.length];
  return `GPS-only fallback: head ${direction} toward the selected demo point.`;
}

export type NavigationState = 'idle' | 'active' | 'relocalizing' | 'rerouting' | 'arrived' | 'paused';

export interface RelocalizationCheckInput {
  horizontalAccuracyMeters: number;
  crossTrackMeters: number;
  visualDisagreement?: boolean;
}

export function evaluateRelocalizationTrigger(input: RelocalizationCheckInput): {
  requiresRelocalization: boolean;
  reason?: 'GPS_ACCURACY_EXCEEDED' | 'CORRIDOR_CROSS_TRACK_EXCEEDED' | 'VISUAL_ROUTE_DISAGREEMENT';
} {
  if (input.horizontalAccuracyMeters > 25) {
    return { requiresRelocalization: true, reason: 'GPS_ACCURACY_EXCEEDED' };
  }
  if (input.crossTrackMeters > 40) {
    return { requiresRelocalization: true, reason: 'CORRIDOR_CROSS_TRACK_EXCEEDED' };
  }
  if (input.visualDisagreement) {
    return { requiresRelocalization: true, reason: 'VISUAL_ROUTE_DISAGREEMENT' };
  }
  return { requiresRelocalization: false };
}

export interface ArCorePose {
  horizontalAccuracyMeters: number;
  headingAccuracyDegrees: number;
  trackingState: 'TRACKING' | 'PAUSED' | 'STOPPED';
}

export function isArArrowReady(pose: ArCorePose | null): {
  ready: boolean;
  arrowType: '3D_AR' | '2D_DIRECTIONAL';
  reason?: string;
} {
  if (!pose || pose.trackingState !== 'TRACKING') {
    return { ready: false, arrowType: '2D_DIRECTIONAL', reason: 'Not tracking' };
  }
  if (pose.horizontalAccuracyMeters > 5.0) {
    return { ready: false, arrowType: '2D_DIRECTIONAL', reason: 'Horizontal accuracy exceeds 5m' };
  }
  if (pose.headingAccuracyDegrees > 15.0) {
    return { ready: false, arrowType: '2D_DIRECTIONAL', reason: 'Heading accuracy exceeds 15 deg' };
  }
  return { ready: true, arrowType: '3D_AR' };
}

export function formatLandmarkInstruction(
  distanceToManeuver: number,
  maneuver: string,
  landmarkName?: string | null,
): string {
  if (!landmarkName) {
    return `In ${Math.round(distanceToManeuver)}m, ${maneuver}`;
  }
  if (distanceToManeuver > 20) {
    return `Walk ${Math.round(distanceToManeuver)}m towards ${landmarkName}`;
  }
  return `${maneuver} past ${landmarkName}`;
}
