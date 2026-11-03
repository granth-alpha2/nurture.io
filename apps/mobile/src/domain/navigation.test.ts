import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bearingArrow,
  bearingDegrees,
  distanceMeters,
  formatDistance,
  gpsOnlyOfflineInstruction,
  isNearDestination,
  shouldReroute,
  evaluateRelocalizationTrigger,
  isArArrowReady,
  formatLandmarkInstruction,
} from './navigation';

describe('navigation domain', () => {
  it('calculates zero and known short distances', () => {
    const origin = { latitude: 0, longitude: 0 };
    assert.equal(distanceMeters(origin, origin), 0);
    assert.ok(Math.abs(distanceMeters(origin, { latitude: 0, longitude: 0.001 }) - 111.2) < 1);
  });

  it('calculates cardinal bearings and maps them to arrows', () => {
    const origin = { latitude: 0, longitude: 0 };
    assert.ok(Math.abs(bearingDegrees(origin, { latitude: 1, longitude: 0 })) < 0.01);
    assert.equal(bearingArrow(0), '↑');
    assert.equal(bearingArrow(90), '→');
  });

  it('formats distances for simple spoken copy', () => {
    assert.equal(formatDistance(32.8), '33 m');
    assert.equal(formatDistance(1250), '1.3 km');
  });

  it('does not claim arrival outside the explicit confirmation radius', () => {
    assert.equal(isNearDestination(15), true);
    assert.equal(isNearDestination(15.1), false);
  });

  it('requires repeated off-route fixes before rerouting', () => {
    assert.equal(shouldReroute(1), false);
    assert.equal(shouldReroute(2), true);
  });

  it('provides explicit GPS-only degraded guidance', () => {
    const message = gpsOnlyOfflineInstruction(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );
    assert.match(message, /GPS-only fallback/);
    assert.match(message, /north/);
  });

  it('evaluates relocalization triggers for degraded GPS, cross-track, or visual disagreement', () => {
    // Normal fix
    assert.equal(
      evaluateRelocalizationTrigger({ horizontalAccuracyMeters: 10, crossTrackMeters: 5 }).requiresRelocalization,
      false,
    );
    // Degraded GPS (>25m)
    const gpsTrigger = evaluateRelocalizationTrigger({ horizontalAccuracyMeters: 28, crossTrackMeters: 5 });
    assert.equal(gpsTrigger.requiresRelocalization, true);
    assert.equal(gpsTrigger.reason, 'GPS_ACCURACY_EXCEEDED');

    // Corridor cross-track violation (>40m)
    const crossTrackTrigger = evaluateRelocalizationTrigger({ horizontalAccuracyMeters: 8, crossTrackMeters: 45 });
    assert.equal(crossTrackTrigger.requiresRelocalization, true);
    assert.equal(crossTrackTrigger.reason, 'CORRIDOR_CROSS_TRACK_EXCEEDED');

    // Visual route disagreement
    const visualTrigger = evaluateRelocalizationTrigger({
      horizontalAccuracyMeters: 8,
      crossTrackMeters: 5,
      visualDisagreement: true,
    });
    assert.equal(visualTrigger.requiresRelocalization, true);
    assert.equal(visualTrigger.reason, 'VISUAL_ROUTE_DISAGREEMENT');
  });

  it('gates AR 3D arrow readiness on ARCore pose accuracy thresholds', () => {
    // High accuracy pose
    const goodPose = { horizontalAccuracyMeters: 2.5, headingAccuracyDegrees: 8, trackingState: 'TRACKING' as const };
    assert.deepEqual(isArArrowReady(goodPose), { ready: true, arrowType: '3D_AR' });

    // Degraded horizontal accuracy (>5m)
    const degradedHorizontal = { horizontalAccuracyMeters: 6.2, headingAccuracyDegrees: 8, trackingState: 'TRACKING' as const };
    assert.equal(isArArrowReady(degradedHorizontal).ready, false);
    assert.equal(isArArrowReady(degradedHorizontal).arrowType, '2D_DIRECTIONAL');

    // Degraded heading accuracy (>15 deg)
    const degradedHeading = { horizontalAccuracyMeters: 3.0, headingAccuracyDegrees: 22, trackingState: 'TRACKING' as const };
    assert.equal(isArArrowReady(degradedHeading).ready, false);
    assert.equal(isArArrowReady(degradedHeading).arrowType, '2D_DIRECTIONAL');

    // Stopped tracking
    const stoppedTracking = { horizontalAccuracyMeters: 2.0, headingAccuracyDegrees: 5, trackingState: 'STOPPED' as const };
    assert.equal(isArArrowReady(stoppedTracking).ready, false);
    assert.equal(isArArrowReady(stoppedTracking).arrowType, '2D_DIRECTIONAL');
  });

  it('formats landmark-anchored instruction sequencing', () => {
    // Approaching landmark (>20m)
    const approaching = formatLandmarkInstruction(50, 'Turn left', 'Red Brick Building');
    assert.equal(approaching, 'Walk 50m towards Red Brick Building');

    // Turning past landmark (<=20m)
    const turnPast = formatLandmarkInstruction(12, 'Turn left', 'City Pharmacy');
    assert.equal(turnPast, 'Turn left past City Pharmacy');

    // Fallback without landmark
    const standard = formatLandmarkInstruction(30, 'Turn right');
    assert.equal(standard, 'In 30m, Turn right');
  });
});
