#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  echo "❌ No key path provided."
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_chk
chmod 600 /tmp/deploy_key_chk
KEY_PATH="/tmp/deploy_key_chk"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "📜 API Logs (last 50):"
  docker logs emr-api --tail 50
EOF

rm /tmp/deploy_key_chk
