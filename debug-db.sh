#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  echo "❌ No key path provided."
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_debug
chmod 600 /tmp/deploy_key_debug
KEY_PATH="/tmp/deploy_key_debug"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "📜 DB Logs:"
  docker logs emr-db 2>&1 | tail -n 50
EOF

rm /tmp/deploy_key_debug
