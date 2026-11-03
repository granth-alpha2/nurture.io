# Local container stack

The Phase 1 Compose stack contains PostgreSQL with PostGIS and pgvector, Redis, a one-shot schema migration, the Fastify API, a disabled vision-service shell, an OpenTelemetry collector, Prometheus, and Grafana.

Run `npm run bootstrap` once, then `npm run up`; `npm run down` stops services without deleting their named volumes. GNU Make wrappers are also provided (`make bootstrap`, `make up`, `make down`, `make verify`). Published ports bind to `127.0.0.1`. Local passwords in `.env.example` are development-only and must not be used outside a private local machine.

The API is unauthenticated; do not publish it or expose the monitoring ports. API rate limiting and idempotency are process-local. Redis is currently only a readiness dependency, not a distributed state store. Routes and place records are synthetic. The vision service does not process images.
