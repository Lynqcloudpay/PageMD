#!/bin/bash
# Fix git lock and deploy
set -e

cd /home/ubuntu/emr

# Remove git lock files
rm -f .git/index.lock
rm -f .git/refs/remotes/origin/main.lock
rm -f .git/refs/heads/main.lock

# Pull latest changes
git fetch origin main
git reset --hard origin/main

# Build and deploy
cd deploy
export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-deps web

echo "✅ Deployment complete!"

