terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

# GKE Node Service Account (least privilege for VM nodes)
resource "google_service_account" "gke_node_sa" {
  account_id   = "${var.environment}-landmarknav-gke-node"
  display_name = "LandmarkNav GKE Node Service Account (${var.environment})"
  project      = var.project_id
}

resource "google_project_iam_member" "gke_node_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gke_node_sa.email}"
}

resource "google_project_iam_member" "gke_node_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gke_node_sa.email}"
}

resource "google_project_iam_member" "gke_node_monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.gke_node_sa.email}"
}

resource "google_project_iam_member" "gke_node_ar_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.gke_node_sa.email}"
}

# Workload Identity: API Service Account
resource "google_service_account" "api_workload_sa" {
  account_id   = "${var.environment}-landmarknav-api"
  display_name = "LandmarkNav API Workload Identity SA (${var.environment})"
  project      = var.project_id
}

resource "google_project_iam_member" "api_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api_workload_sa.email}"
}

resource "google_project_iam_member" "api_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api_workload_sa.email}"
}

resource "google_service_account_iam_member" "api_workload_identity_user" {
  service_account_id = google_service_account.api_workload_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/api-sa]"
}

# Workload Identity: Vision Service Account
resource "google_service_account" "vision_workload_sa" {
  account_id   = "${var.environment}-landmarknav-vision"
  display_name = "LandmarkNav Vision Workload Identity SA (${var.environment})"
  project      = var.project_id
}

resource "google_project_iam_member" "vision_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.vision_workload_sa.email}"
}

resource "google_service_account_iam_member" "vision_workload_identity_user" {
  service_account_id = google_service_account.vision_workload_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/vision-sa]"
}

# Workload Identity: Migration Job Service Account
resource "google_service_account" "migration_workload_sa" {
  account_id   = "${var.environment}-landmarknav-migrator"
  display_name = "LandmarkNav DB Migrator SA (${var.environment})"
  project      = var.project_id
}

resource "google_project_iam_member" "migrator_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.migration_workload_sa.email}"
}

resource "google_project_iam_member" "migrator_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.migration_workload_sa.email}"
}

resource "google_service_account_iam_member" "migrator_workload_identity_user" {
  service_account_id = google_service_account.migration_workload_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/migration-sa]"
}
