#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_new_hash
chmod 600 /tmp/deploy_key_new_hash
KEY_PATH="/tmp/deploy_key_new_hash"

echo "🔐 Setting valid hash for Platform Admin on $HOST..."

# Generated hash from local test: $2b$10$VCC76qeIsEzNQEMtj5k/xeR9mTPzfDXCDdKKzR3QkbrmXibTs5oPq
# Need to escape $ for ssh
HASH="\$2b\$10\$VCC76qeIsEzNQEMtj5k/xeR9mTPzfDXCDdKKzR3QkbrmXibTs5oPq"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  docker exec -i emr-db psql -U emr_user -d emr_db << SQL
    UPDATE super_admins SET password_hash = '$HASH' WHERE email = 'admin@pagemd.com';
    SELECT email, password_hash FROM super_admins WHERE email = 'admin@pagemd.com';
SQL
  echo "✅ Hash updated."
EOF

rm /tmp/deploy_key_new_hash
