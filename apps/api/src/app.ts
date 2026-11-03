import { randomUUID, createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Counter, Registry, collectDefaultMetrics } from 'prom-client';
import { z } from 'zod';
import {
  createSessionSchema,
  feedbackSchema,
  localizationSchema,
  placeSearchSchema,
  updateSessionSchema,
  walkingRouteSchema,
  type LocalizationEstimate,
  type NavigationSession,
  type Problem,
} from './domain/schemas.js';
import { routeProgress } from './domain/geo.js';
import { MultiSignalFusionEngine } from './domain/fusion-engine.js';
import type { NavigationRepository } from './infra/repository.js';
import { MemoryNavigationRepository } from './infra/repository.js';
import { SimulatedMapsProvider } from './providers/simulated-maps.js';

const gpsAccuracyLimitMeters = 25;
const routeCorridorMeters = 40;

interface AppOptions {
  repository?: NavigationRepository;
  mapsProvider?: SimulatedMapsProvider;
  checkCacheHealth?: () => Promise<void>;
  logger?: boolean;
  enableVisualFusion?: boolean;
}

interface IdempotencyEntry {
  fingerprint: string;
  expiresAt: number;
  response: Promise<unknown>;
}

class IdempotencyConflict extends Error {}

class IdempotencyCache {
  private readonly entries = new Map<string, IdempotencyEntry>();

  async run<T>(key: string, fingerprint: string, action: () => Promise<T>): Promise<T> {
    const now = Date.now();
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(entryKey);
    }

    const existing = this.entries.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new IdempotencyConflict('Idempotency-Key was already used with a different request');
      }
      return existing.response as Promise<T>;
    }

    if (this.entries.size >= 5000) {
      throw new Error('Idempotency cache is full; retry later');
    }

    const response = action();
    this.entries.set(key, { fingerprint, expiresAt: now + 10 * 60 * 1000, response });
    try {
      return await response;
    } catch (error) {
      this.entries.delete(key);
      throw error;
    }
  }
}

const hashRequest = (body: unknown): string =>
  createHash('sha256').update(JSON.stringify(body)).digest('hex');

function parseBody<T>(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  schema: z.ZodType<T>,
): T | undefined {
  const parsed = schema.safeParse(request.body);
  if (parsed.success) return parsed.data;

  app.log.info(
    { requestId: request.id, issueCount: parsed.error.issues.length },
    'Request validation failed',
  );
  void reply.status(400).type('application/problem+json').send({
    type: 'https://landmarknav.invalid/problems/invalid-request',
    title: 'Invalid request',
    status: 400,
    detail: 'The request body does not match the API contract.',
    requestId: request.id,
  } satisfies Problem);
  return undefined;
}

