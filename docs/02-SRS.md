# 02 — Software requirements specification

## Functional requirements

| ID | Requirement | Verification |
|---|---|---|
| FR-001 | The client shall explain location, microphone, and camera permission purposes before requesting each permission. | Mobile onboarding test |
| FR-002 | The system shall accept text destination search and support voice input where available. | API/mobile contract and UI test |
| FR-003 | The client shall require explicit destination confirmation before route creation. | Mobile state test |
| FR-004 | The API shall return a walking route with ordered, simplified steps and route geometry. | API contract/integration test |
| FR-005 | Active navigation shall present one current instruction and an accessible Repeat action. | Mobile UI/accessibility test |
| FR-006 | The system shall withhold confident visual instructions when evidence is low-confidence or inconsistent. | Fusion unit/scenario test |
| FR-007 | The system shall use GPS-only guidance or request relocalization when visual evidence is insufficient. | Scenario test |
| FR-008 | The system shall apply hysteresis and minimum dwell time to candidate/instruction changes. | Domain unit test |
| FR-009 | The system shall detect persistent route deviation and request a reroute without reacting to a single noisy fix. | Geo/fusion test |
| FR-010 | Proximity alone shall not confirm arrival. | Arrival scenario test |
| FR-011 | The system shall support pause, end, and user-requested deletion of navigation-session data. | API/mobile integration test |
| FR-012 | All external requests and vision outputs shall be schema-validated before use. | Contract tests/fuzz tests |
| FR-013 | The service shall expose liveness/readiness health endpoints and request correlation IDs. | API integration test |
| FR-014 | The system shall expose privacy and accessibility preferences for language, text size, speech, and camera processing. | Mobile UI/accessibility test |
| FR-015 | OCR content shall be treated as untrusted evidence and never interpreted as system instructions. | Vision security test |
| FR-016 | The system shall label any mocked capability as `SIMULATED` in applicable UI, code, and documentation. | Review/check |

## Non-functional requirements

| ID | Requirement | Verification |
|---|---|---|
| NFR-001 | Domain/geo/fusion logic shall target at least 80% unit-test coverage before visual navigation release. | Coverage report |
| NFR-002 | Navigation UI shall support screen readers, scalable text, high contrast, reduced motion, and minimum 48dp targets. | Accessibility audit |
| NFR-003 | Raw camera images shall not be persisted by default; any exception requires explicit consent and approved retention. | Data-flow review/test |
| NFR-004 | Logs and metrics shall exclude raw imagery, direct identifiers, and unnecessary precise location. | Automated redaction tests/review |
| NFR-005 | External calls shall have bounded timeouts, explicit errors, and controlled retries with jitter where safe. | Resilience tests |
| NFR-006 | The target API availability SLO is provisionally 99.5% after deployment; measurement window and exclusions must be documented before launch. | SLO dashboard |
| NFR-007 | The p95 localization latency target shall be established from pilot measurements before production; no unsupported target is assumed. | Load test |
| NFR-008 | Instructions shall remain stable under noisy input through hysteresis and dwell time. | Deterministic simulation |
| NFR-009 | Services shall be horizontally scalable and avoid per-request model loading. | Load/architecture test |
| NFR-010 | All generated and stored contracts shall be versioned and backward compatibility reviewed. | Contract compatibility check |
| NFR-011 | The platform shall provide an offline/degraded GPS route mode where cached route data is legally and technically permissible. | Offline scenario test |
| NFR-012 | Dependencies, container images, and IaC shall be scanned before deployment; secrets must not be committed. | CI security checks |

## Traceability

| Requirement group | Planned test coverage |
|---|---|
| FR-001, FR-014; NFR-002 | Mobile unit, UI automation, TalkBack/VoiceOver audit |
| FR-002–005, FR-011, FR-013 | API contract/integration and mobile end-to-end |
| FR-006–010, FR-015; NFR-001, NFR-008 | Fusion/geo unit tests, scenario matrix, labelled field evaluation |
| FR-012; NFR-005, NFR-010 | Schema contract, malformed-output, timeout and compatibility tests |
| FR-016; NFR-003, NFR-004, NFR-012 | CI policy, privacy review, logging redaction, secret and image scans |
| NFR-006, NFR-007, NFR-009, NFR-011 | Load, failure-injection, offline and observability tests |

Tests are planned, not yet implemented. Thresholds not specified above are intentionally open until measurement or policy review.
