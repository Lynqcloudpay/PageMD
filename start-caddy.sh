#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_start
chmod 600 /tmp/deploy_key_start
KEY_PATH="/tmp/deploy_key_start"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🚀 Starting Caddy..."
  cd /home/ubuntu/emr/deploy
  docker compose -f docker-compose.prod.yml up -d caddy
  sleep 5
  docker ps | grep caddy
EOF

rm /tmp/deploy_key_start
