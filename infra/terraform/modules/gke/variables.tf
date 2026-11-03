variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "network_id" {
  description = "VPC network ID"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID"
  type        = string
}

variable "pods_range_name" {
  description = "Secondary range name for pods"
  type        = string
}

variable "services_range_name" {
  description = "Secondary range name for services"
  type        = string
}

variable "master_ipv4_cidr_block" {
  description = "CIDR block for GKE master endpoint"
  type        = string
  default     = "172.16.0.0/28"
}

variable "enable_private_endpoint" {
  description = "Whether the cluster master endpoint is completely internal"
  type        = bool
  default     = false
}

variable "authorized_ipv4_cidr_blocks" {
  description = "External CIDRs authorized to reach cluster master"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

variable "release_channel" {
  description = "GKE release channel (RAPID, REGULAR, STABLE)"
  type        = string
  default     = "REGULAR"
}

variable "node_service_account_email" {
  description = "Service account email for GKE worker nodes"
  type        = string
}

variable "system_node_count" {
  description = "Initial system node count"
  type        = number
  default     = 1
}

variable "system_min_nodes" {
  description = "Min system nodes"
  type        = number
  default     = 1
}

variable "system_max_nodes" {
  description = "Max system nodes"
  type        = number
  default     = 3
}

variable "system_machine_type" {
  description = "Machine type for system nodes"
  type        = string
  default     = "e2-standard-2"
}

variable "workload_min_nodes" {
  description = "Min workload nodes"
  type        = number
  default     = 1
}

variable "workload_max_nodes" {
  description = "Max workload nodes"
  type        = number
  default     = 5
}

variable "workload_machine_type" {
  description = "Machine type for workload nodes"
  type        = string
  default     = "e2-standard-4"
}
