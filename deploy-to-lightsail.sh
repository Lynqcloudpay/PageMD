#!/bin/bash
# Script to deploy updates to Lightsail
# Usage: ./deploy-to-lightsail.sh [path_to_key]

HOST="bemypcp.com"
USER="ubuntu"
# Default to emr directory, but allow override
DIR="${DEPLOY_DIR:-/home/ubuntu/emr}"
KEY_PATH="$1"

SSH_CMD="ssh"
if [ ! -z "$KEY_PATH" ]; then
  SSH_CMD="ssh -i $KEY_PATH"
fi

echo "🚀 Deploying to $USER@$HOST..."

$SSH_CMD $USER@$HOST << EOF
  set -e
  
  echo "📂 Navigating to app directory..."
  cd $DIR
  
  echo "⬇️  Pulling latest changes..."
  git merge --abort 2>/dev/null || true
  git reset --hard HEAD 2>/dev/null || true
  git stash || true
  git fetch origin
  git reset --hard origin/main || git pull origin main
  
  cd deploy
  
  echo "⚙️  Checking environment variables..."
  if [ -f .env.prod ]; then
    if grep -q "yourdomain.com" .env.prod; then
      sed -i 's/yourdomain.com/bemypcp.com/g' .env.prod
      sed -i 's|FRONTEND_URL=https://yourdomain.com|FRONTEND_URL=https://bemypcp.com|g' .env.prod
      sed -i 's|CORS_ORIGIN=https://yourdomain.com|CORS_ORIGIN=https://bemypcp.com|g' .env.prod
    fi
  else
    cp env.prod.example .env.prod
  fi
  
  echo "📦 Building frontend (using Docker container)..."
  
  # Use Docker to build frontend to avoid host environment issues
  # Mount the client directory to /app in the container
  
  docker run --rm \
    -v "$DIR/client:/app" \
    -w /app \
    node:18-alpine \
    sh -c "npm install --legacy-peer-deps && npm run build"
    
  echo "🔄 Building API service (using BuildKit)..."
  DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build api
  
  echo "🚀 Rolling update of services..."
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  
  echo "🧹 Cleaning up old images..."
  docker image prune -f
  
  echo "✅ Deployment complete!"
  echo "🌍 Checking site status..."
  curl -I https://bemypcp.com
EOF
