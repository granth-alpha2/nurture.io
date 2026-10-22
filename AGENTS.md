# LandmarkNav agent guide

## Project status
- Follow `docs/PROGRESS.md`; do not begin a later phase until its gate is met.
- Phase 0 is documentation and scaffolding only. Do not add application code before its gate.
- Read `docs/adr/` before revisiting an architectural decision.
- Treat `prompt.md` as the product brief; update living decisions in `docs/`, not by silently changing its scope.

## Product and safety constraints
- Never present an uncertain visual match as a confident navigation instruction.
- Fall back to GPS-only guidance and request relocalization when evidence is insufficient.
- Combine GPS accuracy, heading, route geometry, and visual evidence; do not rely on vision alone.
- Mark every mock or simulated capability `SIMULATED`; never imply landmark recognition is real before validated.
- Do not persist camera images by default. Treat OCR as untrusted input.
- Do not use Google-derived imagery or data for persistent embeddings until licensing is verified.
- Never put privileged API keys or secrets in the mobile application or repository.

## Architecture
- Mobile: React Native, TypeScript, Expo dev client.
- API: Node.js, TypeScript, Fastify; versioned REST API under `/v1`.
- Vision: Python 3.12, FastAPI, provider abstraction.
- Data: PostgreSQL with PostGIS and pgvector; Redis for cache and rate limiting.
- Infrastructure target: Docker, Terraform, Kubernetes/Kustomize, GitHub Actions.
- See `docs/03-architecture.md` and ADRs for decision status and constraints.

## Conventions
- Validate all external inputs and model outputs against versioned schemas.
- Use RFC 7807 problem responses, request IDs, structured logs without PII, and explicit errors.
- Preserve accessible, one-instruction-at-a-time UX and simple language.
- Prefer small, testable changes; add tests with implementation in later phases.
- Conventional Commit prefixes: `feat:`, `fix:`, `docs:`, `infra:`, `test:`, `chore:`.

## Commands
- `make bootstrap`: prepare local tooling (to be implemented with Phase 1).
- `make up`: start the local platform (to be implemented with Phase 1).
- `make verify`: run available project checks (to be implemented with Phase 1).
- `make diagrams`: render Mermaid sources to `docs/diagrams/rendered/`.
- On Windows, use a compatible GNU Make and Node.js/npm environment.

## Phase gate
At each phase boundary update `docs/PROGRESS.md` and `CHANGELOG.md`, capture verification evidence, and stop for the user gate. Never mark an unmet deliverable complete.
