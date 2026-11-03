terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "network" {
  source              = "../../modules/network"
  environment         = var.environment
  region              = var.region
  subnet_cidr         = var.subnet_cidr
  pods_cidr           = var.pods_cidr
  services_cidr       = var.services_cidr
  pods_range_name     = var.pods_range_name
  services_range_name = var.services_range_name
}

module "iam" {
  source        = "../../modules/iam"
  project_id    = var.project_id
  environment   = var.environment
  k8s_namespace = var.k8s_namespace
}

module "artifact_registry" {
  source               = "../../modules/artifact-registry"
  region               = var.region
  environment          = var.environment
  keep_recent_versions = 30
}

module "gke" {
  source                      = "../../modules/gke"
  project_id                  = var.project_id
  environment                 = var.environment
  region                      = var.region
  network_id                  = module.network.network_id
  subnet_id                   = module.network.subnet_id
  pods_range_name             = module.network.pods_range_name
  services_range_name         = module.network.services_range_name
  master_ipv4_cidr_block      = var.master_ipv4_cidr_block
  enable_private_endpoint     = var.enable_private_endpoint
  authorized_ipv4_cidr_blocks = var.authorized_ipv4_cidr_blocks
  release_channel             = "STABLE"
  node_service_account_email  = module.iam.gke_node_sa_email

  system_node_count   = 3
  system_min_nodes    = 3
  system_max_nodes    = 5
  system_machine_type = "e2-standard-4"

  workload_min_nodes    = 3
  workload_max_nodes    = 10
  workload_machine_type = "e2-standard-4"
}

module "cloudsql" {
  source              = "../../modules/cloudsql-postgres"
  environment         = var.environment
  region              = var.region
  network_id          = module.network.network_id
  tier                = "db-custom-4-15360"
  availability_type   = "REGIONAL"
  disk_size_gb        = 100
  pitr_enabled        = true
  retained_backups    = 30
  database_name       = "landmarknav"
  database_user       = "landmarknav_app"
  deletion_protection = true

  depends_on = [module.network.private_vpc_connection]
}

module "redis" {
  source         = "../../modules/redis"
  environment    = var.environment
  region         = var.region
  network_id     = module.network.network_id
  tier           = "STANDARD_HA"
  memory_size_gb = 5

  depends_on = [module.network.private_vpc_connection]
}

module "storage" {
  source        = "../../modules/storage"
  project_id    = var.project_id
  environment   = var.environment
  region        = var.region
  force_destroy = false
}

module "secrets" {
  source                   = "../../modules/secrets"
  environment              = var.environment
  api_workload_sa_email    = module.iam.api_workload_sa_email
  vision_workload_sa_email = module.iam.vision_workload_sa_email
}

module "monitoring" {
  source      = "../../modules/monitoring"
  environment = var.environment
  alert_email = var.alert_email
}
