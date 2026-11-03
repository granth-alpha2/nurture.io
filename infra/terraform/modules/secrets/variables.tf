variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "api_workload_sa_email" {
  description = "API workload service account email"
  type        = string
}

variable "vision_workload_sa_email" {
  description = "Vision workload service account email"
  type        = string
}
