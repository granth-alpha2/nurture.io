# MASTER PROMPT: AI-Powered Visual Navigation Platform ("LandmarkNav")

> Paste this entire document into Antigravity as the project brief. Keep the original product idea, but follow the engineering, documentation, infrastructure and workflow rules below strictly.

---

## 0. HOW YOU (THE AGENT) MUST WORK

You are acting as a **principal software architect + staff engineer + DevOps/SRE + technical writer** delivering a production-grade system, not a demo.

### 0.1 Operating rules
1. **Plan first, code second.** Before writing any code, produce `docs/` (Phase 0 below) and wait for the gates defined in each phase to be satisfied.
2. **Work phase by phase.** Do not start a phase until the previous phase's *Definition of Done* is met and checked off in `docs/PROGRESS.md`.
3. **Never redo finished work.** Maintain these persistent context files and read them at the start of every session instead of re-analysing the repo:
   - `AGENTS.md` – conventions, commands, architecture summary, do/don't rules (keep under 200 lines).
   - `docs/PROGRESS.md` – checklist of phases/tasks with status, decisions made, open questions.
   - `docs/adr/` – one Architecture Decision Record per significant decision (never re-debate a decision that has an ADR unless the user asks).
4. **Honesty over polish.** Label anything simulated/mocked as `SIMULATED` in code, UI and docs. Never fake landmark recognition. If an API capability, price or licensing term cannot be verified, write it to `docs/OPEN_QUESTIONS.md` instead of guessing.
5. **Everything reproducible.** One command bootstraps the dev environment (`make bootstrap`), one command runs everything locally (`make up`), one command runs all checks (`make verify`).
6. **Small, reviewable commits** using Conventional Commits (`feat:`, `fix:`, `docs:`, `infra:`, `test:`, `chore:`).
7. At the end of every phase, output a short summary: what was built, what was verified (with evidence: test output, screenshots), what is simulated, what is next.

### 0.2 Product summary (unchanged intent)
A mobile-first app for non-technical users (elderly, tourists, first-time visitors). The user opens the app, sees a live camera view, says or types a destination, and follows **simple spoken + on-screen instructions anchored to real visible landmarks** ("Turn left at the red building"). No map literacy required.

---

## 1. NON-NEGOTIABLE PRODUCT & SAFETY PRINCIPLES

- Camera-first, one-instruction-at-a-time UI; large text, high contrast, voice guidance, one big "Repeat" button.
- **Never give a confident instruction from an uncertain match.** If confidence is insufficient → fall back to plain GPS walking guidance and ask the user to point the camera at a sign/street.
- Fuse signals (GPS + accuracy + heading + route geometry + visual match). Never rely on visual matching alone.
- Do not claim arrival from proximity alone (road crossings, large complexes, wrong entrances).
- Pedestrian safety: don't encourage screen-staring while crossing; simplify to audio-only near crossings; never route through restricted areas; app does not guarantee safety (disclaimer in onboarding and Terms).
- Confidence scores are **not** probabilities. Calibrate against a labelled real-world dataset (see §9) and record the calibration method in `docs/ml/CALIBRATION.md`.
- Anti-flicker: hysteresis + minimum dwell time before switching landmark candidates or instructions.

---

## 2. TECHNOLOGY DECISIONS (choose once, record as ADRs)

| Layer | Choice |
|---|---|
| Mobile | **React Native + TypeScript + Expo (dev client / prebuild)**, `react-native-vision-camera`, `expo-location`, `expo-speech`, `react-native-sensors`/heading API. Android first, iOS-ready. |
| Mobile state/data | Zustand (or Redux Toolkit), TanStack Query, Zod for schema validation, i18next for localisation |
| API / orchestration | **Node.js + TypeScript + Fastify**, OpenAPI 3.1 generated from Zod schemas |
| Vision service | **Python 3.12 + FastAPI**, provider-agnostic interface (`VisionProvider`) with adapters (e.g. Gemini, local embedding model such as CLIP/SigLIP, OCR such as PaddleOCR/Tesseract). Provider swap = config change only. |
| Database | **PostgreSQL + PostGIS + pgvector** (spatial queries + image-embedding similarity) |
| Cache | **Redis** (hot cache, rate limiting, idempotency) |
| Async jobs | BullMQ (Redis) or Cloud Tasks/PubSub for ingestion & embedding jobs |
| Object storage | S3-compatible / GCS (embeddings & permitted derived metadata only – see §7.3) |
| Infrastructure as Code | **Terraform** (modular, remote state, per-environment tfvars) |
| Containers | **Docker** (multi-stage, non-root, distroless/slim, pinned digests) |
| Orchestration | **Kubernetes** (GKE recommended since Google Maps Platform is used; keep manifests cloud-portable) packaged with **Helm** or **Kustomize** |
| CI/CD | GitHub Actions (+ Argo CD or Flux for GitOps deploys) |
| Observability | OpenTelemetry → Prometheus + Grafana + Loki/Cloud Logging; Sentry for mobile & API crash reporting |
| Secrets | Cloud Secret Manager + External Secrets Operator (never in images/repo) |

