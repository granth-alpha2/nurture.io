variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "alert_email" {
  description = "Email address for ops alert notifications (optional)"
  type        = string
  default     = ""
}
