#!/bin/bash
# Quick build script with timeouts to prevent hangs
set -e

TIMEOUT=300  # 5 minutes max per build
BUILD_TYPE="${1:-all}"

echo "🚀 Quick build script (timeout: ${TIMEOUT}s per build)"

# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

build_with_timeout() {
    local service=$1
    local cmd=$2
    echo "📦 Building $service (max ${TIMEOUT}s)..."
    
    if timeout $TIMEOUT bash -c "$cmd"; then
        echo "✅ $service built successfully"
        return 0
    else
        echo "❌ $service build timed out or failed"
        return 1
    fi
}

case "$BUILD_TYPE" in
    web)
        build_with_timeout "web" "docker compose -f docker-compose.prod.yml build --progress=plain web"
        ;;
    api)
        build_with_timeout "api" "docker compose -f docker-compose.prod.yml build --progress=plain api"
        ;;
    all)
        build_with_timeout "api" "docker compose -f docker-compose.prod.yml build --progress=plain api" &
        API_PID=$!
        build_with_timeout "web" "docker compose -f docker-compose.prod.yml build --progress=plain web" &
        WEB_PID=$!
        
        wait $API_PID
        API_RESULT=$?
        wait $WEB_PID
        WEB_RESULT=$?
        
        if [ $API_RESULT -eq 0 ] && [ $WEB_RESULT -eq 0 ]; then
            echo "✅ All builds completed successfully"
            exit 0
        else
            echo "❌ Some builds failed"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [web|api|all]"
        exit 1
        ;;
esac

