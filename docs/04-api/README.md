# API contract

The planned API is REST under `/v1`, implemented with Fastify and schemas shared from OpenAPI/JSON Schema. The API is not yet implemented.

## Conventions

- JSON request/response bodies; validate all fields and reject unknown/invalid data.
- RFC 7807-style `application/problem+json` errors with `type`, `title`, `status`, `detail`, and `instance`; never expose stack traces or provider secrets.
- `X-Request-Id` is accepted or generated and returned. Include it in sanitized logs.
- Mutating/expensive requests accept `Idempotency-Key`; scope keys by device/session and expire them.
- Rate limits apply by device/session and endpoint; publish `429` with `Retry-After`.
- Explicit timeouts and bounded retry policy for upstream calls; no silent success-shaped fallback.
- Pagination uses opaque `cursor` and bounded `limit` for future list endpoints.
- Do not log raw camera frames, auth tokens, or unnecessary precise location.

## Error examples

| Status | Meaning |
|---|---|
| 400 | Invalid request/schema |
| 401/403 | Missing/invalid credential or unauthorized action |
| 404 | Resource not found |
| 409 | Idempotency or state conflict |
| 422 | Semantically invalid request |
| 429 | Rate/cost limit |
| 502/503/504 | Upstream unavailable, service unavailable, or timeout |

The normative endpoint sketch is [`openapi.yaml`](openapi.yaml). Provider-specific capabilities and licensing are unresolved; no live integration is implied.
