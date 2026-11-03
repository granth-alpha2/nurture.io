# API workspace

Fastify + TypeScript API for the local Phase 1 navigation workflow. Run it in Compose with `npm run up` from the repository root. For development, first start PostgreSQL and Redis, then run `npm run dev --workspace=@landmarknav/api`; the API loads root `.env`.

The implementation supports simulated place search and straight-line routes, session lifecycle, GPS-only route progress, feedback, readiness, metrics, request IDs, request validation, and in-process rate limiting/idempotency. The in-memory repository is used by tests; Compose uses PostgreSQL. Redis is currently used for readiness only; process-local rate-limit and idempotency state is not shared across API replicas.

All place and route results are marked `SIMULATED` and are unsuitable for real navigation. Localization accepts GPS only. Visual input is rejected and must not be sent to this API. The API has no authentication; keep it bound to loopback.

Commands: `npm run typecheck --workspace=@landmarknav/api`, `npm test --workspace=@landmarknav/api`, and `npm run build --workspace=@landmarknav/api`.
