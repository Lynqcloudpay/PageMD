#!/bin/bash
# Script to deploy updates to Lightsail
# Usage: ./deploy-to-lightsail.sh [path_to_key]

HOST="bemypcp.com"
USER="ubuntu"
DIR="/home/ubuntu/app"
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
  git pull
  
  cd deploy
  
  echo "⚙️  Checking environment variables..."
  # Ensure .env.prod has correct domain if it was copied from old example
  if [ -f .env.prod ]; then
    if grep -q "yourdomain.com" .env.prod; then
      echo "📝 Updating domain in existing .env.prod..."
      sed -i 's/yourdomain.com/bemypcp.com/g' .env.prod
    fi
  else
    echo "⚠️  .env.prod not found! Copying from example..."
    cp env.prod.example .env.prod
  fi
  
  echo "🔄 Restarting services..."
  # Rebuild api and web containers
  docker compose -f docker-compose.prod.yml up -d --build --force-recreate
  
  echo "✅ Deployment complete!"
  echo "🌍 Checking site status..."
  curl -I https://bemypcp.com
EOF
