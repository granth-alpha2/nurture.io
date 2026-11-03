# API contract

[`openapi.yaml`](openapi.yaml) documents the implemented local Phase 1 API, not a production service. The API uses Fastify and strict Zod request schemas. It generates or accepts `X-Request-Id`, returns RFC 7807-style problem responses, and supports idempotency keys for route/session/feedback creation. Rate limiting and idempotency are currently process-local.

Authentication is not implemented. Keep the service loopback-bound and never expose it publicly. `/healthz`, `/readyz`, and `/metrics` are local operational endpoints.

The place provider and route generator return only synthetic fixtures marked `SIMULATED`; walking paths are straight lines and not safe real-world guidance. The localization endpoint uses GPS/route evidence only and returns `GPS_ONLY` estimates or abstains when uncertain. No camera frames are accepted or processed. Provider integrations, data terms, and real pedestrian routing are unresolved.
