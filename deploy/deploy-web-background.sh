#!/bin/bash
# Background deployment script - won't hang SSH
set -e

cd /home/ubuntu/emr/deploy

# Remove git locks
rm -f ../.git/index.lock ../.git/refs/remotes/origin/main.lock ../.git/refs/heads/main.lock

# Sync repo
cd /home/ubuntu/emr
git fetch origin main 2>&1 | tail -1
git reset --hard origin/main 2>&1 | tail -1

# Build and deploy (skip pre-pull to avoid hangs)
cd /home/ubuntu/emr/deploy
export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1

# Build with timeout
timeout 600 docker compose -f docker-compose.prod.yml build web 2>&1 | tee /tmp/web-build.log

# Restart
docker compose -f docker-compose.prod.yml up -d --no-deps web 2>&1 | tee -a /tmp/web-build.log

echo "✅ Deployment complete at $(date)" >> /tmp/web-build.log

