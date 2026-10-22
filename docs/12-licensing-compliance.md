# 12 — Licensing and compliance

## Important status

No provider terms have been independently verified for this project. This plan is not legal advice. **Do not persist Google-derived photos, Street View imagery, place data, routes, or derived embeddings until current terms and the proposed use are reviewed and recorded.** Provider behavior and terms can change.

## Google Maps Platform review gate

Before integration or storage, verify current product-specific terms for Places, Routes, Maps, Street View, attribution, caching, retention, display restrictions, derived data/embeddings, and use with third-party models. Document exact source URL, access date, product/API, allowed fields, TTL, attribution wording, and legal reviewer. Do not infer permission from API access or public visibility.

Until approved:
- Treat Google response data as transient.
- Do not create persistent embeddings from Google imagery.
- Do not cache route/place/photo content unless expressly permitted.
- Keep all Maps-required attribution visible when applicable.

## Alternative image sources

Evaluate Mapillary, open street-level datasets, operator-owned images, or user-contributed images only after reviewing commercial-use, derivative-work, attribution, redistribution, privacy, and retention terms. Maintain per-asset provenance and license metadata. A user contribution requires clear consent and deletion rights.

## Third-party software and supply chain

Pin dependencies where practical; maintain a software bill of materials (SBOM); scan dependencies and images; review transitive license obligations; preserve notices and source-offer requirements. Store model weights and datasets only where their license permits. Record artifacts, versions, checksums, and approvals.

## Privacy compliance

Before public release, review India DPDP requirements and GDPR applicability, notices, lawful basis, data-subject rights, processor/subprocessor contracts, cross-border transfers, breach procedures, and retention. Provide clear safety disclaimer and privacy notice. Confirm age-related and accessibility obligations with counsel.

## Audit record template

| Field | Value |
|---|---|
| Provider/product/version | Pending verification |
| Terms and policy URLs | Pending verification |
| Review date/reviewer | Pending |
| Data fields and purposes | Pending |
| Storage/cache/embedding permission | Pending |
| Retention and deletion | Pending |
| Attribution/display requirements | Pending |
| Region and subprocessors | Pending |
| Approval / restrictions | Do not implement persistence until approved |
