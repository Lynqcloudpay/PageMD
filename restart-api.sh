#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_restart_api
chmod 600 /tmp/deploy_key_restart_api
KEY_PATH="/tmp/deploy_key_restart_api"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🔄 Restarting API to pick up DB connection..."
  cd /home/ubuntu/emr/deploy
  docker compose -f docker-compose.prod.yml restart api
  
  echo "⏳ Waiting for API..."
  sleep 5
  docker ps | grep api
EOF

rm /tmp/deploy_key_restart_api
