# LandmarkNav Copilot Handoff Note & Phase 1 Audit

**Date:** 2026-10-22  
**Auditor:** Phase Auditor Agent  
**Target Repository:** LandmarkNav (`c:\nurture.io`)  
**Status:** Phase 0 Complete | Phase 1 Implementation Complete & Locally Verified | Phase 1 Device/Audit Gate Pending

---

## 1. Executive Summary

This handoff note documents the audit and verification of work completed across Phase 0 and Phase 1 of the LandmarkNav repository. 

All primary deliverables for Phase 1 are in place, cleanly structured, and verified:
- **API Backend (`apps/api`)**: Fastify 5.12.7 + TypeScript + Node 22 service providing `/v1/places/search`, `/v1/routes/walking`, `/v1/routes/:routeId`, `/v1/sessions`, `/v1/localize`, and `/v1/feedback`. All endpoints enforce strict Zod schemas, RFC 7807 problem details, request tracking (`x-request-id`), in-memory idempotency caching, and Prometheus metrics.
- **Database & Persistence (`apps/api/migrations` & `infra/docker`)**: PostgreSQL 16 image configured with PostGIS 3 and pgvector 0.8.1. Parameterized, transactional SQL repository in `apps/api/src/infra/repository.ts` manages route storage, session lifecycle, cascade cleanup of orphan routes, and user feedback.
- **Mobile Client (`apps/mobile`)**: React Native + Expo client with accessible UI, high-contrast toggle, adjustable text and speech rates, bilingual localization (English & Hindi), turn-by-turn guidance, pause/resume/end session management, and destination search via voice or text.
- **Vision Shell (`apps/vision`)**: FastAPI service running under Python 3.12, pinned in `SIMULATED` mode; visual localization returns an explicit 503 RFC 7807 response confirming no camera frames or visual features are processed.
- **Container Infrastructure (`infra/docker`)**: Production-ready `docker-compose.yml` orchestrating API, PostgreSQL, Redis, Vision service, OpenTelemetry Collector (`otel/opentelemetry-collector-contrib:0.110.0`), Prometheus (`v2.55.1`), and Grafana (`11.2.0`). All containers enforce non-root execution, `cap_drop: ALL`, read-only root filesystems, and health checks.

---

## 2. Verification Evidence & Test Results

| Check / Test Suite | Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **API Workspace Verify** | `apps/api` | **PASS (13/13)** | `tsc --noEmit`, 13 `node:test` integration tests, TypeScript production build (`tsc -p tsconfig.json`). |
| **API Vulnerability Audit** | `apps/api` | **PASS (0 vulns)** | `npm audit --workspace=@landmarknav/api --audit-level=low` reports zero vulnerabilities. |
| **Mobile Workspace Verify** | `apps/mobile` | **PASS (6/6)** | `tsc --noEmit`, 6 domain tests for distance, bearings, off-route rerouting, arrival radius, degraded GPS copy. |
| **Mobile Android Export** | `apps/mobile` | **PASS** | Expo Android JS bundle successfully emitted (1.7 MB). |
| **YAML Configuration Lint** | Workspace | **PASS** | `scripts/validate-yaml.mjs` validated all 10 GitHub workflows and issue templates. |
| **Compose Configuration** | `infra/docker` | **PASS** | `docker compose -f infra/docker/docker-compose.yml config` valid with resolved env and networks. |
| **Vision Test Suite** | `apps/vision` | **PASS (2/2)** | 2 pytest tests verified in Python 3.12 CI environment checking SIMULATED healthz and 503 response. |
| **Live Compose Stack** | Platform | **PASS (Healthy)** | Database, Redis, API, Vision, Collector, Prometheus, and Grafana start and report healthy. |
| **Live API Flow** | Platform | **PASS** | End-to-end `/healthz`, `/readyz`, place search, route generation, GPS localization, and session pause/resume/delete verified against running containers. |
| **Root Dependency Audit** | Root | **GATE BLOCKED** | 15 high-severity vulnerabilities reported in Expo/Metro transitive dependencies (`braces`, `node-forge`). |
| **Physical Device Test** | Mobile | **PENDING** | Native build and field GPS test on physical Android device pending. |

