#!/bin/bash
# Fast deployment - uses Docker cache, only rebuilds if needed
# Much faster than --no-cache rebuilds

set -e

cd /home/ubuntu/emr

echo "📥 Pulling latest code..."
git stash || true
git fetch origin main || git fetch origin || true
git reset --hard origin/main 2>/dev/null || git pull origin main || true

cd deploy

echo "🔨 Building with cache (fast rebuild)..."
# Build WITH cache - only rebuilds changed layers
docker compose -f docker-compose.prod.yml build api web

echo "🚀 Starting containers..."
docker compose -f docker-compose.prod.yml up -d --force-recreate api web

echo "✅ Fast deployment complete!"
docker compose -f docker-compose.prod.yml ps



