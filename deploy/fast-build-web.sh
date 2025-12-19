#!/bin/bash
# Ultra-fast web build with aggressive caching
set -e

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_STEP_LOG_MAX_SIZE=50000000
export BUILDKIT_STEP_LOG_MAX_SPEED=10000000

cd /home/ubuntu/emr/deploy

echo "🚀 Fast web build starting..."

# Use existing image as cache if available
CACHE_IMAGE="deploy-web:latest"
if docker image inspect "$CACHE_IMAGE" >/dev/null 2>&1; then
    echo "✅ Using existing image as cache"
    docker tag "$CACHE_IMAGE" deploy-web:cache 2>/dev/null || true
fi

# Build with maximum caching
docker compose -f docker-compose.prod.yml build \
    --progress=plain \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    web 2>&1 | tee /tmp/web-build.log | grep -E "(Step|CACHED|DONE|ERROR|Building)" | tail -20

# Tag for next build cache
docker tag deploy-web deploy-web:latest 2>/dev/null || true

# Restart
echo "🔄 Restarting container..."
docker compose -f docker-compose.prod.yml up -d --no-deps web

echo "✅ Build complete!"