> Evaluate Google's **ARCore Geospatial API (VPS)** as the primary visual-localisation mechanism on supported devices/regions (it localises the camera against Street View data and gives a camera pose suitable for AR arrows). Use the custom landmark-matching pipeline as a complement/fallback. Record the evaluation (coverage in India, licensing, pricing, device support) in an ADR. Do not assume coverage; verify.

---

## 3. PHASE 0 — ARCHITECTURE & DOCUMENTATION (MUST BE DONE FIRST)

Create the following under `docs/`. All diagrams are **text-based (Mermaid and/or PlantUML source committed to the repo)** and also exported to PNG/SVG in `docs/diagrams/rendered/` via `make diagrams`.

### 3.1 Required documents
| File | Contents |
|---|---|
| `docs/00-vision-and-scope.md` | Problem, personas, goals, non-goals, success metrics (e.g. task completion rate, time-to-destination, wrong-turn rate, % instructions with verified evidence) |
| `docs/01-PRD.md` | User stories with acceptance criteria (Given/When/Then), MoSCoW priorities |
| `docs/02-SRS.md` | Functional + non-functional requirements with IDs (FR-001…, NFR-001…), traceability matrix to tests |
| `docs/03-architecture.md` | C4 model: Context, Container, Component views; data flow; trust boundaries; scalability & failure modes |
| `docs/04-api/openapi.yaml` + `docs/04-api/README.md` | Versioned REST contract (`/v1/...`), error model (RFC 7807), pagination, idempotency, rate limits |
| `docs/05-data-model.md` | ERD, PostGIS/pgvector schemas, indexing strategy, retention policy |
| `docs/06-security-and-privacy.md` | Threat model (STRIDE), OWASP MASVS/ASVS mapping, data classification, consent flow, GDPR/India DPDP considerations, retention |
| `docs/07-ml-pipeline.md` | Landmark-matching pipeline, model abstraction, evaluation methodology, calibration |
| `docs/08-infrastructure.md` | Terraform module map, environments, networking, cost estimate, DR/backup |
| `docs/09-testing-strategy.md` | Test pyramid, datasets, field-test protocol, exit criteria |
| `docs/10-runbook.md` | Deploy, rollback, on-call, SLOs/alerts, incident template |
| `docs/11-accessibility.md` | WCAG 2.2 AA mapping, TalkBack/VoiceOver checklist, plain-language copy guide |
| `docs/12-licensing-compliance.md` | Google Maps Platform ToS constraints (caching, photo usage, Street View), attribution requirements, third-party licenses (SBOM) |
| `docs/adr/NNNN-*.md` | ADRs (context, decision, consequences) |
| `docs/OPEN_QUESTIONS.md`, `docs/PROGRESS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` | Living documents |

