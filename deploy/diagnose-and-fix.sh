#!/bin/bash
# Comprehensive diagnostic and fix script
set -e

echo "🔍 Step 1: Checking for stuck git processes..."
cd /home/ubuntu/emr

# Check for stuck git processes
GIT_PROCS=$(ps aux | grep -E "[g]it|[s]sh|[f]etch-pack|[i]ndex-pack" | grep -v grep || true)
if [ -n "$GIT_PROCS" ]; then
    echo "⚠️  Found git processes running:"
    echo "$GIT_PROCS"
    echo ""
    read -p "Kill these processes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pkill -9 -f "git|fetch-pack|index-pack" || true
        sleep 2
    fi
else
    echo "✅ No stuck git processes found"
fi

echo ""
echo "🔍 Step 2: Removing stale git locks..."
rm -f .git/index.lock
rm -f .git/refs/remotes/origin/main.lock
rm -f .git/refs/heads/main.lock
rm -f .git/packed-refs.lock
rm -f .git/HEAD.lock
echo "✅ Lock files removed"

echo ""
echo "🔍 Step 3: Testing Docker registry connectivity..."
if curl -I https://registry-1.docker.io/v2/ 2>&1 | head -1 | grep -q "200\|401"; then
    echo "✅ Docker Hub is reachable"
else
    echo "⚠️  Docker Hub connectivity issue detected"
    echo "   Testing DNS..."
    if nslookup registry-1.docker.io >/dev/null 2>&1; then
        echo "✅ DNS resolution works"
    else
        echo "❌ DNS resolution failed"
    fi
fi

echo ""
echo "🔍 Step 4: Checking disk space..."
df -h / | tail -1
echo ""
docker system df 2>/dev/null || echo "Docker system info unavailable"

echo ""
echo "🔍 Step 5: Syncing git repository..."
git fetch origin main
git reset --hard origin/main
echo "✅ Repository synced"

echo ""
echo "🔍 Step 6: Pre-pulling base images (to avoid hangs during build)..."
docker pull node:18-alpine || echo "⚠️  Failed to pull node:18-alpine (will try during build)"
docker pull caddy:2-alpine || echo "⚠️  Failed to pull caddy:2-alpine (will try during build)"
echo "✅ Base images pre-pulled"

echo ""
echo "🚀 Step 7: Building web container..."
cd deploy
export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
docker compose -f docker-compose.prod.yml build web

echo ""
echo "🚀 Step 8: Restarting web container..."
docker compose -f docker-compose.prod.yml up -d --no-deps web

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Container status:"
docker compose -f docker-compose.prod.yml ps web

echo ""
echo "📋 Recent logs (last 20 lines):"
docker compose -f docker-compose.prod.yml logs --tail=20 web

