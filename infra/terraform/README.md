# LandmarkNav Terraform Infrastructure

## Target Architecture

This directory defines the Phase 2 Google Cloud Platform (GCP) and Google Kubernetes Engine (GKE) target infrastructure for LandmarkNav, covering isolated `dev`, `stage`, and `prod` environments.

```
infra/terraform/
├── modules/
│   ├── network/            # VPC, subnet, secondary ranges (pods/services), Cloud Router/NAT, Private Service Connect/Peering
│   ├── iam/                # Least-privilege node SA, Workload Identity SAs for API and Vision, IAM roles
│   ├── artifact-registry/  # Private Docker repository with tag retention & untagged cleanup policies
│   ├── gke/                # Private GKE cluster, Datapath V2 network policies, system & workload node pools
│   ├── cloudsql-postgres/  # Private Cloud SQL PostgreSQL 16, HA/PITR backups, Secret Manager credentials
│   ├── redis/              # Private Memorystore Redis with auth and transit encryption
│   ├── storage/            # GCS buckets with uniform bucket-level access and retention policies
│   ├── secrets/            # Secret Manager definitions and Workload Identity IAM bindings
│   └── monitoring/         # Cloud Monitoring alert policies for GKE, Cloud SQL, and Redis
└── envs/
    ├── dev/                # Development environment (single-zone, ephemeral/cost-optimized)
    ├── stage/              # Staging environment (mirrors production with regional HA)
    └── prod/               # Production environment (regional HA, strict access control, PITR, 30-day backups)
```

## Remote State Bootstrap

Each environment maintains an isolated remote Terraform state bucket in GCS with object versioning enabled. To bootstrap state storage for an environment:

```bash
# Set environment (dev, stage, prod)
ENV="dev"
PROJECT_ID="landmarknav-${ENV}"
REGION="asia-south1"
BUCKET_NAME="landmarknav-${ENV}-tfstate"

# Create state bucket with uniform bucket-level access and versioning
gcloud storage buckets create gs://${BUCKET_NAME} \
  --project=${PROJECT_ID} \
  --location=${REGION} \
  --uniform-bucket-level-access

gcloud storage buckets update gs://${BUCKET_NAME} --versioning

# Enable required GCP APIs
gcloud services enable \
  compute.googleapis.com \
  container.googleapis.com \
  servicenetworking.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  --project=${PROJECT_ID}
```

Copy `envs/${ENV}/backend.tf.example` to `envs/${ENV}/backend.tf` and run:

```bash
cd infra/terraform/envs/${ENV}
terraform init
```

## State Recovery and Disaster Recovery

1. **State Versioning**: GCS bucket versioning preserves every state file mutation. To recover from corrupted state:
   ```bash
   gcloud storage objects list --versions gs://landmarknav-${ENV}-tfstate/terraform/state/default.tfstate
   gcloud storage objects copy gs://landmarknav-${ENV}-tfstate/terraform/state/default.tfstate#<GENERATION> gs://landmarknav-${ENV}-tfstate/terraform/state/default.tfstate
   ```
2. **State Locking**: GCS native state locking prevents concurrent modifications from conflicting CI runs or operators.
3. **Database Point-in-Time Recovery**: Cloud SQL automated backups and WAL archiving support restoration to any second within the retention window (`pitr_enabled = true`).

## Verification & Formatting

```bash
terraform fmt -check -recursive infra/terraform
```
