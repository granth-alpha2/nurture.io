# 05 — Data model

## Data principles

Collect the minimum data needed for an active navigation task. Raw camera images and continuous video are not persisted by default. Location traces are sensitive; avoid retaining them beyond the active session unless a separately reviewed, consented purpose and retention schedule exists. Google-derived content is not eligible for persistent storage until its terms are verified.

## Logical entities

| Entity | Key fields | Retention and constraints |
|---|---|---|
| User/DeviceIdentity | pseudonymous ID, attestation status, created time | No direct identity required; rotate/revoke credentials |
| NavigationSession | ID, pseudonymous device ID, state, created/ended times, consent flags | Delete/expire after active period plus approved short operational window |
| Route | ID, session ID, destination reference, encoded geometry, provider/source, created time | Cache/storage only per provider terms; avoid indefinite route history |
| RouteStep | route ID, sequence, maneuver, text, distance, geometry | Session-bound; plain-language text validated |
| Landmark | internal ID, permitted source ID, point, geocell, license/source metadata | Persist only permitted fields; no presumed Google imagery content |
| ReferenceImage | ID, landmark ID, source/license, consent, quality metadata, object reference | Only license-compatible/operator-contributed image with consent; purge support |
| Embedding | reference ID, model/version, vector, created time | Persistent only if source/model license permits; versioned and deletable |
| LandmarkMatch | session, candidate ID, score, evidence refs, model version, timestamp | Short TTL; score is not probability; no raw frame |
| LocalizationEstimate | session ID, location/accuracy, heading, route progress, confidence state, timestamp | Ephemeral/minimal; retention must be approved |
| Instruction | session/step, text, evidence state, created time | Session-bound; must reference validated route evidence |
| Feedback | session ID, category, optional comment, created time | Pseudonymous; redact personal data; user deletion supported |

## Relationships

One NavigationSession has zero or more Routes (reroutes), each Route has ordered RouteSteps, and the session may yield transient LocalizationEstimates, LandmarkMatches, Instructions, and Feedback. A Landmark can have zero or more licence-eligible ReferenceImages and model-versioned Embeddings. There is no requirement to persist every sensor sample.

## PostgreSQL direction

- Enable PostGIS for geometry/geography operations and pgvector only when embedding source licensing is approved.
- Use UUID primary keys; UTC timestamps; explicit provider/source/license columns.
- Use spatial indexes (GiST) on permitted point/route geometry and HNSW/IVFFlat only after workload and extension support are validated.
- Scope session-owned records by pseudonymous session/device IDs; enforce deletion by session and retention job.
- Use database roles with least privilege; separate migration and runtime roles.
- Encrypt backups and restrict access; test restore procedures.

## Cache model

Potential Redis keys: candidate set by cell/heading bucket, route corridor prefetch, request idempotency, and short-lived match memoization. Every key needs a TTL, version, and invalidation path. Cache only content whose provider license permits caching; otherwise do not cache.

## Retention

Provisional default: no raw frame retention; transient localization and match records expire when the session ends or within a short TTL. Exact durations require privacy/legal review and are listed in `OPEN_QUESTIONS.md`. Backups must have bounded lifecycle and deletion caveats disclosed to users.

## Schema diagram

See `diagrams/src/erd.mmd`.
