#!/bin/bash
# Fast web update - minimal rebuild, no hangs
set -e

echo "🚀 Fast web update script"

# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Pull latest code
cd /home/ubuntu/emr
rm -f .git/index.lock 2>/dev/null || true
git fetch origin main 2>&1 | tail -1
git reset --hard origin/main 2>&1 | tail -1

# Quick build with minimal output
cd /home/ubuntu/emr/deploy
echo "📦 Building web (quick mode)..."
docker compose -f docker-compose.prod.yml build --quiet web 2>&1 | tail -5

# Restart container
echo "🔄 Restarting web container..."
docker compose -f docker-compose.prod.yml up -d --no-deps web 2>&1 | tail -3

echo "✅ Done!"

