#!/bin/bash
# Script to deploy updates to Lightsail
# Usage: ./deploy-to-lightsail.sh [path_to_key]

HOST="pagemdemr.com"
USER="ubuntu"
DIR="/home/ubuntu/emr"

# Get absolute path to key
RELATIVE_KEY_PATH="$1"
if [[ "$RELATIVE_KEY_PATH" != /* ]]; then
  KEY_PATH="$(pwd)/$RELATIVE_KEY_PATH"
else
  KEY_PATH="$RELATIVE_KEY_PATH"
fi

echo "🚀 Starting Hybrid Deployment to $USER@$HOST..."

# 1. LOCAL BUILD (CRITICAL: Offloads 2GB+ RAM usage from 1GB VPS)
if [ -d "client" ] && [ -f "client/package.json" ]; then
  echo "📦 Building frontend locally..."
  cd client
  if [ -d "node_modules" ]; then
    rm -f dist.tar.gz
    npm run build
    if [ $? -eq 0 ]; then
      echo "🗜️  Packaging local build..."
      tar -czf dist.tar.gz -C dist .
      LOCAL_BUILD_SUCCESS=true
    else
      echo "❌ ERROR: Local build failed."
      exit 1
    fi
  else
    echo "⚠️  WARNING: Local node_modules missing. Local build skipped."
  fi
  cd ..
fi

echo "🗜️  Packaging local server changes..."
# COPYFILE_DISABLE=1 prevents macOS from adding ._ files to the archive
# Use --exclude to keep the archive small
COPYFILE_DISABLE=1 tar --exclude='node_modules' --exclude='.git' --exclude='.DS_Store' -czf server.tar.gz server

echo "🌐 Connecting to server for deployment..."

ssh -i "$KEY_PATH" "$USER@$HOST" << EOF
  set -e
  
  cd "$DIR"
  
  echo "⬇️  Pulling latest changes..."
  git merge --abort 2>/dev/null || true
  git reset --hard HEAD 2>/dev/null || true
  git fetch origin
  git reset --hard origin/main
EOF

# 2. UPLOAD ARTIFACTS (AFTER git reset to ensure they aren't deleted)
if [ "$LOCAL_BUILD_SUCCESS" = true ]; then
  echo "📤 Uploading pre-built frontend artifacts..."
  scp -i "$KEY_PATH" client/dist.tar.gz "$USER@$HOST:$DIR/client/dist.tar.gz"
fi

echo "📤 Uploading local server changes..."
scp -i "$KEY_PATH" server.tar.gz "$USER@$HOST:$DIR/server.tar.gz"
rm server.tar.gz

echo "🌐 Resuming deployment on server..."

ssh -i "$KEY_PATH" "$USER@$HOST" << EOF
  set -e
  cd "$DIR"
  
  echo "📦 Extracting server changes..."
  tar -xzf server.tar.gz
  rm server.tar.gz
  
  cd deploy
  
  echo "⚙️  Checking environment variables..."
  if [ ! -f .env ]; then
    echo "⚙️  Initializing .env from .env.prod (first time setup)..."
    cp .env.prod .env
  else
    echo "✅ .env file exists. Preserving existing secrets."
  fi
  
  # 2. FRONTEND HANDLING (FIX 404 ROOT CAUSE)
  if [ -f ../client/dist.tar.gz ]; then
    echo "📦 Using pre-built artifacts. Cleaning destination..."
    sudo rm -rf ../client/dist
    mkdir -p ../client/dist
    tar -xzf ../client/dist.tar.gz -C ../client/dist
    rm ../client/dist.tar.gz
  else
    echo "⚠️  WARNING: Building on server..."
    docker run --rm -v "\$(pwd)/../client:/app" -v "emr_node_modules:/app/node_modules" -w /app node:18-alpine sh -c "npm install --legacy-peer-deps && npm run build"
  fi
    
  echo "📂 Refreshing static artifacts..."
  # Use static/* to preserve the directory mount point
  sudo rm -rf static/*
  mkdir -p static
  # Using sudo cp to ensure it works even if static/ is mounted or special
  sudo cp -r ../client/dist/* static/
  sudo chown -R $USER:$USER static/
    
  echo "🔄 Building & Restarting services..."
  DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build api
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  echo "📡 Reloading Caddy configuration..."
  docker exec emr-caddy caddy reload --config /etc/caddy/Caddyfile || true
  
  echo "🌍 Verifying static files..."
  if [ -f static/index.html ]; then
    echo "✅ index.html present in static directory"
  else
    echo "❌ ERROR: index.html missing from static directory"
    exit 1
  fi
  
  echo "✅ Deployment complete!"
  echo -n "🌍 Site Status (pagemdemr.com): "
  curl -s -o /dev/null -w "%{http_code}" https://pagemdemr.com
  echo ""
EOF

# Local Cleanup
rm -f client/dist.tar.gz
