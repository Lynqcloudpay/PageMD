#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_sync_api
chmod 600 /tmp/deploy_key_sync_api
KEY_PATH="/tmp/deploy_key_sync_api"

# Same password as we set in DB
# CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS
PASS="CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS"

echo "🔄 Updating API DB_PASSWORD to match DB..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  cd /home/ubuntu/emr/deploy
  
  # Update .env.prod if it exists, or create/update override
  # We should look for docker-compose.prod.yml usage of env vars
  # It uses DB_PASSWORD from .env
  
  if [ -f .env.prod ]; then
    sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=$PASS/' .env.prod
    if ! grep -q "^DB_PASSWORD=" .env.prod; then
      echo "DB_PASSWORD=$PASS" >> .env.prod
    fi
  else
    echo "DB_PASSWORD=$PASS" > .env.prod
  fi

  # Also export it for the current shell just in case we run compose now
  export DB_PASSWORD=$PASS

  echo "🔄 Recreating API container with new env..."
  docker compose -f docker-compose.prod.yml up -d --force-recreate api
  
  echo "⏳ Waiting for API to start..."
  sleep 10
  docker logs emr-api --tail 20
EOF

rm /tmp/deploy_key_sync_api
