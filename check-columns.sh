#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_chk_col
chmod 600 /tmp/deploy_key_chk_col
KEY_PATH="/tmp/deploy_key_chk_col"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🔍 Checking clinic_subscriptions columns:"
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT column_name FROM information_schema.columns WHERE table_name='clinic_subscriptions';"
EOF

rm /tmp/deploy_key_chk_col
