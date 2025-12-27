#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_inspect_env
chmod 600 /tmp/deploy_key_inspect_env
KEY_PATH="/tmp/deploy_key_inspect_env"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🔍 Checking DATABASE_URL in emr-api..."
  docker exec emr-api sh -c 'echo \$DATABASE_URL'
EOF

rm /tmp/deploy_key_inspect_env
