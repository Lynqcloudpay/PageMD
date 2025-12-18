#!/bin/bash
# Quick restart script - only restarts containers without rebuilding
# Use this for code changes that don't require rebuilds

set -e

echo "⚡ Quick restart (no rebuild)..."

cd /home/ubuntu/emr/deploy

# Just restart containers - much faster
docker compose -f docker-compose.prod.yml restart api web

echo "✅ Containers restarted!"
docker compose -f docker-compose.prod.yml ps



