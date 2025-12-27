#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_reset
chmod 600 /tmp/deploy_key_reset
KEY_PATH="/tmp/deploy_key_reset"

# New hash for 'admin123' (bcrypt)
HASH="\$2b\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  docker exec -i emr-db psql -U emr_user -d emr_db -c "UPDATE super_admins SET password_hash = '$HASH' WHERE email = 'admin@pagemd.com';"
EOF

rm /tmp/deploy_key_reset
