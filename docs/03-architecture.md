# 03 — Architecture

## Status and constraints

This is the Phase 0 target architecture, not an implemented system. The platform is mobile-first, Android-first, and designed for local GPS-only navigation before visual recognition. See ADRs for decisions and unresolved verification.

## C4 — system context

The Navigating User interacts with the LandmarkNav mobile client. The client calls the LandmarkNav API for place search, walking routes, navigation sessions, feedback, and optional localization. The API calls Google Maps Platform for permitted place/route operations and the Vision Service for opt-in visual processing. Operators observe service health and aggregate safety metrics. No external provider should receive more data than needed for the requested operation.

## C4 — containers

| Container | Responsibility | Trust boundary |
|---|---|---|
| Mobile app (React Native/Expo) | Camera/location/heading permissions, accessible UI, TTS, sampling and local fallback | User device; client keys restricted; untrusted sensor input |
| API (Fastify/TypeScript) | Auth/session, validation, route orchestration, rate limiting, privacy-safe logs | Public API edge; validates all client input |
| Vision service (FastAPI/Python) | Provider abstraction, feature/image processing, match scoring and abstention | Isolated workload; receives only consented compact features or selected frame |
| PostgreSQL + PostGIS + pgvector | Session/route metadata and permitted spatial/embedding data | Private data subnet; licensing gates on source data |
| Redis | TTL cache, rate limits, idempotency/coalescing | Private network; cache policy must respect source license |
| Object storage | Permitted derived artifacts only; no default raw camera image storage | Private bucket; encryption and lifecycle policy |
| External map/vision providers | Place/route and optional model capabilities | Third-party processing and contractual boundary |

## C4 — components

### Mobile
App/navigation state; destination search; permissions; camera/frame sampler; location and heading; GPS/fusion domain; API client; TTS; offline cache; accessible UI; settings and feedback.

### API
Health/readiness; request ID and auth; schema validation; places; routes; navigation sessions; localization orchestration; feedback; map provider adapter; vision client; database, Redis, queue, telemetry.

### Vision
API/schema; provider interface; candidate retrieval; reference lookup; embedding; OCR; matching; spatial consistency; fusion; calibration; hysteresis; validated instruction generation. Stages must be independently testable, but non-essential inference should be omitted rather than simulated as real.

## Data flow

1. User grants permissions and explicitly starts a route.
2. Client submits destination query; API validates and calls provider; client presents choices for confirmation.
3. API returns walking route; the client retains route state under documented offline/licensing constraints.
4. Client sends bounded location/heading updates. Optional visual evidence is sent only with clear consent and sampling controls.
5. API validates, limits, and orchestrates; vision returns a schema-validated estimate with evidence and model version.
6. Client/API fusion checks GPS accuracy, route geometry, heading, visual evidence, and stability. If inconsistent, abstain and request safe relocalization.
7. Telemetry records aggregate performance without raw camera content or unnecessary precise location.

## Trust boundaries and failure modes

| Boundary/failure | Required behavior |
|---|---|
| Device sensors or OCR can be spoofed/noisy | Treat as untrusted; cross-check route, accuracy, heading, and persistence |
| Map API timeout/quota | Surface explicit error; reuse only legally permitted cached data; no fabricated route |
| Vision outage/low confidence | GPS-only fallback; no confident landmark claim |
| GPS drift/urban canyon | Increase uncertainty; avoid flicker; request relocalization or pause |
| Redis/database unavailable | Health/readiness reflect dependency; bypass only where correctness and policy allow |
| Model returns invalid output | Reject output, log sanitized validation failure, fall back |
| Location privacy incident | Minimize data, restrict access, follow incident/runbook and applicable law |
| Route crosses restricted/unsafe area | Reject or request a permitted alternative; never synthesize unsafe shortcuts |

## Scalability and resilience

Keep API and vision stateless where practical; load models once per worker; bound requests and inference concurrency; prefetch only after licensing approval. Cache entries have explicit keys, TTL, ownership, and purge semantics. Use queues for ingestion, not user-critical instructions. Apply circuit breakers and idempotency to provider calls. Database migrations run as a coordinated job, never independently on every pod.

## Architecture diagrams

Mermaid sources are in `diagrams/src/`; generated output belongs in `diagrams/rendered/`. See `make diagrams`.
