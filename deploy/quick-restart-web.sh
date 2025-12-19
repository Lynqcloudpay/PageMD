#!/bin/bash
# Quick restart without full rebuild - just restart container to pick up volume changes
set -e

cd /home/ubuntu/emr/deploy

echo "🔄 Restarting web container (no rebuild)..."
docker compose -f docker-compose.prod.yml restart web

echo "✅ Web container restarted"
echo ""
echo "📊 Status:"
docker compose -f docker-compose.prod.yml ps web

