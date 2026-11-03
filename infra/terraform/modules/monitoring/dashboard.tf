resource "google_monitoring_dashboard" "navigation_overview" {
  dashboard_json = jsonencode({
    displayName = "${var.environment}-landmarknav-navigation-overview"
    gridLayout = {
      columns = 2
      widgets = [
        {
          title = "GKE Container CPU Limit Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"k8s_container\" AND metric.type = \"kubernetes.io/container/cpu/limit_utilization\""
                    aggregation = {
                      perSeriesAligner = "ALIGN_MEAN"
                      alignmentPeriod  = "60s"
                    }
                  }
                }
                plotType = "LINE"
              }
            ]
          }
        },
        {
          title = "GKE Container Memory Limit Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"k8s_container\" AND metric.type = \"kubernetes.io/container/memory/limit_utilization\""
                    aggregation = {
                      perSeriesAligner = "ALIGN_MEAN"
                      alignmentPeriod  = "60s"
                    }
                  }
                }
                plotType = "LINE"
              }
            ]
          }
        },
        {
          title = "Cloud SQL CPU Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
                    aggregation = {
                      perSeriesAligner = "ALIGN_MEAN"
                      alignmentPeriod  = "60s"
                    }
                  }
                }
                plotType = "LINE"
              }
            ]
          }
        },
        {
          title = "Cloud Memorystore Redis Memory Usage Ratio"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"redis_instance\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
                    aggregation = {
                      perSeriesAligner = "ALIGN_MEAN"
                      alignmentPeriod  = "60s"
                    }
                  }
                }
                plotType = "LINE"
              }
            ]
          }
        }
      ]
    }
  })
}
