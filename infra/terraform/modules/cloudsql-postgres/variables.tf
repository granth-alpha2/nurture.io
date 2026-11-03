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

variable "tier" {
  description = "Cloud SQL machine tier (e.g. db-custom-2-7680 or db-f1-micro)"
  type        = string
  default     = "db-custom-2-7680"
}

variable "availability_type" {
  description = "ZONAL or REGIONAL (HA)"
  type        = string
  default     = "REGIONAL"
}

variable "disk_size_gb" {
  description = "Initial disk size in GB"
  type        = number
  default     = 50
}

variable "pitr_enabled" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "retained_backups" {
  description = "Number of backups to retain"
  type        = number
  default     = 14
}

variable "database_name" {
  description = "Postgres database name"
  type        = string
  default     = "landmarknav"
}

variable "database_user" {
  description = "Postgres user name"
  type        = string
  default     = "landmarknav_app"
}

variable "deletion_protection" {
  description = "Prevent accidental destruction of database instance"
  type        = bool
  default     = true
}
