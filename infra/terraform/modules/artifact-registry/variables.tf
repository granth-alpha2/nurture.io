variable "region" {
  description = "GCP region"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "keep_recent_versions" {
  description = "Number of recent tagged image versions to retain"
  type        = number
  default     = 10
}