---

## 3. Adherence to AGENTS.md & Architectural Rules

| Rule | AGENTS.md Constraint | Implementation Audit Findings | Compliance |
| :--- | :--- | :--- | :--- |
| **1. Safety & Certainty** | Never present uncertain visual match as confident instruction. Fall back to GPS-only. | Visual match confidence is hardcoded to 0; landmark name is `null`. Off-route (>40m) or inaccurate GPS (>25m) flags `requires_relocalization: true` and suppresses instructions. | **PASS** |
| **2. Phase 1 Boundaries** | In Phase 1, use GPS accuracy and route geometry only; never imply visual localization is enabled. | Mobile client forces `visualConsent: false`. API rejects `visualConsent: true` with 422 `feature-unavailable`. Vision service returns 503 `feature-unavailable`. | **PASS** |
| **3. SIMULATED Labeling** | Mark every mock or simulated capability `SIMULATED`. | Every place candidate, route response, vision health check, and mobile camera UI overlay explicitly shows `SIMULATED`. | **PASS** |
| **4. Privacy & Images** | Do not persist camera images. Treat OCR as untrusted. | Camera preview in `apps/mobile/App.tsx` renders locally via `expo-camera` without frame buffer transmission. No frame upload endpoint exists in the API. | **PASS** |
| **5. Licensing & Data** | No Google-derived persistent embeddings until verified. | All route and place data in Phase 1 are synthetic straight-line fixtures generated by `SimulatedMapsProvider`. No Google API calls or storage. | **PASS** |
| **6. Secret Hygiene** | Never put privileged API keys in mobile app or git. | Zero secrets committed. `.env` is gitignored. Mobile client uses loopback/LAN API URL and anonymous device ID header. | **PASS** |
| **7. API Standards** | RFC 7807 problem responses, request IDs, structured logs without PII. | Fastify error handler and custom routes emit `application/problem+json`. `x-request-id` generated and echoed on all requests. Logger redacts sensitive fields. | **PASS** |
| **8. Accessible UX** | Accessible, one-instruction-at-a-time UX and simple language. | Mobile UI features large buttons, speech synthesis, speech input, text scaling (0.9x to 1.5x), high-contrast palette, and plain bilingual copy (EN/HI). | **PASS** |

---

## 4. Caveats, Blockers & Environment Specifics

### 1. GNU Make on Windows
- **Issue**: Standard Windows developer environments do not include GNU `make`.
- **Resolution**: All targets in `Makefile` (`diagrams`, `bootstrap`, `up`, `down`, `verify`) are simple aliases to npm scripts in `package.json` (`npm run <target>`). Windows developers can execute `npm run <target>` directly with identical behavior.

### 2. Docker Desktop / Container Runtime
- **Issue**: Docker Compose requires the Docker Desktop Linux daemon / engine to be running.
- **Resolution**: Verified working in this workspace. All 7 containers (`api`, `db`, `redis`, `vision`, `otel-collector`, `prometheus`, `grafana`) build and run with health checks passing.

### 3. Root Dependency Audit Findings (15 High-Severity Advisories)
- **Issue**: `npm run verify` invokes `npm audit --audit-level=low`, which fails due to 15 high-severity vulnerabilities originating from Expo SDK / React Native Metro tooling dependencies (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv).
- **Caveat**: `npm audit fix --force` attempts to downgrade Expo to 44.0.6, which breaks the application and TypeScript compilation.
- **Recommendation**: 
  1. The production runtime API workspace (`apps/api`) has **zero vulnerabilities**.
  2. The mobile dependencies are client-side / dev tooling dependencies.
  3. Formally record a security acceptance in `docs/09-security.md` for local Phase 1 Expo tooling, or configure an audit exception policy / `npm audit --omit=dev` for CI until Expo releases an updated Metro bundle.

### 4. Native Device & ADB Validation
- **Issue**: While the Android JavaScript bundle exports cleanly via Expo CLI, a live physical device run with real Android Debug Bridge (ADB) has not been performed in this CI/terminal environment.
- **Next Step**: When physical Android hardware is available, run `npx expo run:android` to validate native camera permissions and speech engine integration.

