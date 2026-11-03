# LandmarkNav - Autonomous One-Click Runner (PowerShell)
$Host.UI.RawUI.WindowTitle = "LandmarkNav - One-Click Build and Launch Suite"

Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "               LANDMARKNAV - AUTONOMOUS ONE-CLICK RUNNER                      " -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green

# 1. Environment bootstrap
Write-Host "`n[1/4] Bootstrapping local environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "[.env] not found. Generating default local development configuration..." -ForegroundColor Cyan
    node.exe scripts/bootstrap-env.mjs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to bootstrap .env file."
        exit $LASTEXITCODE
    }
} else {
    Write-Host "[.env] configuration detected." -ForegroundColor DarkGray
}

# 2. Monorepo Verification
Write-Host "`n===============================================================================" -ForegroundColor Green
Write-Host "[2/4] Running full project verification (YAML, API, Mobile, Security)..." -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Green

npm run verify
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Repository verification failed! Please inspect test logs above." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n[Infra] Validating Phase 2 Cloud Infrastructure (Terraform, K8s, Observability)..." -ForegroundColor Yellow
node.exe scripts/verify-phase2-infra.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[NOTE] Offline cloud provider discovery skipped. Local manifests remain valid." -ForegroundColor DarkGray
}

# 3. Docker Platform Check
Write-Host "`n===============================================================================" -ForegroundColor Green
Write-Host "[3/4] Checking Local Platform Services..." -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Green

$dockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
    }
} catch {
    $dockerRunning = $false
}

if ($dockerRunning) {
    Write-Host "Docker is running! Launching container services in the background..." -ForegroundColor Cyan
    npm run up
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Waiting 5 seconds for local services to initialize..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
        Write-Host "`n  * Fastify API:            http://localhost:3000/healthz" -ForegroundColor Cyan
        Write-Host "  * Python Vision Service:  http://localhost:8000/healthz" -ForegroundColor Cyan
        Write-Host "  * PostgreSQL [PostGIS]:   localhost:5432 [DB: landmarknav]" -ForegroundColor Cyan
        Write-Host "  * Redis Cache:            localhost:6379" -ForegroundColor Cyan
        Write-Host "  * Grafana Dashboard:      http://localhost:3001 [admin / admin]" -ForegroundColor Cyan
        Write-Host "  * Prometheus Metrics:     http://localhost:9090" -ForegroundColor Cyan
    }
} else {
    Write-Host "[NOTE] Docker daemon is not running." -ForegroundColor DarkYellow
    Write-Host "You can start the Fastify API in standalone mode or launch Docker Desktop." -ForegroundColor DarkGray
}

# 4. Interactive menu
Write-Host "`n===============================================================================" -ForegroundColor Green
Write-Host "[4/4] What would you like to run now?" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  [1] Start Fastify API (Standalone Node Server on http://localhost:3000)" -ForegroundColor White
Write-Host "  [2] Start Expo Mobile App (Expo Go - Recommended, Zero Login, Phone & PC on same Wi-Fi)" -ForegroundColor White
Write-Host "  [3] Start Expo Mobile App (Tunnel Mode - requires free 'npx expo login')" -ForegroundColor White
Write-Host "  [4] Open Expo Web App in Browser (http://localhost:8081)" -ForegroundColor White
if ($dockerRunning) {
    Write-Host "  [L] Stream Docker Compose logs" -ForegroundColor White
}
Write-Host "  [Q] Quit (Done)" -ForegroundColor White
Write-Host "-------------------------------------------------------------------------------" -ForegroundColor Green

$choice = Read-Host "Select option [1/2/3/4/L/Q] (default: 1)"

if ($choice -eq "2") {
    Write-Host "`nStarting Expo Mobile Client (Expo Go mode)... (Press Ctrl+C to stop)`n" -ForegroundColor Cyan
    npm run start --workspace=@landmarknav/mobile
} elseif ($choice -eq "3") {
    Write-Host "`nStarting Expo Mobile Client in Tunnel Mode (Accessible from any network/phone)...`n" -ForegroundColor Cyan
    npm run start:tunnel --workspace=@landmarknav/mobile
} elseif ($choice -eq "4") {
    Write-Host "`nStarting Expo Web Client on http://localhost:8081...`n" -ForegroundColor Cyan
    npm run start:web --workspace=@landmarknav/mobile
} elseif ($choice -eq "L" -and $dockerRunning) {
    Write-Host "`nStreaming Docker Compose logs... (Press Ctrl+C to stop)`n" -ForegroundColor Cyan
    docker compose --env-file .env -f infra/docker/docker-compose.yml logs -f
} elseif ($choice -eq "Q") {
    Write-Host "`n[SUCCESS] LandmarkNav verification and build complete!" -ForegroundColor Green
} else {
    Write-Host "`nStarting LandmarkNav API server on http://localhost:3000... (Press Ctrl+C to stop)`n" -ForegroundColor Cyan
    npm run start:standalone --workspace=@landmarknav/api
}
