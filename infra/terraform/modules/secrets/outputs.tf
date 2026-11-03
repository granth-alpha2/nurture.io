output "jwt_secret_id" {
  description = "Secret ID for JWT secret"
  value       = google_secret_manager_secret.jwt_secret.secret_id
}

output "maps_api_key_secret_id" {
  description = "Secret ID for maps API key"
  value       = google_secret_manager_secret.maps_api_key.secret_id
}

output "vision_api_key_secret_id" {
  description = "Secret ID for vision API key"
  value       = google_secret_manager_secret.vision_api_key.secret_id
}
