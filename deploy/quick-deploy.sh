#!/bin/bash
# Quick deployment script with timeouts and faster volume updates
set -e

TIMEOUT=120  # 2 minutes max for operations

echo "🚀 Quick deployment script"

# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Function to run commands with timeout
run_with_timeout() {
    local desc=$1
    local cmd=$2
    echo "⏱️  $desc (max ${TIMEOUT}s)..."
    
    if timeout $TIMEOUT bash -c "$cmd"; then
        echo "✅ $desc completed"
        return 0
    else
        echo "❌ $desc timed out or failed"
        return 1
    fi
}

# Build only what changed (faster)
if [ "$1" == "web" ]; then
    echo "📦 Building web only..."
    run_with_timeout "Web build" "docker compose -f docker-compose.prod.yml build --progress=plain web"
    run_with_timeout "Web restart" "docker compose -f docker-compose.prod.yml up -d --no-deps web"
    
    # Fast volume update (copy from container instead of rebuild)
    echo "📋 Updating web static volume..."
    run_with_timeout "Volume update" "docker compose -f docker-compose.prod.yml exec -T web sh -c 'cp -r /usr/share/caddy/* /tmp/web_copy 2>/dev/null || true' && docker cp emr-web:/usr/share/caddy/. ./static/ 2>/dev/null || echo 'Volume update skipped (will use container files)'"
    
elif [ "$1" == "api" ]; then
    echo "📦 Building API only..."
    run_with_timeout "API build" "docker compose -f docker-compose.prod.yml build --progress=plain api"
    run_with_timeout "API restart" "docker compose -f docker-compose.prod.yml up -d --no-deps api"
    
else
    echo "📦 Building all services..."
    run_with_timeout "Full build" "./quick-build.sh all"
    run_with_timeout "Restart services" "docker compose -f docker-compose.prod.yml up -d"
fi

echo "✅ Deployment complete!"
echo "🔍 Checking service health..."
sleep 3
docker compose -f docker-compose.prod.yml ps

