terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

# Application JWT secret for API authentication/sessions
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${var.environment}-landmarknav-jwt-secret"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# External routing / maps provider API key
resource "google_secret_manager_secret" "maps_api_key" {
  secret_id = "${var.environment}-landmarknav-maps-api-key"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# External vision model provider API key
resource "google_secret_manager_secret" "vision_api_key" {
  secret_id = "${var.environment}-landmarknav-vision-api-key"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# IAM bindings for API service account
resource "google_secret_manager_secret_iam_member" "api_jwt_access" {
  secret_id = google_secret_manager_secret.jwt_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_workload_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "api_maps_access" {
  secret_id = google_secret_manager_secret.maps_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_workload_sa_email}"
}

# IAM bindings for Vision service account
resource "google_secret_manager_secret_iam_member" "vision_api_key_access" {
  secret_id = google_secret_manager_secret.vision_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.vision_workload_sa_email}"
}
