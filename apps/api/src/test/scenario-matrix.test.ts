import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { buildApp } from '../app.js';
import { MemoryNavigationRepository } from '../infra/repository.js';
import {
  MultiSignalFusionEngine,
  GPS_ACCURACY_THRESHOLD_METERS,
  CORRIDOR_CROSS_TRACK_THRESHOLD_METERS,
  angularDifferenceDegrees,
} from '../domain/fusion-engine.js';
import { LandmarkInstructionSequencer } from '../domain/instruction-sequencer.js';
import { NavigationStateMachine } from '../domain/navigation-state-machine.js';
import {
  ArCoreGeospatialAdapter,
  ARCORE_MAX_HORIZONTAL_ACCURACY_METERS,
  ARCORE_MAX_HEADING_ACCURACY_DEGREES,
} from '../domain/arcore-adapter.js';
import type { WalkingRoute } from '../domain/schemas.js';

describe('Phase 4 Fusion & Relocalization Scenario Matrix', () => {
  const repository = new MemoryNavigationRepository();
  const fusionEngine = new MultiSignalFusionEngine();
  const sequencer = new LandmarkInstructionSequencer();
  const arcoreAdapter = new ArCoreGeospatialAdapter();

  const sampleRoute: WalkingRoute = {
    routeId: '11111111-2222-4333-8444-555555555555',
    mode: 'SIMULATED',
    distanceMeters: 200,
    durationSeconds: 160,
    path: [
      { latitude: 12.9700, longitude: 77.5900 },
      { latitude: 12.9709, longitude: 77.5900 }, // ~100m north
      { latitude: 12.9709, longitude: 77.5909 }, // ~100m east
    ],
    steps: [
      {
        sequence: 0,
        instruction: 'Walk north on MG Road towards the Red Brick Library',
        maneuver: 'straight',
        distanceMeters: 100,
        crossing: false,
        landmarks: [
          {
            landmarkId: 'lm-001',
            name: 'Red Brick Library',
            location: { latitude: 12.9708, longitude: 77.5900 },
          },
        ],
      },
      {
        sequence: 1,
        instruction: 'Turn right past City Pharmacy onto Church Street',
        maneuver: 'turn-right',
        distanceMeters: 100,
        crossing: true,
        landmarks: [
          {
            landmarkId: 'lm-002',
            name: 'City Pharmacy',
            location: { latitude: 12.9709, longitude: 77.5901 },
          },
        ],
      },
    ],
    warning: 'SIMULATED route for testing',
  };

  before(async () => {
    await repository.saveRoute(sampleRoute);
  });

  describe('Scenario 1: GPS Drift & Recovery', () => {
    it('gradual GPS drift beyond 25m triggers requires_relocalization and falls back to GPS copy', () => {
      // Normal fix on route
      const fix1 = fusionEngine.fuse(
        {
          sessionId: 'session-1',
          location: { latitude: 12.9702, longitude: 77.5900 },
          horizontalAccuracyMeters: 8,
          headingDegrees: 0,
          capturedAt: new Date().toISOString(),
        },
        sampleRoute,
      );
      assert.equal(fix1.estimate.requires_relocalization, false);
      assert.equal(fix1.fusedState.locationConfirmed, true);

      // GPS drifts: accuracy degrades to 30m (> 25m threshold)
      const fix2 = fusionEngine.fuse(
        {
          sessionId: 'session-1',
          location: { latitude: 12.9704, longitude: 77.5900 },
          horizontalAccuracyMeters: 30, // degraded!
          headingDegrees: 0,
          capturedAt: new Date().toISOString(),
          previousState: fix1.fusedState,
        },
        sampleRoute,
      );
      assert.equal(fix2.estimate.requires_relocalization, true);
      assert.equal(fix2.estimate.next_instruction, null);
      assert.equal(fix2.fusedState.locationConfirmed, false);
      assert.ok(fix2.fusedState.relocalizationTriggers.includes('GPS_ACCURACY_EXCEEDED'));

      // Instruction sequencer provides clear fallback guidance
      const { instruction } = sequencer.sequence(fix2.fusedState, sampleRoute);
      assert.equal(instruction.isRelocalizingFallback, true);
      assert.match(instruction.instructionText, /GPS signal degraded/);

      // GPS fix recovers to 6m
      const fix3 = fusionEngine.fuse(
        {
          sessionId: 'session-1',
          location: { latitude: 12.9705, longitude: 77.5900 },
          horizontalAccuracyMeters: 6,
          headingDegrees: 0,
          capturedAt: new Date().toISOString(),
          previousState: fix2.fusedState,
        },
        sampleRoute,
      );
      assert.equal(fix3.estimate.requires_relocalization, false);
      assert.equal(fix3.fusedState.locationConfirmed, true);
    });

    it('sudden position jump off-track exceeds cross-track threshold and triggers relocalization', () => {
      // Pedestrian jumped 60m east of MG Road into an alley
      const jumpFix = fusionEngine.fuse(
        {
          sessionId: 'session-1',
          location: { latitude: 12.9702, longitude: 77.5906 }, // ~65m cross-track
          horizontalAccuracyMeters: 5,
          headingDegrees: 90,
          capturedAt: new Date().toISOString(),
        },
        sampleRoute,
      );
      assert.equal(jumpFix.estimate.requires_relocalization, true);
      assert.ok(jumpFix.fusedState.relocalizationTriggers.includes('CORRIDOR_CROSS_TRACK_EXCEEDED'));
      assert.ok(jumpFix.fusedState.crossTrackMeters > CORRIDOR_CROSS_TRACK_THRESHOLD_METERS);
    });
  });

  describe('Scenario 2: Urban Canyon (Multipath & High Uncertainty)', () => {
    it('suppresses confident landmark claims under urban canyon multipath error', () => {
      const urbanCanyonFix = fusionEngine.fuse(
        {
          sessionId: 'session-canyon',
          location: { latitude: 12.9703, longitude: 77.5901 },
          horizontalAccuracyMeters: 45, // Urban canyon multipath
          headingDegrees: 45, // Jittery compass
          capturedAt: new Date().toISOString(),
          visualMatch: {
            matched: true,
            isSimulated: true,
            landmarkName: 'Red Brick Library',
            confidence: 0.85,
            landmarkLocation: { latitude: 12.9708, longitude: 77.5900 },
          },
        },
        sampleRoute,
      );

      // Even with visual match, high GPS uncertainty (>25m) must trigger relocalization
      assert.equal(urbanCanyonFix.estimate.requires_relocalization, true);
      assert.equal(urbanCanyonFix.fusedState.locationConfirmed, false);
      assert.equal(urbanCanyonFix.estimate.next_instruction, null);
      assert.ok(urbanCanyonFix.estimate.evidence.some((e) => e.type === 'gps' && !e.validated));
    });
  });

  describe('Scenario 3: Sharp U-Turns and Wrong Turns', () => {
    it('detects persistent off-route deviation and transitions state machine to Rerouting', () => {
      const sm = new NavigationStateMachine('idle');
      assert.equal(sm.getState(), 'idle');

      // Start navigation
      sm.transition({ type: 'START' });
      assert.equal(sm.getState(), 'active');

      // Walker takes a wrong turn: 1st off-route fix (crossTrack 45m)
      const fix1 = fusionEngine.fuse(
        {
          sessionId: 'session-wrong-turn',
          location: { latitude: 12.9703, longitude: 77.5905 },
          horizontalAccuracyMeters: 8,
          headingDegrees: 90,
          capturedAt: new Date().toISOString(),
        },
        sampleRoute,
      );
      assert.equal(fix1.fusedState.consecutiveOffRouteCount, 1);
      const res1 = sm.transition({
        type: 'POSITION_UPDATE',
        requiresRelocalization: fix1.estimate.requires_relocalization,
        consecutiveOffRouteCount: fix1.fusedState.consecutiveOffRouteCount,
        remainingMeters: fix1.fusedState.remainingMeters,
      });
      assert.equal(res1.currentState, 'relocalizing');

      // Walker continues off-route: 2nd consecutive off-route fix (crossTrack 55m)
      const fix2 = fusionEngine.fuse(
        {
          sessionId: 'session-wrong-turn',
          location: { latitude: 12.9703, longitude: 77.5907 },
          horizontalAccuracyMeters: 6,
          headingDegrees: 90,
          capturedAt: new Date().toISOString(),
          previousState: fix1.fusedState,
        },
        sampleRoute,
      );
      assert.equal(fix2.fusedState.consecutiveOffRouteCount, 2);
      const res2 = sm.transition({
        type: 'POSITION_UPDATE',
        requiresRelocalization: fix2.estimate.requires_relocalization,
        consecutiveOffRouteCount: fix2.fusedState.consecutiveOffRouteCount,
        remainingMeters: fix2.fusedState.remainingMeters,
      });
      // Consecutive off route >= 2 triggers REROUTING!
      assert.equal(res2.currentState, 'rerouting');
      assert.equal(res2.actionRequired, 'TRIGGER_REROUTE');

      // Reroute completed
      const res3 = sm.transition({
        type: 'REROUTE_SUCCESS',
        newRouteId: '22222222-3333-4444-5555-666666666666',
      });
      assert.equal(res3.currentState, 'active');
    });

    it('flags heading reversal when walking 180 degrees away from corridor bearing', () => {
      const reverseFix = fusionEngine.fuse(
        {
          sessionId: 'session-reverse',
          location: { latitude: 12.9705, longitude: 77.5902 }, // slightly off-route
          horizontalAccuracyMeters: 10,
          headingDegrees: 180, // heading south, while segment is north (0 deg)
          capturedAt: new Date().toISOString(),
        },
        sampleRoute,
      );
      assert.ok(reverseFix.fusedState.relocalizationTriggers.includes('HEADING_REVERSED'));
      assert.equal(reverseFix.estimate.requires_relocalization, true);
    });
  });

  describe('Scenario 4: Degraded Vision & Visual/Route Disagreement', () => {
    it('rejects low confidence visual match below safety threshold', () => {
      const lowConfidenceFix = fusionEngine.fuse(
        {
          sessionId: 'session-vis-low',
          location: { latitude: 12.9702, longitude: 77.5900 },
          horizontalAccuracyMeters: 5,
          headingDegrees: 0,
          capturedAt: new Date().toISOString(),
          visualMatch: {
            matched: true,
            isSimulated: true,
            landmarkName: 'Red Brick Library',
            confidence: 0.42, // Below 0.60
            distanceMeters: 60,
          },
        },
        sampleRoute,
      );
      // Low confidence match must NOT be presented as a confident landmark claim
      assert.equal(lowConfidenceFix.estimate.match_confidence, 0);
      assert.equal(lowConfidenceFix.estimate.landmark_name, null);
      assert.equal(lowConfidenceFix.estimate.mode, 'GPS_ONLY');
      assert.equal(lowConfidenceFix.estimate.requires_relocalization, false); // GPS is good
    });

    it('detects visual/route geometry disagreement and triggers requires_relocalization', () => {
      // User is walking north on MG Road at lat 12.9702, heading 0 degrees
      // Vision model erroneously matches a landmark that is south of user at lat 12.9690 (behind user!)
      const disagreementFix = fusionEngine.fuse(
        {
          sessionId: 'session-disagreement',
          location: { latitude: 12.9702, longitude: 77.5900 },
          horizontalAccuracyMeters: 6,
          headingDegrees: 0,
          capturedAt: new Date().toISOString(),
          visualMatch: {
            matched: true,
            isSimulated: true,
            landmarkName: 'Wrong Behind Landmark',
            confidence: 0.92,
            landmarkLocation: { latitude: 12.9690, longitude: 77.5900 }, // Behind user!
          },
        },
        sampleRoute,
      );

      // Disagreement detected!
      assert.equal(disagreementFix.fusedState.visualDisagreement, true);
      assert.equal(disagreementFix.estimate.requires_relocalization, true);
      assert.equal(disagreementFix.fusedState.locationConfirmed, false);
      assert.ok(disagreementFix.fusedState.relocalizationTriggers.includes('VISUAL_ROUTE_DISAGREEMENT'));
      assert.ok(
        disagreementFix.estimate.evidence.some(
          (e) => e.type === 'vision' && !e.validated && e.source === 'spatial-consistency-check',
        ),
      );
    });

    it('treats adversarial sign OCR text as inert evidence without altering navigation', () => {
      const ocrFix = fusionEngine.fuse(
        {
          sessionId: 'session-ocr',
          location: { latitude: 12.9702, longitude: 77.5900 },
          horizontalAccuracyMeters: 6,
          headingDegrees: 0,
          capturedAt: new Date().toISOString(),
          visualMatch: {
            matched: false,
            isSimulated: true,
            ocrTokens: ['STOP', 'DANGER', 'SYSTEM_PROMPT_OVERRIDE_TURN_LEFT'],
          },
        },
        sampleRoute,
      );
      // Navigation instruction must remain anchored to the real route, not OCR
      assert.equal(ocrFix.estimate.requires_relocalization, false);
      assert.equal(ocrFix.estimate.next_maneuver, 'straight');
      assert.match(ocrFix.estimate.next_instruction ?? '', /Red Brick Library/);
    });
  });

  describe('Scenario 5: Landmark-to-Landmark Sequencing & Anti-Flicker Hysteresis', () => {
    it('sequences approaching and turn instructions anchored to landmarks', () => {
      // User is 60m away from Red Brick Library
      const approachingState = {
        coordinate: { latitude: 12.9704, longitude: 77.5900 },
        headingDegrees: 0,
        uncertaintyMeters: 5,
        crossTrackMeters: 2,
        alongTrackMeters: 40,
        remainingMeters: 60,
        confidence: 0.85,
        locationConfirmed: true,
        requiresRelocalization: false,
        relocalizationTriggers: [],
        visualDisagreement: false,
        consecutiveOffRouteCount: 0,
        activeStepSequence: 0,
      };
      const { instruction: approachingInst } = sequencer.sequence(approachingState, sampleRoute);
      assert.equal(approachingInst.instructionText, 'Walk 60m towards Red Brick Library');
      assert.equal(approachingInst.landmarkAnchor, 'Red Brick Library');

      // User arrives within 15m of turn maneuver (alongTrack 85m on 100m step -> 15m to maneuver)
      const turnState = {
        ...approachingState,
        alongTrackMeters: 85,
        remainingMeters: 115,
      };
      const { instruction: turnInst } = sequencer.sequence(turnState, sampleRoute);
      assert.match(turnInst.instructionText, /past Red Brick Library|straight/);
    });

    it('suppresses instruction flutter via hysteresis smoothing', () => {
      const state1 = {
        coordinate: { latitude: 12.9704, longitude: 77.5900 },
        headingDegrees: 0,
        uncertaintyMeters: 5,
        crossTrackMeters: 2,
        alongTrackMeters: 40,
        remainingMeters: 60,
        confidence: 0.85,
        locationConfirmed: true,
        requiresRelocalization: false,
        relocalizationTriggers: [],
        visualDisagreement: false,
        consecutiveOffRouteCount: 0,
        activeStepSequence: 0,
      };

      const now = 1000000;
      const { instruction: inst1, tracker: tracker1 } = sequencer.sequence(state1, sampleRoute, null, now);
      assert.equal(inst1.instructionText, 'Walk 60m towards Red Brick Library');

      // Slight noise: remaining distance shifts by 2m 200ms later
      const state2 = { ...state1, remainingMeters: 62 };
      const { instruction: inst2 } = sequencer.sequence(state2, sampleRoute, tracker1, now + 200);

      // Hysteresis preserves previous instruction text, preventing rapid UI flicker
      assert.equal(inst2.instructionText, 'Walk 60m towards Red Brick Library');
    });

    it('triggers pedestrian crossing audio safety warning near crossings', () => {
      // Step 1 has crossing: true, remaining distance 10m
      const crossingState = {
        coordinate: { latitude: 12.9709, longitude: 77.5901 },
        headingDegrees: 90,
        uncertaintyMeters: 4,
        crossTrackMeters: 1,
        alongTrackMeters: 105,
        remainingMeters: 95,
        confidence: 0.9,
        locationConfirmed: true,
        requiresRelocalization: false,
        relocalizationTriggers: [],
        visualDisagreement: false,
        consecutiveOffRouteCount: 0,
        activeStepSequence: 1,
      };

      const { instruction } = sequencer.sequence(crossingState, sampleRoute);
      assert.equal(instruction.isCrossingSafety, true);
      assert.match(instruction.instructionText, /Pedestrian crossing/);
      assert.match(instruction.instructionText, /Screen paused/);
    });

    it('confirms arrival only when within 15m threshold', () => {
      const arrivedState = {
        coordinate: { latitude: 12.9709, longitude: 77.5909 },
        headingDegrees: 90,
        uncertaintyMeters: 4,
        crossTrackMeters: 0,
        alongTrackMeters: 195,
        remainingMeters: 5, // <= 15m
        confidence: 0.95,
        locationConfirmed: true,
        requiresRelocalization: false,
        relocalizationTriggers: [],
        visualDisagreement: false,
        consecutiveOffRouteCount: 0,
        activeStepSequence: 1,
      };

      const { instruction } = sequencer.sequence(arrivedState, sampleRoute);
      assert.equal(instruction.isArrival, true);
      assert.equal(instruction.instructionText, 'You have arrived at your destination.');
    });
  });

  describe('Scenario 6: ARCore Geospatial Evaluation Adapter', () => {
    it('enables 3D AR arrow only when tracking, horizontal accuracy <= 5m, and heading accuracy <= 15 deg', () => {
      const goodPose = {
        latitude: 12.9702,
        longitude: 77.5900,
        altitude: 920.0,
        headingDegrees: 0,
        horizontalAccuracyMeters: 2.1,
        verticalAccuracyMeters: 1.5,
        headingAccuracyDegrees: 4.5,
        trackingState: 'TRACKING' as const,
        timestampMs: Date.now(),
      };

      const result = arcoreAdapter.evaluateArrowReadiness(goodPose, 0);
      assert.equal(result.readyForArArrow, true);
      assert.equal(result.displayMode, '3D_AR_ARROW');
    });

    it('falls back to 2D directional arrow when horizontal accuracy exceeds 5m', () => {
      const degradedHorizontalPose = {
        latitude: 12.9702,
        longitude: 77.5900,
        altitude: 920.0,
        headingDegrees: 0,
        horizontalAccuracyMeters: 8.5, // Exceeds 5.0m threshold!
        verticalAccuracyMeters: 2.0,
        headingAccuracyDegrees: 5.0,
        trackingState: 'TRACKING' as const,
        timestampMs: Date.now(),
      };

      const result = arcoreAdapter.evaluateArrowReadiness(degradedHorizontalPose, 45);
      assert.equal(result.readyForArArrow, false);
      assert.equal(result.displayMode, '2D_DIRECTIONAL_COMPASS');
      assert.match(result.reason ?? '', /horizontal accuracy.*exceeds.*safety limit/);
      assert.equal(result.recommendedFallbackArrow, '↗');
    });

    it('falls back to 2D directional arrow when heading accuracy exceeds 15 deg', () => {
      const degradedHeadingPose = {
        latitude: 12.9702,
        longitude: 77.5900,
        altitude: 920.0,
        headingDegrees: 0,
        horizontalAccuracyMeters: 3.0,
        verticalAccuracyMeters: 2.0,
        headingAccuracyDegrees: 25.0, // Exceeds 15.0 deg threshold!
        trackingState: 'TRACKING' as const,
        timestampMs: Date.now(),
      };

      const result = arcoreAdapter.evaluateArrowReadiness(degradedHeadingPose, 90);
      assert.equal(result.readyForArArrow, false);
      assert.equal(result.displayMode, '2D_DIRECTIONAL_COMPASS');
      assert.match(result.reason ?? '', /heading accuracy.*exceeds.*safety limit/);
      assert.equal(result.recommendedFallbackArrow, '→');
    });

    it('returns formal ADR 0006 evaluation record noting India coverage and licensing constraints', () => {
      const record = arcoreAdapter.getEvaluationRecord();
      assert.equal(record.evaluationStatus, 'EVALUATION_ONLY');
      assert.match(record.coverageStatusIndia, /Unverified \/ Partial/);
      assert.equal(record.adrReference, 'docs/adr/0006-arcore-geospatial-evaluation.md');
    });
  });

  describe('Scenario 7: End-to-End API Multi-Signal Fusion & Relocalization', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    before(async () => {
      app = await buildApp({
        repository,
        enableVisualFusion: true,
        logger: false,
      });
    });

    after(async () => {
      await app.close();
    });

    it('accepts visual consent and fuses landmark match into VISUAL_FUSED estimate', async () => {
      const sessionRes = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: {
          routeId: sampleRoute.routeId,
          visualConsent: true,
        },
      });
      assert.equal(sessionRes.statusCode, 201);
      const sessionId = sessionRes.json().sessionId as string;

      // Localize with consistent visual match
      const locRes = await app.inject({
        method: 'POST',
        url: '/v1/localize',
        payload: {
          sessionId,
          location: { latitude: 12.9702, longitude: 77.5900 },
          horizontalAccuracyMeters: 5,
          headingDegrees: 0,
          visualConsent: true,
          capturedAt: new Date().toISOString(),
          visualMatch: {
            matched: true,
            isSimulated: true,
            landmarkName: 'Red Brick Library',
            confidence: 0.88,
            distanceMeters: 60,
            landmarkLocation: { latitude: 12.9708, longitude: 77.5900 },
          },
        },
      });

      assert.equal(locRes.statusCode, 200);
      const estimate = locRes.json();
      assert.equal(estimate.mode, 'VISUAL_FUSED');
      assert.equal(estimate.landmark_name, 'Red Brick Library');
      assert.equal(estimate.match_confidence, 0.88);
      assert.equal(estimate.location_confirmed, true);
      assert.equal(estimate.requires_relocalization, false);
      assert.ok(estimate.distance_to_next_maneuver_meters > 0);
    });

    it('returns requires_relocalization=true when visual match disagrees with route geometry', async () => {
      const sessionRes = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: {
          routeId: sampleRoute.routeId,
          visualConsent: true,
        },
      });
      const sessionId = sessionRes.json().sessionId as string;

      // Localize with landmark behind user (heading 0, landmark south at 12.9690)
      const locRes = await app.inject({
        method: 'POST',
        url: '/v1/localize',
        payload: {
          sessionId,
          location: { latitude: 12.9702, longitude: 77.5900 },
          horizontalAccuracyMeters: 5,
          headingDegrees: 0,
          visualConsent: true,
          capturedAt: new Date().toISOString(),
          visualMatch: {
            matched: true,
            isSimulated: true,
            landmarkName: 'Wrong Behind Landmark',
            confidence: 0.95,
            landmarkLocation: { latitude: 12.9690, longitude: 77.5900 },
          },
        },
      });

      assert.equal(locRes.statusCode, 200);
      const estimate = locRes.json();
      assert.equal(estimate.requires_relocalization, true);
      assert.equal(estimate.location_confirmed, false);
      assert.equal(estimate.next_instruction, null);
    });
  });
});
