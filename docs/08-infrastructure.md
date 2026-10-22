# 08 — Infrastructure

## Target topology

The target production topology is a private GKE cluster in an India region after residency/availability/cost review. Internet ingress terminates TLS at a managed ingress/load balancer with WAF controls. API and vision workloads run in restricted namespaces and reach private Cloud SQL and Memorystore. Artifact Registry, Secret Manager, Cloud Storage, Cloud Monitoring, and budget alerts support operations. This is a target design, not provisioned infrastructure.

## Terraform module map

`network`, `iam`, `artifact-registry`, `gke`, `cloudsql-postgres`, `redis`, `storage`, `secrets`, `monitoring`. Environments are `dev`, `stage`, and `prod`, with separate state and least-privilege identities. Remote GCS state and locking are expected; state bucket bootstrap and recovery must be documented.

## Kubernetes

Use Kustomize base and environment overlays. Enforce default-deny network policies, restricted pod security, workload-specific service accounts, resource requests/limits, probes, rolling upgrades, PDBs, HPAs, and TLS ingress. External Secrets syncs from a cloud secret manager. Run migrations as one locked Job before compatible rollout; never run migrations concurrently in every API pod.

## CI/CD

Planned checks: format/lint, typecheck, unit, build, integration/contract, SAST/dependency/secret/container/IaC scans, SBOM. Publish immutable images with provenance/signatures. Auto-deploy to dev after checks; stage/prod require approval and rollback criteria. Deploy pipelines must use short-lived workload credentials and protected environments.

## Network and environments

Dev/stage/prod are isolated; private database/cache endpoints only; outbound egress is restricted to required external APIs and telemetry. No production user data in dev. Use separate keys, budgets, secrets, and state per environment. Do not hard-code credentials or default to permissive public ingress.

## Cost, reliability and disaster recovery

No credible monetary estimate is possible before region, traffic, provider pricing, retention, GPU demand, and SLO are selected. Model cost by API calls/session, inference volume, database/cache sizing, egress, and logs. Use budgets and quota alarms from the start. Production target includes Cloud SQL HA/PITR and tested backup restore; RPO/RTO must be agreed and tested before launch. Avoid claiming DR readiness before an exercise.

## Local developer platform

Phase 1 is expected to provide Docker Compose for API, vision, PostGIS/pgvector, Redis, and observability. Any mock map/vision profile must be explicitly `SIMULATED`. Current Phase 0 has no service images or Compose stack.
