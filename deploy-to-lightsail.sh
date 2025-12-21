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
  
  echo "🏗️  Building frontend on server (this may be slow)..."
  mkdir -p static
  cd ../client
  if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
    npm install --prefer-offline --no-audit --silent
  fi
  echo "🔨 Running build..."
  VITE_API_URL=https://bemypcp.com/api npm run build
  cp -r dist/* ../deploy/static/
  cd ../deploy
  
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
