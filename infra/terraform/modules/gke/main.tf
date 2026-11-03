terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

resource "google_container_cluster" "primary" {
  name     = "${var.environment}-landmarknav-gke"
  location = var.region

  # We use a custom node pool, so remove default pool immediately
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = var.network_id
  subnetwork = var.subnet_id

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = var.enable_private_endpoint
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.authorized_ipv4_cidr_blocks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  datapath_provider = "ADVANCED_DATAPATH" # Google Datapath V2 / eBPF Network Policies

  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    gcs_fuse_csi_driver_config {
      enabled = true
    }
  }

  release_channel {
    channel = var.release_channel
  }

  maintenance_policy {
    recurring_window {
      start_time = "2026-01-01T00:00:00Z"
      end_time   = "2026-01-01T04:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SA,SU"
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "STORAGE", "POD", "CONTAINER"]
    managed_prometheus {
      enabled = true
    }
  }

  resource_labels = {
    environment = var.environment
    managed_by  = "terraform"
    project     = "landmarknav"
  }

  lifecycle {
    ignore_changes = [
      initial_node_count,
    ]
  }
}

# System node pool for core GKE controllers, ingress, cert-manager
resource "google_container_node_pool" "system_nodes" {
  name       = "system-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = var.system_node_count

  autoscaling {
    min_node_count = var.system_min_nodes
    max_node_count = var.system_max_nodes
  }

  node_config {
    machine_type    = var.system_machine_type
    service_account = var.node_service_account_email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    labels = {
      "landmarknav.io/role" = "system"
      "environment"         = var.environment
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }

    tags = ["landmarknav-gke-node", var.environment]
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# Workload node pool for API and Vision services
resource "google_container_node_pool" "workload_nodes" {
  name     = "workload-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name

  autoscaling {
    min_node_count = var.workload_min_nodes
    max_node_count = var.workload_max_nodes
  }

  node_config {
    machine_type    = var.workload_machine_type
    service_account = var.node_service_account_email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    labels = {
      "landmarknav.io/role" = "workload"
      "environment"         = var.environment
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }

    tags = ["landmarknav-gke-workload", var.environment]
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}
