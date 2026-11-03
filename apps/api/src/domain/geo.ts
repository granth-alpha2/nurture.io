import type { Coordinate } from './schemas.js';

const earthRadiusMeters = 6_371_000;

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeA = radians(from.latitude);
  const latitudeB = radians(to.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeB);
  const x =
    Math.cos(latitudeA) * Math.sin(latitudeB)
    - Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function interpolate(from: Coordinate, to: Coordinate, fraction: number): Coordinate {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * fraction,
    longitude: from.longitude + (to.longitude - from.longitude) * fraction,
  };
}

export function routeProgress(
  point: Coordinate,
  path: Coordinate[],
): { remainingMeters: number; offRouteMeters: number } {
  if (path.length < 2) {
    return { remainingMeters: 0, offRouteMeters: Number.POSITIVE_INFINITY };
  }

  let totalLength = 0;
  const lengths = path.slice(1).map((pointOnPath, index) => {
    const length = distanceMeters(path[index]!, pointOnPath);
    totalLength += length;
    return length;
  });

  let traversed = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProgress = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]!;
    const end = path[index + 1]!;
    const latitudeScale = 111_320;
    const longitudeScale = latitudeScale * Math.cos(start.latitude * Math.PI / 180);
    const x = (point.longitude - start.longitude) * longitudeScale;
    const y = (point.latitude - start.latitude) * latitudeScale;
    const dx = (end.longitude - start.longitude) * longitudeScale;
    const dy = (end.latitude - start.latitude) * latitudeScale;
    const segmentLength = lengths[index]!;
    const denominator = dx * dx + dy * dy;
    const fraction = denominator === 0
      ? 0
      : Math.max(0, Math.min(1, (x * dx + y * dy) / denominator));
    const crossTrack = Math.hypot(x - fraction * dx, y - fraction * dy);

    if (crossTrack < bestDistance) {
      bestDistance = crossTrack;
      bestProgress = traversed + fraction * segmentLength;
    }
    traversed += segmentLength;
  }

  return {
    remainingMeters: Math.max(0, totalLength - bestProgress),
    offRouteMeters: bestDistance,
  };
}

export function formatBearingInstruction(bearing: number): string {
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return `SIMULATED: continue toward the ${directions[Math.round(bearing / 45) % directions.length]} demo point`;
}
