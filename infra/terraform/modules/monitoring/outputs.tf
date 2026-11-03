output "gke_cpu_alert_policy_id" {
  description = "GKE CPU alert policy ID"
  value       = google_monitoring_alert_policy.gke_cpu_high.id
}

output "cloudsql_cpu_alert_policy_id" {
  description = "Cloud SQL CPU alert policy ID"
  value       = google_monitoring_alert_policy.cloudsql_cpu_high.id
}

output "redis_memory_alert_policy_id" {
  description = "Redis memory alert policy ID"
  value       = google_monitoring_alert_policy.redis_memory_high.id
}
