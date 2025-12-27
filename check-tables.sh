#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_check_tables
chmod 600 /tmp/deploy_key_check_tables
KEY_PATH="/tmp/deploy_key_check_tables"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🔍 Checking for clinic_usage_metrics table..."
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT to_regclass('public.clinic_usage_metrics');"
EOF

rm /tmp/deploy_key_check_tables
