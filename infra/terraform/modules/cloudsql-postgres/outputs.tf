output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.instance.name
}

output "instance_connection_name" {
  description = "Cloud SQL instance connection name (for Cloud SQL Auth Proxy)"
  value       = google_sql_database_instance.instance.connection_name
}

output "private_ip_address" {
  description = "Private IP address of the database"
  value       = google_sql_database_instance.instance.private_ip_address
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.database.name
}

output "database_user" {
  description = "Database user"
  value       = google_sql_user.user.name
}

output "db_password_secret_id" {
  description = "Secret Manager secret ID for database password"
  value       = google_secret_manager_secret.db_password_secret.secret_id
}

output "db_url_secret_id" {
  description = "Secret Manager secret ID for database URL"
  value       = google_secret_manager_secret.db_url_secret.secret_id
}
