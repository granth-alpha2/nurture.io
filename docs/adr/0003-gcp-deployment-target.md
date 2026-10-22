# ADR 0003: GCP as the provisional production deployment target

- Status: Proposed; region and provider terms unresolved
- Date: 2026-10-22

## Context

The product brief recommends GKE because Google Maps Platform is contemplated and India is an initial target market. Production requirements and costs are unknown.

## Decision

Use GCP as the provisional infrastructure target with Terraform, private GKE, Cloud SQL, Memorystore, Artifact Registry, Secret Manager, and Cloud Monitoring. No resources are provisioned by this ADR. Region selection remains open pending residency, availability, latency, and pricing review.

## Consequences

- Managed integrations may reduce operational burden.
- Cloud portability is preserved through containerized workloads and Kubernetes manifests where practical.
- GCP-specific dependencies and costs remain; validate before production.
- Do not infer Maps data storage permissions from cloud-provider choice.