### 3.2 Required UML / diagrams (all mandatory)
1. **Use Case Diagram** – actors: *Navigating User (non-technical)*, *Tourist*, *Elderly User*, *Admin/Operator*, *Google Maps Platform (external)*, *Vision/AI Provider (external)*. Use cases include: Search destination (text/voice), Confirm destination, Start navigation, Receive spoken instruction, Repeat instruction, Recognise landmark, Relocalise, Handle wrong turn/reroute, Pause/End navigation, Confirm arrival, Change language, Grant/revoke permissions, Report bad instruction (feedback). Use `<<include>>`/`<<extend>>` correctly. Include a **use-case specification table** (preconditions, main flow, alternate flows, postconditions) for each key use case.
2. **Context & Container diagrams (C4)**.
3. **Component diagram** – mobile app modules and backend services.
4. **Class diagrams** – mobile domain model and backend domain model (entities: `User`, `NavigationSession`, `Route`, `RouteStep`, `Landmark`, `ReferenceImage`, `LandmarkMatch`, `LocalizationEstimate`, `Instruction`, `Feedback`).
5. **Sequence diagrams** (at minimum): (a) destination search → route creation, (b) per-frame landmark recognition & fusion, (c) wrong-turn detection & reroute, (d) arrival confirmation, (e) offline/degraded-mode fallback.
6. **State machine diagram** – navigation session (`Idle → Searching → RouteReady → Navigating → Relocalizing → Rerouting → Paused → Arrived/Cancelled`) and landmark-match lifecycle (`Candidate → Verified → Stable → Expired`).
7. **Activity diagram** – the 12-step landmark-matching pipeline with decision points on confidence & consistency.
8. **ER diagram** – database schema.
9. **Deployment diagram** – Docker images → Kubernetes namespaces/pods/services/ingress → managed DB/cache/storage → Google APIs; show environments (dev/stage/prod).
10. **Network & trust-boundary diagram** (data-flow diagram with security boundaries).

**Gate:** Phase 0 is complete only when every document and diagram above exists, renders without errors, and the user has been shown the summary. Then proceed.

---

## 4. REPOSITORY STRUCTURE (MONOREPO)

```
landmarknav/
├── AGENTS.md
├── README.md
├── Makefile
├── .editorconfig  .gitignore  .env.example  .pre-commit-config.yaml
├── .github/
│   ├── workflows/            # ci-mobile, ci-api, ci-vision, ci-infra, release, security-scan
│   ├── ISSUE_TEMPLATE/  PULL_REQUEST_TEMPLATE.md  CODEOWNERS  dependabot.yml
├── docs/                     # see §3 (diagrams/src, diagrams/rendered, adr, api, ml)
├── apps/
│   ├── mobile/               # React Native (Expo) app
│   │   ├── src/
│   │   │   ├── app/          # navigation/routes
│   │   │   ├── features/
│   │   │   │   ├── camera/ ├── destination-search/ ├── navigation/
│   │   │   │   ├── instructions/ ├── voice/ ├── permissions/ ├── feedback/ └── settings/
│   │   │   ├── core/         # api-client, config, logging, i18n, theme, errors
│   │   │   ├── domain/       # types, schemas (zod), fusion/localisation logic
│   │   │   ├── services/     # location, heading, tts, frame-sampler, offline-cache
│   │   │   └── ui/           # accessible design-system components
│   │   ├── __tests__/  e2e/  (Detox or Maestro)
│   │   └── app.config.ts  eas.json
│   ├── api/                  # Fastify TypeScript orchestration API
│   │   ├── src/
│   │   │   ├── modules/      # places, routes, navigation-sessions, landmarks, feedback, health
│   │   │   ├── integrations/ # google-maps (routes, places, photos), vision-client
│   │   │   ├── domain/  infra/ (db, redis, queue)  plugins/  config/  telemetry/
│   │   ├── migrations/  test/ (unit, integration, contract)
│   │   └── Dockerfile
│   └── vision/               # Python FastAPI vision/matching service
│       ├── app/
│       │   ├── api/  core/  providers/ (base.py, gemini.py, local_clip.py, ocr.py)
│       │   ├── pipeline/ (candidate_retrieval, embedding, matching, scoring, fusion)
│       │   └── schemas/
│       ├── tests/  notebooks/ (evaluation only)  Dockerfile
├── packages/
│   ├── contracts/            # shared OpenAPI/JSON-Schema + generated TS & Python clients
│   ├── geo-utils/            # bearing, haversine, geohash/H3, route-progress math (+ tests)
│   └── eslint-config/ tsconfig/
├── infra/
│   ├── terraform/
│   │   ├── modules/          # network, gke, cloudsql-postgres, redis, storage, artifact-registry, secrets, iam, monitoring
│   │   ├── envs/             # dev/ stage/ prod/ (main.tf, backend.tf, terraform.tfvars)
│   │   └── README.md
│   ├── k8s/
│   │   ├── base/             # deployments, services, hpa, pdb, networkpolicy, configmap, ingress
│   │   ├── overlays/         # dev/ stage/ prod/ (Kustomize) — or helm/ charts
│   │   └── argocd/           # app-of-apps manifests
│   └── docker/               # docker-compose.yml (local), compose.override.yml, otel/prometheus/grafana configs
├── data/
│   ├── eval/                 # labelled evaluation set manifest (no raw personal images committed)
│   └── seeds/
├── scripts/                  # bootstrap.sh, gen-clients.sh, seed.sh, diagrams.sh
└── tests/
    ├── e2e/  load/ (k6)  field-test-protocol.md
```

