#!/bin/bash
# Quick status check - fast diagnostics

cd /home/ubuntu/emr/deploy

echo "📊 Container Status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "🔍 API Health:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/api/health || echo "❌ API not responding"

echo ""
echo "📋 Recent API Logs (last 10 lines):"
docker compose -f docker-compose.prod.yml logs --tail=10 api 2>/dev/null || echo "No logs available"



