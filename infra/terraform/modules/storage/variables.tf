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

variable "force_destroy" {
  description = "Allow deletion of bucket with objects"
  type        = bool
  default     = false
}
