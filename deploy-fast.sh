#!/bin/bash
set -x
# Ultra-fast deployment script (Robust Version)
# Builds frontend locally and rsyncs it to the server

HOST="pagemdemr.com"
USER="ubuntu"
DIR="/home/ubuntu/emr"
INPUT_KEY_PATH="$1"

# Hardcoded absolute path to avoid pwd/shell issues with spaces
PROJECT_ROOT="/Volumes/Mel's SSD/paper emr"

echo "🚀 Starting ULTRA-FAST deployment to $HOST..."

# Handle Key (Copy to /tmp to avoid space/quote issues in ssh/rsync commands)
if [ ! -z "$INPUT_KEY_PATH" ]; then
  echo "Copying key from '$INPUT_KEY_PATH' to /tmp/deploy_key"
  cp "$INPUT_KEY_PATH" /tmp/deploy_key || { echo "❌ Failed to copy key"; exit 1; }
  chmod 600 /tmp/deploy_key
  KEY_PATH="/tmp/deploy_key"
else
  echo "❌ No key path provided"
  exit 1
fi

ls -la "$KEY_PATH"

# 1. Local Build
echo "🏗️  Building frontend locally..."
cd "$PROJECT_ROOT/client" || { echo "❌ Cannot cd to client dir"; exit 1; }

echo "VITE_API_URL=https://pagemdemr.com/api" > .env.production.local
npm run build || { echo "❌ Build failed"; exit 1; }

cd "$PROJECT_ROOT"

# 2. Sync Static Files
echo "📤 Syncing static files to server..."
# Using strict verify checking for ssh
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST "mkdir -p $DIR/deploy/static"

LOCAL_DIST="$PROJECT_ROOT/client/dist/"
echo "Syncing from $LOCAL_DIST to $USER@$HOST:$DIR/deploy/static/"

rsync -av --delete -e "ssh -i $KEY_PATH -o StrictHostKeyChecking=no" "$LOCAL_DIST" "$USER@$HOST:$DIR/deploy/static/"

# Verify files reached the server
echo "🔍 Verifying files on server..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST "ls -la $DIR/deploy/static/index.html"

# 3. Server-side API build & restart
echo "⚙️  Updating server code and restarting API..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  set -e
  cd $DIR
  
  echo "⬇️  Pulling latest changes..."
  git fetch origin
  git reset --hard origin/main
  
  cd deploy
  
  # Ensure env files exist
  if [ ! -f .env.prod ]; then
    cp env.prod.example .env.prod
    sed -i 's/yourdomain.com/bemypcp.com/g' .env.prod
  fi
  
  echo "🔄 Building API service..."
  DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build api
  
  echo "🚀 Restarting containers..."
  docker rm -f emr-api || true
  docker rm -f emr-caddy || true
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  
  echo "⏳ Waiting for database to be healthy..."
  for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml exec -T db pg_isready -U emr_user -d emr_db > /dev/null 2>&1; then
      echo "✅ Database is ready!"
      break
    fi
    echo "Still waiting... (\$i/30)"
    sleep 2
  done

  # Application-specific migrations
  echo "⚙️  Running Admin Settings Migration..."
  docker compose -f docker-compose.prod.yml exec -T api node scripts/migrate-admin-settings.js || echo "⚠️ Warning: Admin settings migration failed."

  echo "🛡️  Running Role Governance Migration..."
  docker compose -f docker-compose.prod.yml exec -T api node scripts/migrate-role-governance.js || echo "⚠️ Warning: Governance migration failed."

  echo "🔗 Running Phase 3 Source Template Linkage Migration..."
  docker compose -f docker-compose.prod.yml exec -T api node scripts/migrate-phase3-source-template.js || echo "⚠️ Warning: Phase 3 Source Template migration failed."

  echo "🔒 Running Phase 3 Audit Hashing Migration..."
  docker compose -f docker-compose.prod.yml exec -T api node scripts/migrate-audit-hashing.js || echo "⚠️ Warning: Phase 3 Audit migration failed."

  echo "🧹 Cleanup..."
  docker image prune -f
EOF

echo "✅ Deployment complete!"
rm /tmp/deploy_key
