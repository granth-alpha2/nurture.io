# ADR 0006: Evaluate ARCore Geospatial VPS before selecting visual localization

- Status: Deferred pending verification
- Date: 2026-10-22

## Context

The product brief requests an evaluation of Google's ARCore Geospatial API (VPS) as a possible primary visual-localization mechanism, with custom landmark matching as a complement or fallback. Coverage in India, supported devices, terms, and pricing have not been verified. This ADR must not imply the API is available or suitable for target routes.

## Evaluation record

| Dimension | Current finding | Evidence required |
|---|---|---|
| Coverage in India | Not verified; no coverage claim | Official coverage data and safe field checks in target cities |
| Device support | Not verified for intended device baseline | Current official device/API requirements and device tests |
| Licensing and data handling | Not verified | Current product terms, image/pose data processing, attribution, retention review |
| Pricing and quotas | Not verified | Current official pricing, quota limits, and pilot cost model |
| Pose suitability | Not tested | Measure localization quality and failure behavior against field ground truth |
| Safety suitability | Not approved | Calibrated false-confident-match and relocalization results across scenarios |

## Decision

Do not select or integrate ARCore Geospatial VPS yet. Keep a provider boundary and implement Phase 1 GPS-only navigation first. Revisit this ADR only after the evidence above is collected and reviewed; record the sources, access date, measured limitations, and resulting decision in this ADR.

## Consequences

- No dependency, product capability, or coverage is promised.
- The custom pipeline remains a possible complement/fallback, not a verified alternative.
- Visual localization stays feature-flagged until the independent ML and safety gate is met.