---

## 5. BACKEND & VISION DESIGN REQUIREMENTS

### 5.1 API (versioned `/v1`)
- `POST /v1/places/search` (autocomplete + details; session tokens to control Google billing)
- `POST /v1/routes/walking` (Routes API; return simplified steps + polyline + step landmarks)
- `POST /v1/sessions` / `PATCH /v1/sessions/{id}` / `DELETE` (navigation session lifecycle)
- `POST /v1/localize` (GPS + accuracy + heading + compact visual features or a single sampled frame → `LocalizationEstimate`)
- `POST /v1/feedback`
- `GET /healthz`, `GET /readyz`, `GET /metrics`
- Requirements: Zod/JSON-Schema validation on **all** inputs and **all** AI outputs, RFC 7807 errors, idempotency keys, request IDs, timeouts, retries with jittered backoff, circuit breakers, rate limiting per device/session, structured JSON logs without PII.

### 5.2 Vision pipeline (modular, provider-agnostic)
Implement the 12-step pipeline from the original brief as discrete, individually testable stages:
`candidate_retrieval → reference_image_lookup → embedding → ocr/sign_text → matching → spatial_consistency_check → fusion → confidence_calibration → hysteresis/stabilisation → instruction_generation`.
- Output must conform to a versioned JSON schema (`landmark_name`, `match_confidence`, `location_confirmed`, `distance_to_landmark_meters`, `next_instruction`, `next_maneuver`, `distance_to_next_maneuver_meters`, `requires_relocalization`, plus `evidence[]` and `model_version`). Reject/repair invalid LLM output; never display unvalidated text.
- Candidate search: start with ~2–3 km radius as an **upper bound only**, then narrow by heading cone, route corridor, and text/visual similarity.
- Fusion: Kalman/particle-style filter combining GPS (with accuracy), heading, route snapping, and visual match likelihood; explicit handling of GPS/vision disagreement → `requires_relocalization=true`.

### 5.3 **Avoiding repeated processing (efficiency & caching strategy — required)**
The goal is that expensive work (API calls, embeddings, model inference) is done **once** and reused:
1. **Precompute & persist embeddings.** Reference-image embeddings for landmarks are computed by an *offline/async ingestion job* and stored in `pgvector`, indexed (HNSW) and keyed by `place_id` + geohash/H3 cell. The live path only embeds the *camera frame* and runs a vector similarity query.
2. **Tile-based candidate cache.** Cache candidate sets per H3 cell + heading bucket in Redis (TTL configurable, respecting licensing in §7.3). Walking along a route re-uses cached cells.
3. **Route-corridor prefetch.** When a route is created, asynchronously prefetch/embed landmarks along the corridor so later steps hit cache.
4. **Frame de-duplication.** On device: perceptual-hash / motion gating — skip frames that are near-identical to the last analysed frame; adaptive sampling (higher near turns/intersections, lower on long straight segments); on-device blur/lighting quality gate.
5. **Result memoisation.** Cache `LandmarkMatch` results by (frame pHash, H3 cell, route-step); stable matches are reused until the user moves beyond a threshold.
6. **Send features, not video.** Prefer on-device OCR/embeddings and upload only compact features or a single selected, downscaled frame; never stream raw video.
7. **Idempotency & request coalescing** for identical in-flight requests.
8. **Horizontal scaling & warm models.** Vision service keeps models loaded in memory (no cold-start per request); GPU/CPU node pool autoscaling via HPA/KEDA on queue depth/latency.
9. **Agent-level:** keep `AGENTS.md`, `PROGRESS.md` and ADRs current so the coding agent never needs to re-derive context.

---

## 6. INFRASTRUCTURE, DEVOPS & DEPLOYMENT (INDUSTRY STANDARD)

