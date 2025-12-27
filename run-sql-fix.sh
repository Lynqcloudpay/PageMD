#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_sql_fix
chmod 600 /tmp/deploy_key_sql_fix
KEY_PATH="/tmp/deploy_key_sql_fix"

echo "🔐 Uploading and applying SQL fix..."

# scp the sql file
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "/Volumes/Mel's SSD/paper emr/fix_admin_hash.sql" $USER@$HOST:/home/ubuntu/emr/fix_admin_hash.sql

# run it
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  cat /home/ubuntu/emr/fix_admin_hash.sql | docker exec -i emr-db psql -U emr_user -d emr_db
  
  # Verify
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT email, password_hash FROM super_admins WHERE email = 'admin@pagemd.com';"
  
  rm /home/ubuntu/emr/fix_admin_hash.sql
EOF

rm /tmp/deploy_key_sql_fix
