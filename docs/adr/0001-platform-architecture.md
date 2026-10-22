# ADR 0001: Separate mobile, orchestration API, and vision service

- Status: Accepted for initial architecture; implementation pending
- Date: 2026-10-22

## Context

LandmarkNav combines mobile sensors and UI, map-provider orchestration, and computationally distinct vision/ML workloads. Provider capability, licensing, and availability are not yet verified.

## Decision

Use React Native/TypeScript/Expo for mobile, Node.js/TypeScript/Fastify for the `/v1` orchestration API, and Python 3.12/FastAPI for a provider-agnostic vision service. Use OpenAPI/JSON Schema contracts and validate all boundaries. Begin product delivery with GPS-only navigation.

## Consequences

- Mobile, API, and ML can evolve and scale independently.
- Cross-language contracts and generated-client drift require CI checks.
- A multi-service local environment adds operational complexity.
- No vision provider is selected by this ADR; it must pass licensing, privacy, safety, and measured quality review.
