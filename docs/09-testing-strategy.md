# 09 — Testing strategy

## Test pyramid

| Level | Focus | Release evidence |
|---|---|---|
| Unit | Geo math, route progress, fusion, hysteresis, schema validation, privacy utilities | ≥80% target for domain/geo/fusion before visual release |
| Contract | OpenAPI/schema compatibility between mobile, API, vision | CI validation of request, response, and error contracts |
| Integration | API with PostgreSQL/PostGIS, Redis, provider adapters | Isolated test containers and deterministic fixtures |
| End-to-end | Onboarding, destination, route, TTS state, pause/end, GPS mock | Maestro/Detox scripted scenarios |
| Load/resilience | API and inference latency, limits, outages, retries | k6 plus dependency failure tests |
| Field/ML | Real-world navigation and labelled landmark evaluation | Consent, representative conditions, safety review |
| IaC/deployment | Terraform, Kubernetes schemas/policies, rollback | Clean-environment plan/deploy and restore evidence |

## Safety scenario matrix

| Scenario | Expected behavior |
|---|---|
| GPS drift, stale fix, urban canyon, GPS loss | Raise uncertainty; do not flicker; use route-aware fallback or relocalize |
| Wrong turn/U-turn | Require persistent reliable deviation; reroute or clearly report degraded state |
| Poor lighting, blur, occlusion, duplicate-looking buildings | Abstain from visual claim |
| Sign text with hostile/instruction-like content | Treat as inert OCR evidence |
| Network timeout, quota exceeded, provider outage | Surface explicit error; GPS-only fallback where possible |
| Permission denied/revoked mid-session | Stop affected processing; keep alternatives; explain state |
| Battery saver/interrupted app | Reduce sampling safely; restore or terminate session explicitly |
| Near crossing | Audio-only concise guidance; no prompt to stare at screen |
| Near destination but wrong entrance | Do not declare arrival from proximity alone |
| Redis/database unavailable | Health state reflects dependency; no success-shaped fake answer |

## ML dataset and metrics

Use a consented, labelled dataset with capture location/session-separated splits and conditions across lighting, crowds, weather, occlusion, similar-looking landmarks, and device quality. Do not commit raw personal imagery. Report precision/recall, coverage, false-confident-match rate, calibration/ECE, and subgroup/condition breakdowns. A safety owner must set an acceptable false-match ceiling before visual release; none is asserted in this plan.

## Field-test protocol

Obtain informed consent; recruit varied users including older adults; use safe familiar routes and an observer; never require participants to look at a screen while crossing. Record task outcomes, wrong turns, time, help requests, comprehension, accessibility feedback, device/network conditions, and any safety event. Use pseudonymous IDs and minimum necessary location. Stop tests on unsafe guidance or distress; report incidents and update the product gate.

## Exit criteria

No unresolved critical/high safety defects; all mandatory scenarios pass; schema and fallback contracts tested; privacy/accessibility review complete; evidence and limitations documented. Visual instructions additionally require calibrated field evaluation and a verified kill switch.
