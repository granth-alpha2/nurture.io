output "network_id" {
  description = "VPC network ID"
  value       = google_compute_network.vpc.id
}

output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.vpc.name
}

output "subnet_id" {
  description = "Subnet ID"
  value       = google_compute_subnetwork.subnet.id
}

output "subnet_name" {
  description = "Subnet name"
  value       = google_compute_subnetwork.subnet.name
}

output "pods_range_name" {
  description = "Secondary range name for GKE pods"
  value       = var.pods_range_name
}

output "services_range_name" {
  description = "Secondary range name for GKE services"
  value       = var.services_range_name
}

output "private_vpc_connection" {
  description = "Private VPC connection resource for peering dependency"
  value       = google_service_networking_connection.private_vpc_connection.id
}
