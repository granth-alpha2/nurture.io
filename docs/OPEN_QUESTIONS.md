# Open questions

Do not guess answers to these questions or make implementation decisions that depend on them without recording evidence and an owner.

| ID | Question | Why it matters | Owner / evidence needed |
|---|---|---|---|
| OQ-01 | What current Google Maps Platform terms govern each planned API, especially caching, imagery, embeddings, display and attribution? | Licensing and data model | Legal review with dated source links |
| OQ-02 | Is ARCore Geospatial/VPS coverage, device support, pricing and licensing adequate for target Indian cities? | Localization design | Verify official docs and representative field coverage |
| OQ-03 | Which vision and OCR providers are acceptable for privacy, retention, latency, cost, and regional availability? | Provider abstraction and consent | Provider contracts and measured prototype |
| OQ-04 | What licence-compatible reference imagery source will be used? | Persistent embeddings | Terms and provenance review |
| OQ-05 | What false-confident-match ceiling and confidence calibration method are release blockers? | Physical safety | Safety/field-test owner decision and labelled data |
| OQ-06 | What exact retention durations apply to location, routes, match metadata, feedback, and backups? | Privacy and deletion | Privacy/legal review |
| OQ-07 | What are launch regions, data residency requirements, and cross-border processing constraints? | Infrastructure/compliance | Product and legal decision |
| OQ-08 | What are the expected users, traffic, device baseline, provider budget, and SLO measurement window? | Capacity/cost | Product forecast and pilot measurements |
| OQ-09 | Which India-focused route provider and fallback behavior satisfy pedestrian, accessibility, and restricted-area needs? | Route safety | Provider evaluation and field test |
| OQ-10 | What authentication/attestation approach is viable without excluding supported users/devices? | Abuse prevention | Threat model and platform feasibility |
| OQ-11 | What RPO/RTO and operational response coverage are required before production? | DR/runbook | Product and SRE decision |
| OQ-12 | What languages beyond English/Hindi and which TTS voices/devices must be supported at launch? | Accessibility/localization | User research and platform verification |
| OQ-13 | Who owns safety escalation, privacy requests, and vulnerability response? | Production readiness | Named project owners and channels |
| OQ-14 | What destination entrance/arrival signals are legally and technically available without false arrival claims? | Arrival safety | Provider capability review and usability test |

These questions are open as of Phase 0; no external prices, service coverage, or licensing assertions have been verified.
