variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "landmarknav-dev"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-south1"
}

variable "environment" {
  description = "Environment identifier"
  type        = string
  default     = "dev"
}

variable "k8s_namespace" {
  description = "Workload Kubernetes namespace"
  type        = string
  default     = "landmarks"
}

variable "subnet_cidr" {
  description = "Subnet primary CIDR"
  type        = string
  default     = "10.10.0.0/20"
}

variable "pods_cidr" {
  description = "Subnet secondary CIDR for pods"
  type        = string
  default     = "10.20.0.0/16"
}

variable "services_cidr" {
  description = "Subnet secondary CIDR for services"
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

variable "master_ipv4_cidr_block" {
  description = "GKE master endpoint CIDR block"
  type        = string
  default     = "172.16.0.0/28"
}

variable "enable_private_endpoint" {
  description = "Disable public GKE master endpoint"
  type        = bool
  default     = false
}

variable "authorized_ipv4_cidr_blocks" {
  description = "Authorized CIDRs for master access"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "dev-allow-all"
    }
  ]
}

variable "alert_email" {
  description = "Alert notification email address"
  type        = string
  default     = ""
}
