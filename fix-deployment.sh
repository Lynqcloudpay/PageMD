#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
# Key path passed as first argument
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  echo "❌ No key path provided. Usage: ./fix-deployment.sh <path-to-private-key>"
  exit 1
fi

# Securely copy key to tmp
cp "$INPUT_KEY_PATH" /tmp/deploy_key_fix
chmod 600 /tmp/deploy_key_fix
KEY_PATH="/tmp/deploy_key_fix"

echo "🔧 Connecting to $HOST to fix deployment..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  set -x
  cd /home/ubuntu/emr/deploy
  
  echo "🛑 FORCING DOWN all containers..."
  # Force stop and remove everything related to this compose project
  docker compose -f docker-compose.prod.yml down --remove-orphans
  # Note: --volumes might remove db volume if it's anonymous, but usually prod db is named volume or bind mount. 
  # Let's check docker-compose.prod.yml first? 
  # Actually, 'down' is usually enough. 'down --volumes' is dangerous if data is not persistent.
  # Let's stick to down --remove-orphans.
  docker compose -f docker-compose.prod.yml down --remove-orphans

  echo "🧹 Force cleaning any stuck containers..."
  # Fallback: remove any container with 'emr' in the name manually if compose missed them
  docker ps -a | grep emr | awk '{print \$1}' | xargs -r docker rm -f

  echo "🚀 Starting fresh..."
  docker compose -f docker-compose.prod.yml up -d

  echo "⏳ Waiting for health checks..."
  sleep 15
  
  echo "📊 Container Status:"
  docker ps -a
  
  echo "📜 API Logs (last 20 lines):"
  docker logs emr-api 2>&1 | tail -n 20
EOF

rm /tmp/deploy_key_fix
echo "✅ Fix script finished."
