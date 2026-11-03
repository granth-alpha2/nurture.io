output "repository_id" {
  description = "Artifact Registry repository ID"
  value       = google_artifact_registry_repository.docker_repo.repository_id
}

output "repository_name" {
  description = "Artifact Registry repository full resource name"
  value       = google_artifact_registry_repository.docker_repo.name
}

output "repository_url" {
  description = "Artifact Registry Docker endpoint URL"
  value       = "${var.region}-docker.pkg.dev/${google_artifact_registry_repository.docker_repo.project}/${google_artifact_registry_repository.docker_repo.repository_id}"
}