function parseUuidParam(
  value: string,
  request: FastifyRequest,
  reply: FastifyReply,
): string | undefined {
  const parsed = z.string().uuid().safeParse(value);
  if (parsed.success) return parsed.data;

  void reply.status(400).type('application/problem+json').send({
    type: 'https://landmarknav.invalid/problems/invalid-request',
    title: 'Invalid request',
    status: 400,
    detail: 'The path identifier must be a UUID.',
    requestId: request.id,
  } satisfies Problem);
  return undefined;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const repository = options.repository ?? new MemoryNavigationRepository();
  const maps = options.mapsProvider ?? new SimulatedMapsProvider();
  const enableVisualFusion = options.enableVisualFusion ?? (process.env.ENABLE_VISUAL_FUSION === 'true');
  const fusionEngine = new MultiSignalFusionEngine();
  const idempotency = new IdempotencyCache();
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const requests = new Counter({
    name: 'landmarknav_http_requests_total',
    help: 'Total HTTP requests served',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
  });

  const app = Fastify({
    logger: options.logger === false ? false : {
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.comment'],
    },
    genReqId: (request) => {
      const incoming = request.headers['x-request-id'];
      return typeof incoming === 'string' && /^[\w.-]{1,128}$/.test(incoming)
        ? incoming
        : randomUUID();
    },
    bodyLimit: 64 * 1024,
    requestTimeout: 10_000,
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()).filter(Boolean) ?? [
      'http://localhost:8081',
      'http://127.0.0.1:8081',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      type: 'https://landmarknav.invalid/problems/rate-limit',
      title: 'Too many requests',
      status: 429,
      detail: `Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
      requestId: _request.id,
    }),
  });

  app.addHook('onResponse', async (request, reply) => {
    requests.inc({
      method: request.method,
      route: request.routeOptions.url ?? 'unmatched',
      status: String(reply.statusCode),
    });
  });
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof IdempotencyConflict) {
      return reply.status(409).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/idempotency-conflict',
        title: 'Idempotency conflict',
        status: 409,
        detail: error.message,
        requestId: request.id,
      } satisfies Problem);
    }

    request.log.error({ err: error, requestId: request.id }, 'Request failed');
    const candidateStatusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? error.statusCode
      : undefined;
    const statusCode = typeof candidateStatusCode === 'number' && candidateStatusCode >= 400
      ? candidateStatusCode
      : 500;
    const detail = statusCode < 500 && error instanceof Error
      ? error.message
      : 'The request could not be completed.';
    return reply.status(statusCode)
      .type('application/problem+json')
      .send({
        type: 'https://landmarknav.invalid/problems/internal-error',
        title: 'Request failed',
        status: statusCode,
        detail,
        requestId: request.id,
      } satisfies Problem);
  });

  app.get('/healthz', async (_request, reply) =>
    reply.header('cache-control', 'no-store').send({ status: 'ok' }));

  app.get('/readyz', async (request, reply) => {
    try {
      await repository.checkHealth();
      await options.checkCacheHealth?.();
      return reply.header('cache-control', 'no-store').send({ status: 'ready' });
    } catch (error) {
      request.log.warn({ err: error }, 'Readiness check failed');
      return reply.status(503).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/not-ready',
        title: 'Service not ready',
        status: 503,
        detail: 'A required local dependency is unavailable.',
        requestId: request.id,
      } satisfies Problem);
    }
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', registry.contentType);
    return registry.metrics();
  });

  app.post('/v1/places/search', async (request, reply) => {
    const input = parseBody(app, request, reply, placeSearchSchema);
    if (!input) return;
    const near = input.near ?? { latitude: 12.9716, longitude: 77.5946 };
    return reply.send({
      mode: 'SIMULATED',
      results: maps.searchPlaces(input.query, near),
    });
  });

  app.post('/v1/routes/walking', async (request, reply) => {
    const input = parseBody(app, request, reply, walkingRouteSchema);
    if (!input) return;
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey === 'string' && idempotencyKey.length > 128) {
      return reply.status(400).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/invalid-request',
        title: 'Invalid request',
        status: 400,
        detail: 'Idempotency-Key must be 128 characters or fewer.',
        requestId: request.id,
      } satisfies Problem);
    }
    const key = typeof idempotencyKey === 'string'
      ? `${request.ip}:/v1/routes/walking:${idempotencyKey}`
      : null;
    const fingerprint = hashRequest(input);
    const createRoute = async () => {
      const route = maps.walkingRoute(input.origin, input.destination);
      await repository.saveRoute(route);
      return route;
    };
    const route = key
      ? await idempotency.run(key, fingerprint, createRoute)
      : await createRoute();
    return reply.send(route);
  });

  app.get<{ Params: { routeId: string } }>('/v1/routes/:routeId', async (request, reply) => {
    const routeId = parseUuidParam(request.params.routeId, request, reply);
    if (!routeId) return;
    const route = await repository.getRoute(routeId);
    if (!route) {
      return reply.status(404).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/not-found',
        title: 'Route not found',
        status: 404,
        requestId: request.id,
      } satisfies Problem);
    }
    return reply.send(route);
  });

  app.post('/v1/sessions', async (request, reply) => {
    const input = parseBody(app, request, reply, createSessionSchema);
    if (!input) return;
    if (input.visualConsent && !enableVisualFusion) {
      return reply.status(422).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/feature-unavailable',
        title: 'Visual localization unavailable',
        status: 422,
        detail: 'Phase 1 provides GPS-only guidance. Camera frames are not processed.',
        requestId: request.id,
      } satisfies Problem);
    }
    if (!(await repository.getRoute(input.routeId))) {
      return reply.status(404).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/not-found',
        title: 'Route not found',
        status: 404,
        requestId: request.id,
      } satisfies Problem);
    }
    const keyHeader = request.headers['idempotency-key'];
    if (typeof keyHeader === 'string' && keyHeader.length > 128) {
      return reply.status(400).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/invalid-request',
        title: 'Invalid request',
        status: 400,
        detail: 'Idempotency-Key must be 128 characters or fewer.',
        requestId: request.id,
      } satisfies Problem);
    }
    const key = typeof keyHeader === 'string'
      ? `${request.ip}:/v1/sessions:${keyHeader}`
      : null;
    const createSession = async () => {
      const session: NavigationSession = {
        sessionId: randomUUID(),
        routeId: input.routeId,
        state: 'active',
      };
      await repository.createSession(session);
      return session;
    };
    const session = key
      ? await idempotency.run(key, hashRequest(input), createSession)
      : await createSession();
    return reply.status(201).send(session);
  });

  app.patch<{ Params: { sessionId: string } }>('/v1/sessions/:sessionId', async (request, reply) => {
    const input = parseBody(app, request, reply, updateSessionSchema);
    if (!input) return;
    const sessionId = parseUuidParam(request.params.sessionId, request, reply);
    if (!sessionId) return;
    if (input.routeId && !(await repository.getRoute(input.routeId))) {
      return reply.status(404).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/not-found',
        title: 'Route not found',
        status: 404,
        requestId: request.id,
      } satisfies Problem);
    }
    const session = await repository.updateSession(sessionId, input.state, input.routeId);
    if (!session) {
      return reply.status(404).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/not-found',
        title: 'Navigation session not found',
        status: 404,
        requestId: request.id,
      } satisfies Problem);
    }
    return reply.send(session);
  });

  app.delete<{ Params: { sessionId: string } }>('/v1/sessions/:sessionId', async (request, reply) => {
    const sessionId = parseUuidParam(request.params.sessionId, request, reply);
    if (!sessionId) return;
    const deleted = await repository.deleteSession(sessionId);
    if (!deleted) {
      return reply.status(404).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/not-found',
        title: 'Navigation session not found',
        status: 404,
        requestId: request.id,
      } satisfies Problem);
    }
    return reply.status(204).send();
  });

  app.post('/v1/localize', async (request, reply) => {
    const input = parseBody(app, request, reply, localizationSchema);
    if (!input) return;
    const session = await repository.getSession(input.sessionId);
    if (!session) {
      return reply.status(404).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/not-found',
        title: 'Navigation session not found',
        status: 404,
        requestId: request.id,
      } satisfies Problem);
    }
    if (input.visualConsent && !enableVisualFusion) {
      return reply.status(422).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/feature-unavailable',
        title: 'Visual localization unavailable',
        status: 422,
        detail: 'Phase 1 accepts GPS and route data only; visual processing is disabled.',
        requestId: request.id,
      } satisfies Problem);
    }

    const route = await repository.getRoute(session.routeId);
    if (!route) {
      throw new Error('Navigation session references a missing route');
    }
    const fusionResult = fusionEngine.fuse(
      {
        sessionId: input.sessionId,
        location: input.location,
        horizontalAccuracyMeters: input.horizontalAccuracyMeters,
        headingDegrees: input.headingDegrees,
        capturedAt: input.capturedAt,
        visualMatch: enableVisualFusion && input.visualConsent ? (input.visualMatch ?? null) : null,
      },
      route,
    );

    const estimate = fusionResult.estimate;
    if (session.state !== 'active') {
      estimate.requires_relocalization = true;
      estimate.next_instruction = null;
      estimate.next_maneuver = null;
      estimate.distance_to_next_maneuver_meters = null;
      estimate.location_confirmed = false;
    }
    return reply.send(estimate);
  });

  app.post('/v1/feedback', async (request, reply) => {
    const input = parseBody(app, request, reply, feedbackSchema);
    if (!input) return;
    if (!(await repository.getSession(input.sessionId))) {
      return reply.status(404).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/not-found',
        title: 'Navigation session not found',
        status: 404,
        requestId: request.id,
      } satisfies Problem);
    }
    const keyHeader = request.headers['idempotency-key'];
    if (typeof keyHeader === 'string' && keyHeader.length > 128) {
      return reply.status(400).type('application/problem+json').send({
        type: 'https://landmarknav.invalid/problems/invalid-request',
        title: 'Invalid request',
        status: 400,
        detail: 'Idempotency-Key must be 128 characters or fewer.',
        requestId: request.id,
      } satisfies Problem);
    }
    const key = typeof keyHeader === 'string'
      ? `${request.ip}:/v1/feedback:${keyHeader}`
      : null;
    const saveFeedback = async () => {
      await repository.saveFeedback(input.sessionId, input.category, input.comment);
      return { accepted: true };
    };
    const result = key
      ? await idempotency.run(key, hashRequest(input), saveFeedback)
      : await saveFeedback();
    return reply.status(202).send(result);
  });

  return app;
}
