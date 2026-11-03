# Kubernetes Manifests and GitOps Architecture

This directory contains the Kubernetes manifests for LandmarkNav, structured for Kustomize and GitOps deployment with ArgoCD.

## Directory Structure

```
infra/k8s/
├── base/
│   ├── namespace.yaml                  # Target namespace with restricted Pod Security Standards
│   ├── api/                            # API Deployment, Service, HPA, PDB, ServiceAccount
│   ├── vision/                         # Vision Deployment, Service, HPA, PDB, ServiceAccount
│   ├── migrations/                     # One-off locked DB migration Job
│   ├── networkpolicies/                # Default-deny, DNS, Ingress, inter-service & egress policies
│   ├── ingress/                        # Google Cloud Managed Certificate & Cloud Armor ingress
│   ├── external-secrets/               # SecretStore (Workload Identity) & ExternalSecrets
│   └── kustomization.yaml              # Base composition
├── overlays/
│   ├── dev/                            # Development environment overlay
│   ├── stage/                          # Staging environment overlay
│   └── prod/                           # Production environment overlay
└── argocd/
    ├── application-dev.yaml            # ArgoCD Application for dev
    ├── application-stage.yaml          # ArgoCD Application for stage
    └── application-prod.yaml           # ArgoCD Application for prod
```

## Security Baseline

1. **Pod Security Standards**: Enforces the `restricted` profile (`runAsNonRoot`, non-root UID 10001, `readOnlyRootFilesystem`, dropped capabilities `ALL`, `RuntimeDefault` seccomp profile).
2. **Network Policies**: Default deny-all ingress and egress. Explicit whitelist for:
   - DNS lookup (`kube-dns` on port 53)
   - API ingress from ingress controller (port 3000)
   - API egress to Vision service (port 8000)
   - API egress to private Cloud SQL (5432) and Memorystore Redis (6379)
   - Vision service HTTPS egress (443) to external model providers
3. **Database Migrations**: Executed as a Kubernetes `Job` with `activeDeadlineSeconds` prior to application pod rollouts; never run concurrently inside application containers.
4. **Secret Management**: External Secrets Operator synchronizes credentials directly from GCP Secret Manager into Kubernetes secrets using Workload Identity.

## Validation Commands

To inspect and validate manifests locally:

```bash
# Validate base manifests
kubectl kustomize infra/k8s/base

# Validate overlays
kubectl kustomize infra/k8s/overlays/dev
kubectl kustomize infra/k8s/overlays/stage
kubectl kustomize infra/k8s/overlays/prod
```
