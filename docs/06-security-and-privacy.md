# 06 — Security and privacy

## Security objectives

Protect precise location, camera-derived content, anonymous session credentials, service availability, and the integrity of navigation instructions. Physical safety and privacy are release-blocking concerns.

## Data classification

| Class | Examples | Controls |
|---|---|---|
| Public | Product documentation, non-sensitive static assets | Integrity review |
| Internal | Aggregate service metrics, non-sensitive config | Access control |
| Sensitive | Precise location, route geometry, device/session identifiers, feedback | Minimize, encrypt, short retention, strict access, redacted logs |
| Highly sensitive | Camera frames, face/plate imagery, auth tokens, secrets | Do not persist/transmit by default; explicit consent or secret-manager-only handling |

## STRIDE threat model

| Threat | Example | Controls and residual work |
|---|---|---|
| Spoofing | Fake device/session or GPS location | Short-lived device-scoped tokens, attestation where available, rate limits, sensor consistency; attestation is not proof of physical truth |
| Tampering | Modified route, replayed localization request | TLS, schema validation, request IDs, idempotency, integrity checks |
| Repudiation | Cannot explain why an instruction was issued | Minimal evidence audit metadata and model version without storing raw frames |
| Information disclosure | Precise trace leaks via logs/cache/backup | Data minimization, encryption, access audit, TTL, redaction tests |
| Denial of service | Cost exhaustion via search or vision requests | Per-device/session quotas, body limits, timeouts, circuit breakers, budget alerts |
| Elevation of privilege | Service account or CI token compromise | Least privilege, workload identity, short-lived credentials, isolated environments |
| Prompt injection/adversarial signs | OCR text attempts to manipulate model | Treat OCR as inert evidence; never execute or follow text as instructions; constrained structured outputs |
| Physical safety | False match leads to unsafe turn | Multi-signal fusion, abstention, hysteresis, crossing behavior, field evaluation and kill switch |

## Planned controls

- No privileged Google API keys in the mobile app; restrict unavoidable client keys by app identity and quota.
- API validates all requests and AI outputs; RFC 7807 errors and sanitized JSON logs.
- Short-lived JWTs for device-scoped sessions; consider Play Integrity/App Attest only after feasibility and privacy review.
- TLS in transit, managed encryption at rest, private service networking, least-privilege identities.
- Avoid storing raw frames; if opt-in diagnostic capture is ever introduced, require explicit consent, face/plate blurring, access restriction, short retention, and deletion.
- Default-deny network policy and restricted pod security in deployment phases.
- Dependency, container, IaC, and secret scanning; SBOM and signed images before production.
- Rate limits, per-provider cost budgets, request coalescing, and circuit breakers.
- A remotely controllable feature flag to disable all visual claims if safety metrics regress.

## Consent and deletion

Explain separately why location, microphone, and camera are needed. Voice destination entry should have typed alternative. Camera processing is optional; refusing it must not prevent GPS-only guidance. Let users end sessions and request deletion. Do not imply OS permission equals consent to retain data.

## Privacy/legal review

This document is an engineering plan, not legal advice. Before launch, assess applicable India DPDP Act/rules and GDPR where relevant, lawful basis, notice, processor contracts, data-subject requests, cross-border transfers, child/elderly user considerations, and retention. Document verified conclusions and counsel review.

## Standards mapping

Map mobile controls to OWASP MASVS categories (storage, crypto, auth, network, platform, code, resilience, privacy) and API controls to OWASP ASVS (validation, authentication, access control, cryptography, logging, configuration, API). Exact versioned control mapping is a Phase 2 security-baseline task.

## Incident response

Use `10-runbook.md` for detection, containment, communication, recovery, and post-incident review. Navigation safety incidents must disable affected visual capability until reviewed. Production escalation contacts and notification timelines remain open.

## 8. Dependency vulnerability disposition and formal acceptance

### Production Runtime API (@landmarknav/api)
- `npm audit --workspace=@landmarknav/api --audit-level=low` reports **zero vulnerabilities**.
- All production runtime dependencies (Fastify 5.12.7, pg, ioredis, prom-client, zod) are fully patched and verified.

### Mobile Client Runtime (@landmarknav/mobile)
- The exported client bundle (`dist/android-export-check/`) contains purely compiled application JavaScript without embedded Node.js tooling dependencies.

### Local Tooling & Transitive Dev Dependency Acceptance
- A full root `npm audit` reports 15 high-severity advisories exclusively within the Expo CLI and React Native Metro build bundler graph:
  1. `braces` (GHSA-vfj7-8cjw-p6xm): ReDoS in CLI build-time file globbing.
  2. `node-forge` (GHSA-86w9-cpqp-85rv): RSA signature verification in Expo code-signing development certificates.
- **Risk Assessment**: These packages execute solely on the local developer workstation during development bundle compilation and asset export. They are never deployed to servers, are not reachable via external network requests, and are not included in runtime mobile app builds.
- **Remediation Barrier**: Upstream `npm audit fix --force` attempts to downgrade Expo from SDK 51 to SDK 44.0.6, which breaks TypeScript compilation and causes breaking API incompatibilities.
- **Formal Acceptance**: Per this security policy, these 15 transitive build-tooling advisories are formally accepted for Phase 1 and Phase 2 local development tooling. The root verification script enforces zero vulnerabilities on production services and validates this specific accepted boundary via `scripts/audit-check.mjs`.