### 6.1 Docker
- Multi-stage builds, non-root user, read-only root filesystem, `HEALTHCHECK`, pinned base image digests, `.dockerignore`, SBOM generation, vulnerability scan (Trivy) in CI.
- `docker-compose.yml` for local dev: api, vision, postgres(+postgis+pgvector), redis, otel-collector, prometheus, grafana, a mock Google/vision provider profile for offline development (clearly labelled `SIMULATED`).

### 6.2 Terraform
- Modular, DRY, versioned modules; remote state (GCS bucket + locking); separate `dev`/`stage`/`prod`; `terraform fmt`, `validate`, `tflint`, `checkov`/`tfsec` in CI; `plan` posted on PRs, `apply` gated by approval.
- Provision: VPC + subnets + Cloud NAT, GKE (private cluster, Workload Identity, node pools incl. optional GPU pool), Cloud SQL Postgres (HA in prod, PITR backups) with PostGIS/pgvector, Memorystore Redis, Artifact Registry, Secret Manager, Cloud Storage, IAM least-privilege service accounts, Cloud Armor/WAF, Cloud Monitoring alerts & budgets.
- Pick a region appropriate for India users (e.g. `asia-south1` / `asia-south2`) and document data-residency reasoning in an ADR.

### 6.3 Kubernetes
- Namespaces per environment; `Deployment`s with resource requests/limits, liveness/readiness/startup probes, rolling updates, `PodDisruptionBudget`, `HorizontalPodAutoscaler`, `NetworkPolicy` (default deny), `PodSecurity` restricted, `ServiceAccount` per workload, Ingress + managed TLS, config via `ConfigMap`, secrets via External Secrets.
- Kustomize overlays (or Helm charts) with environment-specific values; GitOps with Argo CD; canary/blue-green rollout option documented.
- Database migrations run as a Kubernetes `Job` / init step with locking, never at pod start in parallel.

### 6.4 CI/CD (GitHub Actions)
Pipeline stages: lint → typecheck → unit tests → build images → integration tests (compose/kind) → security scans (SAST/CodeQL, dependency audit, Trivy, secret scanning) → contract tests → push to registry → deploy to dev automatically; stage/prod with manual approval; mobile builds via EAS; semantic versioning & automated changelog.

### 6.5 Observability & SLOs
- Metrics: request latency, error rate, match-confidence distribution, % instructions with verified evidence, reroute rate, cache hit ratio, vision inference latency, external-API cost per session.
- Define SLOs (e.g. 99.5% API availability, p95 `/localize` < target) with alerts and runbook links. Tracing across mobile → API → vision.

---

## 7. SECURITY, PRIVACY & COMPLIANCE

1. **No server-side Google keys in the app.** Mobile uses only restricted client keys (package name + SHA-1 / bundle ID restrictions) where unavoidable; all privileged calls go through the backend. Enable per-API quotas and budget alerts.
2. Authentication: anonymous device-scoped sessions with attestation (Play Integrity / App Attest), short-lived JWTs, rate limiting; optional accounts later.
3. **Privacy by design:** process on-device where feasible; do not persist camera images by default; explicit, plain-language consent; easy data deletion; configurable retention; blur faces/plates if any frame must be stored (only with consent, for debugging).
4. **Licensing (critical):** Google Maps Platform terms restrict caching/storing content such as Places photos, Street View imagery and most place data (generally only `place_id` and limited lat/lng may be retained for limited periods). **Verify the current terms and document them in `docs/12-licensing-compliance.md` before implementing any storage of Google-derived content.** If derived embeddings from Google imagery are not permitted to be stored, switch the persistent reference source to licence-compatible imagery (e.g. Mapillary / open street-level imagery, user-contributed with consent, or operator-owned photos) and keep Google data transient. Always show required attributions.
5. Supply chain: dependency pinning, SBOM, Dependabot/Renovate, signed images (cosign), least-privilege CI tokens.
6. Threat model must cover: spoofed GPS, adversarial images/prompt injection via signs (treat OCR text as untrusted data, never as instructions), API abuse/cost exhaustion, location-privacy leakage.

---

## 8. MOBILE APP REQUIREMENTS

