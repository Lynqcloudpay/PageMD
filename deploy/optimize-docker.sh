#!/bin/bash
# Optimize Docker and server for faster builds
set -e

echo "🚀 Optimizing Docker and server performance..."

# 1. Optimize Docker daemon configuration
echo "📝 Configuring Docker daemon..."
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 5,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "dns": ["8.8.8.8", "1.1.1.1"],
  "registry-mirrors": []
}
EOF

# 2. Increase Docker buildkit cache size
export DOCKER_BUILDKIT=1
export BUILDKIT_STEP_LOG_MAX_SIZE=50000000
export BUILDKIT_STEP_LOG_MAX_SPEED=10000000

# 3. Clean up old images/containers to free space
echo "🧹 Cleaning up Docker..."
docker system prune -f --volumes 2>/dev/null || true

# 4. Pre-pull base images in background (non-blocking)
echo "📥 Pre-pulling base images in background..."
nohup bash -c 'docker pull node:18-alpine && docker pull caddy:2-alpine' > /tmp/image-pull.log 2>&1 &

# 5. Optimize system limits
echo "⚙️  Optimizing system limits..."
if ! grep -q "docker" /etc/security/limits.conf; then
    echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
    echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
fi

# 6. Restart Docker with new config
echo "🔄 Restarting Docker..."
sudo systemctl daemon-reload
sudo systemctl restart docker

# 7. Wait for Docker to be ready
echo "⏳ Waiting for Docker to be ready..."
for i in {1..30}; do
    if docker info >/dev/null 2>&1; then
        echo "✅ Docker is ready"
        break
    fi
    sleep 1
done

# 8. Create optimized build script
cat > /home/ubuntu/emr/deploy/fast-build.sh <<'SCRIPT'
#!/bin/bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_STEP_LOG_MAX_SIZE=50000000
export BUILDKIT_STEP_LOG_MAX_SPEED=10000000

cd /home/ubuntu/emr/deploy
docker compose -f docker-compose.prod.yml build --parallel --progress=plain "$@"
SCRIPT

chmod +x /home/ubuntu/emr/deploy/fast-build.sh

echo ""
echo "✅ Optimization complete!"
echo ""
echo "📋 Quick commands:"
echo "  Fast build: /home/ubuntu/emr/deploy/fast-build.sh web"
echo "  Check image pull: tail -f /tmp/image-pull.log"

