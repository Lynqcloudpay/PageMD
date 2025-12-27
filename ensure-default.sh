#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_ensure_default
chmod 600 /tmp/deploy_key_ensure_default
KEY_PATH="/tmp/deploy_key_ensure_default"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "Ensuring tenant_default schema exists..."
  docker exec emr-db psql -U emr_user -d emr_db -c "CREATE SCHEMA IF NOT EXISTS tenant_default;"
EOF

rm /tmp/deploy_key_ensure_default
