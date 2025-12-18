#!/bin/bash
# Quick fix for 502 errors - restarts API and checks health

set -e

cd /home/ubuntu/emr/deploy

echo "🔧 Fixing 502 error..."

echo "1️⃣ Stopping containers..."
docker compose -f docker-compose.prod.yml stop api

echo "2️⃣ Starting API container..."
docker compose -f docker-compose.prod.yml up -d api

echo "3️⃣ Waiting for API to be healthy (10 seconds)..."
sleep 10

echo "4️⃣ Checking API health..."
for i in {1..5}; do
    if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ API is healthy!"
        break
    else
        echo "⏳ Waiting for API... ($i/5)"
        sleep 2
    fi
done

echo ""
echo "📊 Final Status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "📋 API Logs (last 20 lines):"
docker compose -f docker-compose.prod.yml logs --tail=20 api



