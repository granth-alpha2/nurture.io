terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

resource "google_redis_instance" "cache" {
  name           = "${var.environment}-landmarknav-redis"
  tier           = var.tier # BASIC or STANDARD_HA
  memory_size_gb = var.memory_size_gb
  region         = var.region

  authorized_network = var.network_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  redis_version = "REDIS_7_0"
  display_name  = "LandmarkNav Redis Cache (${var.environment})"

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    workload    = "landmarknav"
  }
}

# Store redis connection secret in Secret Manager
resource "google_secret_manager_secret" "redis_auth_secret" {
  secret_id = "${var.environment}-landmarknav-redis-auth"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "redis_auth_version" {
  secret      = google_secret_manager_secret.redis_auth_secret.id
  secret_data = google_redis_instance.cache.auth_string
}

resource "google_secret_manager_secret" "redis_url_secret" {
  secret_id = "${var.environment}-landmarknav-redis-url"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "redis_url_version" {
  secret      = google_secret_manager_secret.redis_url_secret.id
  secret_data = "rediss://default:${google_redis_instance.cache.auth_string}@${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
}
