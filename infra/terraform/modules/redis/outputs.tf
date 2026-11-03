output "host" {
  description = "Redis host IP"
  value       = google_redis_instance.cache.host
}

output "port" {
  description = "Redis port"
  value       = google_redis_instance.cache.port
}

output "redis_auth_secret_id" {
  description = "Secret Manager secret ID for Redis auth"
  value       = google_secret_manager_secret.redis_auth_secret.secret_id
}

output "redis_url_secret_id" {
  description = "Secret Manager secret ID for Redis connection URL"
  value       = google_secret_manager_secret.redis_url_secret.secret_id
}
