# LandmarkNav

LandmarkNav is a mobile-first navigation project for people who prefer plain-language guidance over map reading. Its core safety rule is that uncertainty must never be presented as a confident landmark instruction.

## One-Click Runner (Windows)

To build, verify, test, and launch all services in one go, run [`run-all.bat`](file:///c:/nurture.io/run-all.bat) from the root:
```cmd
run-all.bat
```
This batch runner:
1. Bootstraps `.env` if missing.
2. Runs the complete test suite (`npm run verify`: YAML validation, Fastify API tests, Expo Mobile tests, and zero-vulnerability audit).
3. Validates Phase 2 Cloud Infrastructure (Terraform modules & Kubernetes manifests).
4. Launches the container platform (PostgreSQL, Redis, API, Vision, Prometheus, Grafana).
5. Provides an interactive menu to start the Expo Mobile app or view live logs.

---

## Current status

All Phases (0 through 5) are 100% complete and verified:
- **Phase 0**: Architecture specifications, 16 verified Mermaid diagrams, 6 accepted ADRs.
- **Phase 1**: Local GPS-only platform, Fastify API, React Native Expo client, Docker Compose.
- **Phase 2**: Cloud infrastructure (9 Terraform modules across dev/stage/prod), K8s Kustomize manifests, ArgoCD GitOps, OIDC deploy pipeline, Prometheus/Grafana SLA alerts.
- **Phase 3**: Vision pipeline, `VisionProvider` abstraction (Gemini, OpenCLIP, OCR), PostGIS `pgvector` HNSW index, Redis H3 candidate tile caching, ECE confidence calibration.
- **Phase 4**: Multi-signal Kalman fusion engine, landmark turn sequencing, relocalization triggers, ARCore Geospatial adapter, and full scenario test matrix.
- **Phase 5**: WCAG 2.2 AA accessibility audit, bilingual English/Hindi localization, k6 load testing, DR drill runner, and release readiness verification.

---

## Local development

Requirements: Node.js 24, npm, Docker Desktop (with Linux engine), and Windows Developer PowerShell or CMD.

```cmd
run-all.bat
```

Or individual commands:
```sh
npm run bootstrap    # Generate .env configuration
npm run verify       # Run full monorepo verification & tests
npm run up           # Build and launch Docker Compose platform
npm run down         # Stop Docker Compose platform
npm run start --workspace=@landmarknav/mobile   # Start Expo mobile app
```

The local API is at `http://localhost:3000`; health and readiness endpoints are at `/healthz` and `/readyz`. The vision service is at `http://localhost:8000`, Prometheus is at `http://localhost:9090`, and Grafana is at `http://localhost:3001` (admin / admin).

---

## Workspaces and documentation

- [`apps/api/`](apps/api/README.md) — Fastify API, PostgreSQL persistence, multi-signal fusion engine, and tests.
- [`apps/mobile/`](apps/mobile/README.md) — Expo navigation client, device sensor harness, and ARCore adapter.
- [`apps/vision/`](apps/vision/README.md) — Python vision service, provider abstractions, and calibration pipeline.
- [`infra/docker/`](infra/docker/README.md) — Local Compose platform and observability configurations.
- [`infra/terraform/`](infra/terraform/README.md) — GCP Cloud Infrastructure modules and environments.
- [`infra/k8s/`](infra/k8s/README.md) — Kubernetes Kustomize manifests and GitOps configurations.
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — Phase status and verification evidence.
- [`docs/PHASE_5_RELEASE_READINESS.md`](docs/PHASE_5_RELEASE_READINESS.md) — Release readiness signoff and SLO verification.
