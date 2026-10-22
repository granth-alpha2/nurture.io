# ADR 0002: PostgreSQL/PostGIS, pgvector, and Redis as target data platform

- Status: Accepted as target; extensions and data retention pending validation
- Date: 2026-10-22

## Context

The product needs geospatial route/session data, possible vector similarity, and short-lived caching/rate-limit state. Persisting source-derived vectors may be restricted by license.

## Decision

Target PostgreSQL with PostGIS for spatial data and pgvector for permitted embeddings; use Redis for TTL cache, rate limiting, and idempotency. Make persistent embedding use conditional on source and model license approval.

## Consequences

- Spatial queries and metadata can share a relational system.
- Extension availability, index choice, and cloud compatibility must be validated in the selected environment.
- Redis entries require explicit TTL, key versioning, and invalidation.
- This ADR does not authorize storing Google-derived material.
