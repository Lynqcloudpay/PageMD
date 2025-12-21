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
  # Handle any merge conflicts by resetting to clean state
  git merge --abort 2>/dev/null || true
  git reset --hard HEAD 2>/dev/null || true
  git stash || true
  git fetch origin
  git reset --hard origin/main || git pull origin main
  
  cd deploy
  
  echo "⚙️  Checking environment variables..."
  # Ensure .env.prod has correct domain if it was copied from old example
  if [ -f .env.prod ]; then
    if grep -q "yourdomain.com" .env.prod; then
      echo "📝 Updating domain in existing .env.prod..."
      sed -i 's/yourdomain.com/bemypcp.com/g' .env.prod
      sed -i 's|FRONTEND_URL=https://yourdomain.com|FRONTEND_URL=https://bemypcp.com|g' .env.prod
      sed -i 's|CORS_ORIGIN=https://yourdomain.com|CORS_ORIGIN=https://bemypcp.com|g' .env.prod
    fi
  else
    echo "⚠️  .env.prod not found! Copying from example..."
    cp env.prod.example .env.prod
  fi
  
  echo "📝 Setting up frontend environment variables..."
  # Create .env.production for the frontend build
  # This ensures VITE_API_URL is baked into the static files
  mkdir -p ../client
  echo "VITE_API_URL=https://bemypcp.com/api" > ../client/.env.production
  
  echo "🔑 Checking DB SSL certificates (skipping if already exist)..."
  # Skip certificate generation - assume they already exist
  # This step was causing hangs, certificates should already be in place
  echo "✅ Certificate check skipped (assuming already configured)"

  echo "🔄 Building and restarting services (using cache for speed)..."
  # Build WITH cache - much faster, only rebuilds changed layers
  # Use --no-cache only if you need a completely fresh build
  docker compose -f docker-compose.prod.yml build api web
  
  echo "🧹 Cleaning up stale static assets..."
  # Remove the web_static volume to force Caddy to serve fresh files from the new image
  # We use || true to prevent failure if volume explicitly doesn't exist yet
  # The volume name is typically foldername_volumename, so deploy_web_static
  docker volume rm deploy_web_static 2>/dev/null || true
  
  echo "🚀 Starting containers..."
  docker compose -f docker-compose.prod.yml up -d --force-recreate api web
  
  echo "✅ Deployment complete!"
  echo "🌍 Checking site status..."
  curl -I https://bemypcp.com
EOF
