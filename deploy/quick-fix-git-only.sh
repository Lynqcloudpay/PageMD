#!/bin/bash
# Quick fix for git lock only (if Docker is working fine)
set -e

cd /home/ubuntu/emr

echo "🔧 Removing git locks..."
rm -f .git/index.lock
rm -f .git/refs/remotes/origin/main.lock
rm -f .git/refs/heads/main.lock
rm -f .git/packed-refs.lock
rm -f .git/HEAD.lock

echo "🔄 Syncing repository..."
git fetch origin main
git reset --hard origin/main

echo "✅ Git fixed! Now run:"
echo "   cd deploy"
echo "   export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1"
echo "   docker compose -f docker-compose.prod.yml build web"
echo "   docker compose -f docker-compose.prod.yml up -d --no-deps web"

