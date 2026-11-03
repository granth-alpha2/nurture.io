variable "environment" {
  description = "Deployment environment (dev, stage, prod)"
  type        = string
}

variable "region" {
  description = "GCP region (e.g. asia-south1)"
  type        = string
}

variable "subnet_cidr" {
  description = "Primary CIDR range for subnet"
  type        = string
  default     = "10.10.0.0/20"
}

variable "pods_cidr" {
  description = "Secondary CIDR range for GKE pods"
  type        = string
  default     = "10.20.0.0/16"
}

variable "services_cidr" {
  description = "Secondary CIDR range for GKE services"
  type        = string
  default     = "10.30.0.0/20"
}

variable "pods_range_name" {
  description = "Secondary range name for GKE pods"
  type        = string
  default     = "gke-pods"
}

variable "services_range_name" {
  description = "Secondary range name for GKE services"
  type        = string
  default     = "gke-services"
}
