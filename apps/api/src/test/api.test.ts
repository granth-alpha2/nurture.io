import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { buildApp } from '../app.js';
import { MemoryNavigationRepository } from '../infra/repository.js';

describe('GPS-only navigation API', () => {
  const repository = new MemoryNavigationRepository();
  const appPromise = buildApp({ repository, logger: false });
  let app: Awaited<typeof appPromise>;

  before(async () => {
    app = await appPromise;
  });

  after(async () => {
    await app.close();
  });

  async function createRoute() {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/routes/walking',
      payload: {
        origin: { latitude: 12.97, longitude: 77.59 },
        destination: { latitude: 12.975, longitude: 77.596 },
      },
    });
    assert.equal(response.statusCode, 200);
    return response.json() as { routeId: string; mode: string; path: unknown[] };
  }

  it('reports liveness and readiness', async () => {
    assert.equal((await app.inject('/healthz')).statusCode, 200);
    assert.equal((await app.inject('/readyz')).statusCode, 200);
  });

  it('includes a request ID and rejects invalid path identifiers', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/routes/not-a-uuid' });
    assert.equal(response.statusCode, 400);
    assert.equal(response.headers['x-request-id'], response.json().requestId);
  });

  it('validates request input and returns an RFC 7807 problem', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/places/search',
      payload: { query: '', unexpected: true },
    });
    assert.equal(response.statusCode, 400);
    assert.match(response.headers['content-type'] ?? '', /application\/problem\+json/);
    assert.equal(response.json().status, 400);
  });

  it('labels synthetic place results as simulated', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/places/search',
      payload: {
        query: 'quiet park',
        near: { latitude: 12.97, longitude: 77.59 },
      },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().mode, 'SIMULATED');
    assert.match(response.json().results[0].displayName, /^SIMULATED/);
  });

  it('returns only an explicitly marked synthetic straight-line route', async () => {
    const route = await createRoute();
    assert.equal(route.mode, 'SIMULATED');
    assert.equal(route.path.length, 11);
  });

  it('coalesces idempotent route creation and rejects key reuse with different input', async () => {
    const payload = {
      origin: { latitude: 12.97, longitude: 77.59 },
      destination: { latitude: 12.975, longitude: 77.596 },
    };
    const first = await app.inject({
      method: 'POST',
      url: '/v1/routes/walking',
      headers: { 'idempotency-key': 'route-create-1' },
      payload,
    });

    const second = await app.inject({
      method: 'POST',
      url: '/v1/routes/walking',
      headers: { 'idempotency-key': 'route-create-1' },
      payload,
    });
    assert.equal(first.json().routeId, second.json().routeId);

    const conflict = await app.inject({
      method: 'POST',
      url: '/v1/routes/walking',
      headers: { 'idempotency-key': 'route-create-1' },
      payload: { ...payload, destination: { latitude: 12.98, longitude: 77.6 } },
    });
    assert.equal(conflict.statusCode, 409);
  });

  it('coalesces idempotent session creation', async () => {
    const route = await createRoute();
    const payload = { routeId: route.routeId };
    const first = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { 'idempotency-key': 'session-create-1' },
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { 'idempotency-key': 'session-create-1' },
      payload,
    });
    assert.equal(first.statusCode, 201);
    assert.equal(first.json().sessionId, second.json().sessionId);
  });

  it('creates, pauses, resumes, and deletes a session', async () => {
    const route = await createRoute();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: { routeId: route.routeId },
    });
    assert.equal(created.statusCode, 201);
    const sessionId = created.json().sessionId as string;

    const paused = await app.inject({
      method: 'PATCH',
      url: `/v1/sessions/${sessionId}`,
      payload: { state: 'paused' },
    });
    assert.equal(paused.json().state, 'paused');
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/v1/sessions/${sessionId}`,
      payload: { state: 'active' },
    })).json().state, 'active');
    assert.equal((await app.inject({ method: 'DELETE', url: `/v1/sessions/${sessionId}` })).statusCode, 204);
    assert.equal((await app.inject({ method: 'DELETE', url: `/v1/sessions/${sessionId}` })).statusCode, 404);
  });

  it('keeps a route while another session still references it', async () => {
    const route = await createRoute();
    const first = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: { routeId: route.routeId },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: { routeId: route.routeId },
    });
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/sessions/${first.json().sessionId as string}`,
    });
    assert.equal(deleted.statusCode, 204);
    assert.equal((await app.inject({
      method: 'POST',
      url: '/v1/localize',
      payload: {
        sessionId: second.json().sessionId,
        location: { latitude: 12.97, longitude: 77.59 },
        horizontalAccuracyMeters: 5,
        capturedAt: new Date().toISOString(),
      },
    })).statusCode, 200);
  });

  it('returns GPS-only guidance only for sufficiently accurate on-route fixes', async () => {
    const route = await createRoute();
    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: { routeId: route.routeId },
    });

    const sessionId = sessionResponse.json().sessionId as string;
    const body = {
      sessionId,
      location: { latitude: 12.97, longitude: 77.59 },
      horizontalAccuracyMeters: 5,
      capturedAt: new Date().toISOString(),
    };

    const estimate = await app.inject({ method: 'POST', url: '/v1/localize', payload: body });
    assert.equal(estimate.statusCode, 200);
    assert.equal(estimate.json().mode, 'GPS_ONLY');
    assert.equal(estimate.json().landmark_name, null);
    assert.equal(estimate.json().match_confidence, 0);
    assert.equal(estimate.json().requires_relocalization, false);

    const uncertain = await app.inject({
      method: 'POST',
      url: '/v1/localize',
      payload: { ...body, horizontalAccuracyMeters: 80 },
    });
    assert.equal(uncertain.json().requires_relocalization, true);
    assert.equal(uncertain.json().next_instruction, null);
  });

  it('accepts a new route when rerouting and removes the old route', async () => {
    const oldRoute = await createRoute();
    const newRouteResponse = await app.inject({
      method: 'POST',
      url: '/v1/routes/walking',
      payload: {
        origin: { latitude: 12.972, longitude: 77.591 },
        destination: { latitude: 12.975, longitude: 77.596 },
      },
    });
    const newRoute = newRouteResponse.json() as { routeId: string };
    const created = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: { routeId: oldRoute.routeId },
    });
    const sessionId = created.json().sessionId as string;
    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/sessions/${sessionId}`,
      payload: { state: 'active', routeId: newRoute.routeId },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().routeId, newRoute.routeId);
    assert.equal((await app.inject({ method: 'GET', url: `/v1/routes/${oldRoute.routeId}` })).statusCode, 404);
  });

  it('rejects visual processing in Phase 1', async () => {
    const route = await createRoute();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: { routeId: route.routeId, visualConsent: true },
    });
    assert.equal(response.statusCode, 422);
  });

  it('requires explicit session existence before accepting feedback', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/feedback',
      payload: {
        sessionId: '00000000-0000-4000-8000-000000000001',
        category: 'confusing',
      },
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().title, 'Navigation session not found');
  });
});
