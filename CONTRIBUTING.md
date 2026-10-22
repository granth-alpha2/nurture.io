# Contributing

## Before making changes

1. Read `AGENTS.md`, `docs/PROGRESS.md`, and relevant ADRs.
2. Check the current phase and its Definition of Done. Do not cross a phase gate without user approval.
3. Keep changes scoped to the active phase and update directly related documentation.

## Documentation and diagrams

Edit Mermaid sources under `docs/diagrams/src/`. Run `npm ci` once to install the pinned renderer, then `make diagrams` to regenerate SVGs in `docs/diagrams/rendered/`. Do not hand-edit generated output. Record unknown licensing, pricing, coverage, and operational facts in `docs/OPEN_QUESTIONS.md`.

## Quality

Use Conventional Commit prefixes (`docs:`, `feat:`, `fix:`, `infra:`, `test:`, `chore:`). Do not commit secrets, raw personal images, or unlicensed reference imagery. Mark all mocked capabilities as `SIMULATED`.

## Current phase

Phase 0 has no application build or test command yet. The planned `make bootstrap`, `make up`, and `make verify` commands are Phase 1 deliverables.
