# ADR 0004: Gate visual instructions on multi-signal evidence

- Status: Accepted
- Date: 2026-10-22

## Context

Incorrect navigation instructions can cause physical harm. Image matching alone is insufficient, and confidence scores may be uncalibrated.

## Decision

Fuse GPS accuracy, heading, route geometry, and validated visual evidence; apply hysteresis/dwell; abstain on uncertainty or disagreement and fall back to GPS-only guidance/relocalization. Keep visual instructions feature-flagged until labelled evaluation and field tests meet a documented false-confident-match target. Never confirm arrival from proximity alone.

## Consequences

- The initial usable product can ship GPS-only before ML is validated.
- Visual coverage may be limited; truthful fallback is preferred over unsupported claims.
- A release threshold, calibration method, and kill switch verification are mandatory open work.
