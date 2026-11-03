output "gke_node_sa_email" {
  description = "GKE Node Service Account Email"
  value       = google_service_account.gke_node_sa.email
}

output "api_workload_sa_email" {
  description = "API Workload Identity SA Email"
  value       = google_service_account.api_workload_sa.email
}

output "vision_workload_sa_email" {
  description = "Vision Workload Identity SA Email"
  value       = google_service_account.vision_workload_sa.email
}

output "migration_workload_sa_email" {
  description = "Migration Workload Identity SA Email"
  value       = google_service_account.migration_workload_sa.email
}
