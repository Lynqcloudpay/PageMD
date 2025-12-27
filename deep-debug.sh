#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_deep_debug
chmod 600 /tmp/deploy_key_deep_debug
KEY_PATH="/tmp/deploy_key_deep_debug"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🔍 Checking CONTROL_DATABASE_URL..."
  docker exec emr-api sh -c 'echo \$CONTROL_DATABASE_URL'
  
  echo "📜 Recent API Logs (last 100):"
  docker logs emr-api --tail 100
EOF

rm /tmp/deploy_key_deep_debug