- Screens: Onboarding (permissions with plain-language reasons + safety notice), Home (camera + destination + mic + START), Navigation (camera, large arrow, one instruction, distance, progress, Repeat, Pause/End), Arrival, Settings (language, voice speed, text size, privacy).
- Accessibility: WCAG 2.2 AA, min 48dp touch targets, font scaling, TalkBack/VoiceOver labels, haptic cues, high-contrast mode, reduced motion.
- Localisation: English + Hindi first (i18n-ready, TTS language aware); instruction copy written at a simple reading level.
- Resilience: offline detection, degrade to cached route + GPS-only guidance, retry/timeouts, camera/GPS error recovery, battery-aware sampling.
- AR arrows only when position, heading and camera pose confidence thresholds are met (or via ARCore Geospatial); otherwise show a 2D directional arrow.

---

## 9. TESTING STRATEGY (MANDATORY DELIVERABLE)

- **Unit** (≥80% on domain/fusion/geo logic), **integration** (API + Postgres + Redis via Testcontainers), **contract** (OpenAPI schema tests between mobile/API/vision), **e2e** (Maestro/Detox with mocked GPS routes), **load** (k6), **IaC tests** (terraform validate/plan, kube-linter/kubeconform).
- **ML evaluation:** build a labelled field dataset (different lighting, crowds, occlusion, similar-looking buildings, night/rain); report precision/recall at thresholds, false-confident-match rate (primary safety metric), calibration curves (ECE). Exit criterion example: false-confident-match rate below an agreed, documented target before enabling visual instructions by default.
- **Scenario matrix** (automated where possible): GPS drift/loss, indoor/urban canyon, wrong turn, U-turn, poor lighting, blur, network failure/timeouts, API quota exceeded, vision provider outage (failover), duplicate-looking landmarks, permission denial/revocation mid-session, battery saver mode.
- **Field-test protocol** with real walkers (including elderly participants) and success metrics; results recorded in `docs/09-testing-strategy.md`.

---

## 10. PHASED DELIVERY WITH GATES

| Phase | Scope | Definition of Done |
|---|---|---|
| **0** | Docs, UML, ADRs, repo scaffold, CI skeleton, `AGENTS.md`, `PROGRESS.md` | All §3 artefacts rendered & committed |
| **1** | Local platform: Docker Compose, API, DB, mobile camera-first UI, destination search, Routes API walking guidance, TTS, deviation detection, arrival (GPS-only) | Usable GPS-only navigation end-to-end locally; tests green; `make up` works |
| **2** | Terraform + Kubernetes + CI/CD to `dev`; observability; security baseline | `terraform apply` + GitOps deploy works from clean state; dashboards & alerts live |
| **3** | Visual landmark recognition: ingestion jobs, pgvector, caching layers (§5.3), vision provider adapters, calibration + evaluation harness | Eval report meets documented targets; feature-flagged |
| **4** | Fusion/relocalisation, landmark-to-landmark guidance, wrong-turn recovery, optional ARCore Geospatial arrows | Scenario matrix passes |
| **5** | Accessibility audit, i18n (EN/HI), performance/battery tuning, load tests, DR drill, field tests, release hardening | SLOs met; runbook verified; store-ready builds |

At the end of each phase, update `docs/PROGRESS.md`, `CHANGELOG.md` and regenerate diagrams.

---

## 11. FINAL DELIVERABLES CHECKLIST

- [ ] All documents and UML/C4 diagrams in §3 (source + rendered)
- [ ] Monorepo with the structure in §4
- [ ] Working mobile app, API and vision service (real integrations where credentials exist; everything else clearly `SIMULATED`)
- [ ] Docker images + Compose for local development
- [ ] Terraform modules/environments + Kubernetes manifests (Kustomize/Helm) + GitOps config
- [ ] CI/CD workflows with security scanning
- [ ] `.env.example` for every service (no real secrets), setup/installation guide, API-key configuration guide
- [ ] Testing plan + automated tests + ML evaluation report
- [ ] Runbook, SLOs, licensing/compliance doc, privacy policy draft
- [ ] `AGENTS.md` + `PROGRESS.md` kept current

**Core product principle:** *Don't make users learn how to navigate a map. Help them understand the world directly in front of them — and never state anything the evidence doesn't support.*

Begin with **Phase 0**. Do not write application code until the Phase 0 gate is satisfied.