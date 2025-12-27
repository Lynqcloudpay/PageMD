#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_debug_login
chmod 600 /tmp/deploy_key_debug_login
KEY_PATH="/tmp/deploy_key_debug_login"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🔍 Checking API env vars..."
  docker exec emr-api env | grep DB_
  
  echo "🔍 Checking DB user record directly..."
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT email, password_hash, is_active FROM super_admins WHERE email = 'admin@pagemd.com';"
  
  echo "🔍 Checking API logs for login attempt..."
  docker logs emr-api --tail 50 | grep -i "login"
EOF

rm /tmp/deploy_key_debug_login
