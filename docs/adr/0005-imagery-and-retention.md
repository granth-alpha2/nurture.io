# ADR 0005: No default persistence of camera imagery

- Status: Accepted
- Date: 2026-10-22

## Context

Camera content may contain faces, license plates, and sensitive context. Provider licensing for imagery and derived embeddings is not verified.

## Decision

Do not persist raw camera images by default. Prefer on-device processing and compact features. Any diagnostic capture requires separate explicit consent, purpose limitation, protections, and a short approved retention schedule. Do not persist embeddings derived from third-party imagery until license review approves it.

## Consequences

- Reduced privacy and licensing risk.
- ML debugging and evaluation require a consented, separately governed dataset.
- Deletion, face/plate handling, retention, and provider processing must be reviewed before enabling exceptions.
