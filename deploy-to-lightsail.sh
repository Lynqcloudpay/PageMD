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
  
  echo "🔑 Ensuring DB SSL certificates exist..."
  
  echo "📝 Setting up frontend environment variables..."
  # Create .env.production for the frontend build
  # This ensures VITE_API_URL is baked into the static files
  echo "VITE_API_URL=https://bemypcp.com/api" > ../client/.env.production
  # Fix for existing databases where init-db.sh won't run
  # We use a temporary alpine container to generate certs in the volume if they are missing
  # Note: Must match the volume name and path in docker-compose.prod.yml
  docker run --rm -v emr_postgres_certs:/var/lib/postgresql/certs alpine sh -c "
    if [ ! -f /var/lib/postgresql/certs/server.key ]; then 
      echo 'Generating missing SSL certs...'; 
      apk add --no-cache openssl; 
      openssl req -new -x509 -days 365 -nodes -text -out /var/lib/postgresql/certs/server.crt -keyout /var/lib/postgresql/certs/server.key -subj '/CN=postgres'; 
      chmod 600 /var/lib/postgresql/certs/server.key; 
      chmod 644 /var/lib/postgresql/certs/server.crt; 
      cp /var/lib/postgresql/certs/server.crt /var/lib/postgresql/certs/ca.crt; 
      chown 70:70 /var/lib/postgresql/certs/server.*; 
      chown 70:70 /var/lib/postgresql/certs/ca.crt;
      echo 'Certs generated successfully'; 
    else 
      echo 'Certs already exist'; 
    fi"

  echo "🔄 Restarting services..."
  # Rebuild api and web containers
  docker compose -f docker-compose.prod.yml up -d --build --force-recreate
  
  echo "✅ Deployment complete!"
  echo "🌍 Checking site status..."
  curl -I https://bemypcp.com
EOF
