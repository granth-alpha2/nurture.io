terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

resource "google_monitoring_notification_channel" "email" {
  count        = var.alert_email != "" ? 1 : 0
  display_name = "LandmarkNav Ops Alert Email (${var.environment})"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

# Alert 1: GKE Workload CPU High
resource "google_monitoring_alert_policy" "gke_cpu_high" {
  display_name = "${var.environment}-landmarknav-gke-cpu-high"
  combiner     = "OR"

  conditions {
    display_name = "GKE Container CPU utilization > 85%"
    condition_threshold {
      filter          = "resource.type = \"k8s_container\" AND metric.type = \"kubernetes.io/container/cpu/limit_utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.alert_email != "" ? [google_monitoring_notification_channel.email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert 2: GKE Workload Memory High
resource "google_monitoring_alert_policy" "gke_memory_high" {
  display_name = "${var.environment}-landmarknav-gke-memory-high"
  combiner     = "OR"

  conditions {
    display_name = "GKE Container Memory utilization > 85%"
    condition_threshold {
      filter          = "resource.type = \"k8s_container\" AND metric.type = \"kubernetes.io/container/memory/limit_utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.alert_email != "" ? [google_monitoring_notification_channel.email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert 3: Cloud SQL CPU High
resource "google_monitoring_alert_policy" "cloudsql_cpu_high" {
  display_name = "${var.environment}-landmarknav-cloudsql-cpu-high"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL CPU utilization > 80%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.80
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.alert_email != "" ? [google_monitoring_notification_channel.email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert 4: Cloud SQL Disk Utilization High
resource "google_monitoring_alert_policy" "cloudsql_disk_high" {
  display_name = "${var.environment}-landmarknav-cloudsql-disk-high"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL Disk utilization > 85%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/disk/utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.alert_email != "" ? [google_monitoring_notification_channel.email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert 5: Redis Memory High
resource "google_monitoring_alert_policy" "redis_memory_high" {
  display_name = "${var.environment}-landmarknav-redis-memory-high"
  combiner     = "OR"

  conditions {
    display_name = "Memorystore Redis Memory utilization > 80%"
    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.80
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.alert_email != "" ? [google_monitoring_notification_channel.email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}
