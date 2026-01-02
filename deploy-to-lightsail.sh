#!/bin/bash
# Script to deploy updates to Lightsail
# Usage: ./deploy-to-lightsail.sh [path_to_key]

HOST="pagemdemr.com"
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
      sed -i 's/yourdomain.com/pagemdemr.com/g' .env.prod
      sed -i 's|FRONTEND_URL=https://yourdomain.com|FRONTEND_URL=https://pagemdemr.com|g' .env.prod
      sed -i 's|CORS_ORIGIN=https://yourdomain.com|CORS_ORIGIN=https://pagemdemr.com|g' .env.prod
    fi
    if ! grep -q "PATIENT_PORTAL_ENABLED" .env.prod; then
      echo "" >> .env.prod
      echo "PATIENT_PORTAL_ENABLED=true" >> .env.prod
      echo "PORTAL_URL=https://pagemdemr.com/portal" >> .env.prod
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
    
  echo "📂 Copying build artifacts to deployment directory..."
  rm -rf static/*
  mkdir -p static
  cp -r ../client/dist/* static/
    
  echo "🔄 Building API service (using BuildKit)..."
  DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build api
  
  echo "🚀 Rolling update of services..."
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  
  echo "🔄 Running database schema updates..."
  # Wait for API container to be ready
  sleep 10
  docker compose -f docker-compose.prod.yml exec -T api node scripts/update_patients_schema.js || echo "⚠️ Patients schema update failed, check logs"
  docker compose -f docker-compose.prod.yml exec -T api node scripts/create_ordersets_table.js || echo "⚠️ Ordersets schema update failed, check logs"
  docker compose -f docker-compose.prod.yml exec -T api node scripts/migrate-superbill-enhancements.js || echo "⚠️ Superbill migration failed, check logs"
  docker compose -f docker-compose.prod.yml exec -T api node scripts/migrate-patient-portal.js || echo "⚠️ Patient Portal migration failed, check logs"
  
  echo "🧹 Cleaning up old images..."
  docker image prune -f
  
  echo "✅ Deployment complete!"
  echo "🌍 Checking site status..."
  curl -I https://pagemdemr.com
EOF
