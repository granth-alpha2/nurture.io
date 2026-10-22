# Project progress

## Current phase: Phase 0 complete — Phase 1 next

Status: **Complete.** Required Phase 0 documentation, architecture decisions, repository scaffold, CI skeletons, and diagrams are present and validated. No application code, live integrations, generated clients, or deployed infrastructure exist.

## Phase checklist

### Phase 0
- [x] Read product brief and establish project conventions (`AGENTS.md`)
- [x] Create product, requirements, architecture, data, privacy, ML, infrastructure, testing, runbook, accessibility, licensing and API documentation
- [x] Record initial architecture decisions and unresolved external verification
- [x] Record ARCore Geospatial/VPS evaluation status and evidence gaps in an ADR
- [x] Add required Mermaid diagram sources
- [x] Render all 16 diagrams to `docs/diagrams/rendered/` and verify no errors
- [x] Add initial repository metadata and documentation CI skeleton
- [x] Add monorepo directory scaffold and per-domain CI workflow skeletons
- [x] Pin Mermaid rendering tooling for reproducible diagram generation
- [x] Complete Phase 0 documentation and render verification
- [x] Show Phase 0 completion summary and Phase 1 handoff to the user

### Phase 1 — Next phase (not started)
- [ ] Local Docker Compose, API, database, mobile GPS-only navigation, tests, `make up`

### Phase 2
- [ ] Terraform/Kubernetes/CI/CD, observability, security baseline

### Phase 3
- [ ] Vision pipeline, licensed ingestion, caching, calibration and evaluation gate

### Phase 4
- [ ] Fusion/relocalization, rerouting and optional ARCore, scenario matrix

### Phase 5
- [ ] Accessibility audit, i18n, performance, DR, field tests and release hardening

## Decisions and constraints

- The GPS-only route experience precedes visual navigation.
- Visual matches must abstain when evidence is uncertain or conflicting.
- Confidence scores are not probabilities.
- No persistent Google-derived content/embedding until licensing is verified.
- No raw camera-image persistence by default.
- See [ADRs](adr/) and [open questions](OPEN_QUESTIONS.md).

## Verification evidence

- Source inspected: `prompt.md` (Phase 0 requirements and product brief).
- Workspace initially contained only `prompt.md`.
- All 16 Mermaid diagrams rendered successfully to SVG with Mermaid CLI 12.0.0 and installed Chrome; source syntax errors were fixed during validation. The renderer is pinned in the root package manifest and lockfile.
- `npm ci` completed from the lockfile; `npm audit --audit-level=low` reported zero vulnerabilities.
- `npm run validate:yaml` parsed all GitHub workflow and issue-template YAML files successfully.
- GNU Make is not installed in this Windows environment, so the `make diagrams` wrapper was not run; the exact underlying `npm run diagrams` target was run directly.
- OpenAPI lint passed with four non-blocking style warnings (missing license declaration and 4xx responses on health/metrics probes).
- Phase 0 creates scaffold placeholders and CI workflows only; no application tests exist yet.

## Phase 0 handoff

Phase 0 is complete. Phase 1 is the next phase, but no Phase 1 implementation has been started in this task.
