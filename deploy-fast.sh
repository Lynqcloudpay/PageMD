#!/bin/bash
# Ultra-fast deployment script
# Builds frontend locally and rsyncs it to the server
# Usage: ./deploy-fast.sh [path_to_key]

HOST="bemypcp.com"
USER="ubuntu"
DIR="/home/ubuntu/emr"
KEY_PATH="$1"

SSH_OPTS=""
if [ ! -z "$KEY_PATH" ]; then
  SSH_OPTS="-i $KEY_PATH"
fi

echo "🚀 Starting ULTRA-FAST deployment to $HOST..."

# 1. Local Build
echo "🏗️  Building frontend locally..."
cd client
echo "VITE_API_URL=https://bemypcp.com/api" > .env.production.local
npm run build
cd ..

# 2. Sync Static Files
echo "📤 Syncing static files to server..."
ssh $SSH_OPTS $USER@$HOST "mkdir -p $DIR/deploy/static"

LOCAL_DIST="$(pwd)/client/dist/"
echo "Syncing from $LOCAL_DIST to $USER@$HOST:$DIR/deploy/static/"

if [ ! -z "$KEY_PATH" ]; then
  rsync -av --delete -e "ssh -i $KEY_PATH" "$LOCAL_DIST" "$USER@$HOST:$DIR/deploy/static/"
else
  rsync -av --delete "$LOCAL_DIST" "$USER@$HOST:$DIR/deploy/static/"
fi

# Verify files reached the server
echo "🔍 Verifying files on server..."
ssh $SSH_OPTS $USER@$HOST "ls -la $DIR/deploy/static/index.html"

# 3. Server-side API build & restart
echo "⚙️  Updating server code and restarting API..."
ssh $SSH_OPTS $USER@$HOST << EOF
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
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  
  echo "⏳ Waiting for database to be healthy..."
  for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml exec -T db pg_isready -U emr_user -d emr_db > /dev/null 2>&1; then
      echo "✅ Database is ready!"
      break
    fi
    echo "Still waiting... ($i/30)"
    sleep 2
  done

  echo "🗄️  Applying database schema fixes..."
  docker compose -f docker-compose.prod.yml exec -T db psql -U emr_user -d emr_db < $DIR/fix_schema.sql || echo "⚠️ Warning: Schema fix failed."

  echo "🏢 Setting up Multi-Tenancy Control Database..."
  docker compose -f docker-compose.prod.yml exec -T db psql -U emr_user -d emr_db < $DIR/control_schema.sql || echo "⚠️ Warning: Control schema failed."
  docker compose -f docker-compose.prod.yml exec -T db psql -U emr_user -d emr_db < $DIR/seed_multi_tenancy.sql || echo "⚠️ Warning: Multi-tenancy seeding failed."

  echo "🧹 Cleanup..."
  docker image prune -f
EOF

echo "✅ Ultra-fast deployment complete!"
echo "🌍 Visit https://bemypcp.com"
