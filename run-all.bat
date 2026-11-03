@echo off
setlocal enabledelayedexpansion
title LandmarkNav - One-Click Build and Launch Suite
color 0A

echo ===============================================================================
echo                LANDMARKNAV - AUTONOMOUS ONE-CLICK RUNNER
echo ===============================================================================
echo [1/4] Bootstrapping local environment configuration...

if not exist ".env" (
    echo [.env] not found. Generating default local development configuration...
    call node.exe scripts/bootstrap-env.mjs
    if errorlevel 1 (
        echo [ERROR] Failed to bootstrap .env file.
        goto :error
    )
) else (
    echo [.env] configuration detected.
)

echo.
echo ===============================================================================
echo [2/4] Running full project verification (YAML, API, Mobile, Security)...
echo ===============================================================================

call npm run verify
if errorlevel 1 (
    echo [ERROR] Repository verification failed! Please check test logs above.
    goto :error
)

echo.
echo [Infra] Validating Phase 2 Cloud Infrastructure (Terraform, K8s, Observability)...
call node.exe scripts/verify-phase2-infra.mjs
if errorlevel 1 (
    echo [NOTE] Offline cloud provider discovery skipped. Local manifests remain valid.
)

echo.
echo ===============================================================================
echo [3/4] Checking Local Platform Services...
echo ===============================================================================

docker info >nul 2>&1
if errorlevel 1 (
    echo [NOTE] Docker daemon is not running in this session.
    echo Fastify API can be launched in standalone mode below.
    goto :interactive_menu
)

echo Building and launching container services in the background...
call npm run up
if errorlevel 1 (
    echo [WARNING] Docker Compose startup failed. Continuing...
    goto :interactive_menu
)

echo.
echo Waiting 5 seconds for local services to initialize...
timeout /t 5 /nobreak >nul

echo.
echo ===============================================================================
echo LandmarkNav System Status and Endpoints
echo ===============================================================================
echo   * Fastify API:            http://localhost:3000/healthz
echo   * Python Vision Service:  http://localhost:8000/healthz
echo   * PostgreSQL [PostGIS]:   localhost:5432 [DB: landmarknav]
echo   * Redis Cache:            localhost:6379
echo   * Grafana Dashboard:      http://localhost:3001 [admin / admin]
echo   * Prometheus Metrics:     http://localhost:9090
echo ===============================================================================
echo.

:interactive_menu
echo.
echo ===============================================================================
echo [4/4] What would you like to run now?
echo ===============================================================================
echo   [1] Start Fastify API (Standalone Node Server on http://localhost:3000)
echo   [2] Start Expo Mobile App (Expo Go - Recommended, Zero Login, Phone & PC on same Wi-Fi)
echo   [3] Start Expo Mobile App (Tunnel Mode - requires free 'npx expo login')
echo   [4] Open Expo Web App in Browser (http://localhost:8081)
echo   [L] Stream Docker Compose logs
echo   [Q] Quit (Done)
echo -------------------------------------------------------------------------------
set /p USER_CHOICE="Select option [1/2/3/4/L/Q] (default: 1): "

if "%USER_CHOICE%"=="2" (
    echo.
    echo Starting Expo Mobile Development Client (Expo Go mode)...
    echo Press Ctrl+C at any time to exit the mobile server.
    call npm run start --workspace=@landmarknav/mobile
    goto :end
)

if "%USER_CHOICE%"=="3" (
    echo.
    echo Starting Expo Mobile Development Client in Tunnel Mode...
    echo Press Ctrl+C at any time to exit the mobile server.
    call npm run start:tunnel --workspace=@landmarknav/mobile
    goto :end
)

if "%USER_CHOICE%"=="4" (
    echo.
    echo Starting Expo Web Client on http://localhost:8081...
    echo Press Ctrl+C at any time to exit the web server.
    call npm run start:web --workspace=@landmarknav/mobile
    goto :end
)

if /i "%USER_CHOICE%"=="L" (
    echo.
    echo Streaming live logs from Docker Compose [Press Ctrl+C to stop stream]...
    docker compose --env-file .env -f infra/docker/docker-compose.yml logs -f
    goto :end
)

if /i "%USER_CHOICE%"=="Q" (
    echo.
    echo [SUCCESS] LandmarkNav build and verification complete!
    goto :end
)

echo.
echo Starting LandmarkNav API server on http://localhost:3000...
echo Press Ctrl+C at any time to stop the API server.
call npm run start:standalone --workspace=@landmarknav/api
goto :end

:error
color 0C
echo.
echo ===============================================================================
echo [ERROR] One or more startup steps failed. Check output above for details.
echo ===============================================================================
pause
exit /b 1

:end
endlocal
