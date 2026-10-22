# 10 — Runbook

## Status

There are no deployed services or on-call rotations in Phase 0. The actions below are the operational design to implement before deployment; do not treat them as already tested.

## Deployment and rollback (planned)

1. Confirm approved change, CI evidence, image provenance, migrations, and environment approval.
2. Review deployment diff/plan and current health/SLO status.
3. Deploy to dev, run smoke/contract checks, then stage; production requires an explicit approval.
4. Monitor error rate, latency, provider failures, cache behavior, and safety metrics.
5. Roll back application/image if health or safety guardrails regress. Database rollback is not assumed safe; use forward-compatible migrations and documented recovery.
6. Disable visual navigation remotely if false-match reports, calibration drift, or provider behavior creates safety concerns.

## Health and alerts

Planned alerts: API availability/error budget burn, p95 latency, database/Redis saturation, provider timeouts/quota, inference queue/latency, cache hit rate anomaly, cost budget, visual abstention/false-match reports, and missing evidence on instruction. Alert thresholds and dashboards are not yet provisioned.

Provisional service target: API availability 99.5%; localization p95 target must be set from a measured pilot. Define windows, exclusions, and user impact before launch.

## Incident response template

- Incident ID, severity, start/end, service/environment
- User and safety impact; geographic/feature scope
- Detection source and timeline
- Data potentially exposed or corrupted
- Containment (including visual feature kill switch)
- Recovery and verification
- Required user/regulatory/provider notifications, determined with counsel
- Root cause, contributing factors, corrective actions, owner and due date

## On-call and escalation

Assign an operational owner and safety escalation contact before production. Document provider support, cloud escalation, privacy/legal contacts, and out-of-hours coverage. These contacts are currently open questions.

## Backup and restore

Before production, document backup encryption/access, retention, restore roles, RPO/RTO, and conduct a clean restore exercise. A configured backup without a tested restore is not a verified recovery capability.
