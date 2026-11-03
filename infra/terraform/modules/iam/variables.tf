variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, stage, prod)"
  type        = string
}

variable "k8s_namespace" {
  description = "Kubernetes namespace where workloads run"
  type        = string
  default     = "landmarks"
}
