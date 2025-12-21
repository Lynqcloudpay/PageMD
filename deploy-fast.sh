#!/bin/bash
# Ultra-fast deployment script
# Builds frontend locally and rsyncs it to the server
# Usage: ./deploy-fast.sh [path_to_key]

HOST="bemypcp.com"
USER="ubuntu"
DIR="/home/ubuntu/emr"
KEY_PATH="$1"

SSH_CMD="ssh"
RSYNC_CMD="rsync -az"
if [ ! -z "$KEY_PATH" ]; then
  SSH_CMD="ssh -i $KEY_PATH"
  RSYNC_CMD="rsync -az -e \"ssh -i $KEY_PATH\""
fi

echo "🚀 Starting ULTRA-FAST deployment to $HOST..."

# 1. Local Build
echo "🏗️  Building frontend locally..."
cd client
# Use a temp env file to avoid messing with local dev
echo "VITE_API_URL=https://bemypcp.com/api" > .env.production.local
VITE_API_URL=https://bemypcp.com/api npm run build
cd ..

# 2. Sync Static Files
echo "📤 Syncing static files to server..."
$SSH_CMD $USER@$HOST "mkdir -p $DIR/deploy/static"
echo "Running: $RSYNC_CMD --delete client/dist/ $USER@$HOST:$DIR/deploy/static/"
$RSYNC_CMD -v --delete client/dist/ $USER@$HOST:$DIR/deploy/static/

# 3. Server-side API build & restart
echo "⚙️  Updating server code and restarting API..."
$SSH_CMD $USER@$HOST << EOF
  set -e
  cd $DIR
  
  echo "⬇️  Pulling latest changes (excluding client build)..."
  git fetch origin
  git reset --hard origin/main
  
  cd deploy
  
  # Ensure env files exist
  if [ ! -f .env.prod ]; then
    cp env.prod.example .env.prod
    sed -i 's/yourdomain.com/bemypcp.com/g' .env.prod
  fi
  
  echo "🔄 Building API service (using BuildKit)..."
  DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build api
  
  echo "🚀 Rolling update..."
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  
  echo "🧹 Cleanup..."
  docker image prune -f
EOF

echo "✅ Ultra-fast deployment complete!"
echo "🌍 https://bemypcp.com is updated."
