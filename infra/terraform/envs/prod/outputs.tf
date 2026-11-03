output "cluster_name" {
  description = "GKE cluster name"
  value       = module.gke.cluster_name
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = module.gke.cluster_endpoint
}

output "artifact_registry_url" {
  description = "Artifact registry docker endpoint"
  value       = module.artifact_registry.repository_url
}

output "cloudsql_instance" {
  description = "Cloud SQL instance name"
  value       = module.cloudsql.instance_name
}

output "redis_host" {
  description = "Redis host IP"
  value       = module.redis.host
}

output "storage_bucket" {
  description = "Storage bucket name"
  value       = module.storage.bucket_name
}