---

## 5. Inventory of Implemented Files

### Backend & API (`apps/api`)
- `apps/api/package.json`: Fastify 5.12.7, pg, redis, prom-client, zod, tsx, typescript.
- `apps/api/tsconfig.json`: Modern NodeNext TypeScript configuration.
- `apps/api/Dockerfile`: Multi-stage Alpine container running as non-root `node` user.
- `apps/api/src/app.ts`: Fastify application setup, CORS, rate limiting, metrics, RFC 7807 error handler, routes.
- `apps/api/src/server.ts`: Server entrypoint with environment validation, PostgreSQL pool, Redis client, and graceful shutdown.
- `apps/api/src/migrate.ts`: Database migration runner.
- `apps/api/src/domain/schemas.ts`: Strict Zod validation schemas and TypeScript types.
- `apps/api/src/domain/geo.ts`: Haversine distance, cross-track distance, and route progress calculations.
- `apps/api/src/infra/repository.ts`: Memory and PostgreSQL repositories with transaction support and cascade cleanup.
- `apps/api/src/providers/simulated-maps.ts`: Synthetic place search and straight-line route generator.
- `apps/api/src/test/api.test.ts`: 13 comprehensive integration tests covering all routes and error conditions.
- `apps/api/migrations/001-initial.sql`: Database schema with PostGIS and pgvector extensions, indexes, and foreign keys.

### Mobile Application (`apps/mobile`)
- `apps/mobile/package.json`: React Native, Expo 51, expo-camera, expo-location, expo-speech, expo-speech-recognition.
- `apps/mobile/app.json`: Expo app configuration.
- `apps/mobile/App.tsx`: Main navigation UI with accessibility features, bilingual copy, and camera preview.
- `apps/mobile/src/domain/navigation.ts`: Geodesic navigation math, bearing arrows, rerouting heuristics, and formatting.
- `apps/mobile/src/domain/navigation.test.ts`: 6 domain unit tests.
- `apps/mobile/src/services/api.ts`: Typed API client with abort timeouts and anonymous device tracking.

### Vision Service (`apps/vision`)
- `apps/vision/Dockerfile`: Multi-stage Python 3.12-slim container with non-root user and health check.
- `apps/vision/requirements.txt`: FastAPI, Uvicorn, Pydantic.
- `apps/vision/requirements-dev.txt`: Pytest, Httpx.
- `apps/vision/app/main.py`: Explicitly SIMULATED FastAPI shell returning 503 for visual localization.
- `apps/vision/tests/test_api.py`: Pytest test suite for healthz and 503 behavior.

### Platform Infrastructure & Observability (`infra/docker`)
- `infra/docker/docker-compose.yml`: Multi-container Compose stack with resource isolation and security options.
- `infra/docker/Dockerfile.postgres`: Custom PostgreSQL 16 image with PostGIS and pgvector.
- `infra/docker/otel/collector.yaml`: OpenTelemetry Collector configuration.
- `infra/docker/prometheus/prometheus.yml`: Prometheus scraper configuration for API metrics.
- `infra/docker/grafana/provisioning/`: Datasource and dashboard provisioning for Grafana.

---

## 6. Handoff to Phase 2 (Infrastructure & Cloud Target)

The Phase 2 Infrastructure Builder Agent is currently active in conversation `03557de2-9db7-4fe8-9abe-3b5a2e26e461`.
The target for Phase 2 includes:
1. **Terraform Modules for GCP/GKE**: Private VPC, Cloud SQL PostgreSQL (pgvector/PostGIS), Memorystore Redis, GCS, IAM Workload Identity, Artifact Registry, and Cloud Monitoring.
2. **Kustomize Overlays**: Base manifests + dev/stage/prod overlays for API and Vision services, including NetworkPolicies and PodSecurityStandards.
3. **CI/CD Integration**: Updating `.github/workflows/ci-infra.yml` to lint and validate Terraform and Kustomize overlays.

Phase 1 provides a clean, well-tested foundation that adheres strictly to safety and simulation constraints.
