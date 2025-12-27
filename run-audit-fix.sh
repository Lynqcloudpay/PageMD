#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_audit_fix
chmod 600 /tmp/deploy_key_audit_fix
KEY_PATH="/tmp/deploy_key_audit_fix"

echo "🔐 Fixing missing table on $HOST..."

# scp the sql file
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "/Volumes/Mel's SSD/paper emr/fix-audit-logs.sql" $USER@$HOST:/home/ubuntu/emr/fix-audit-logs.sql

# run it
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  cat /home/ubuntu/emr/fix-audit-logs.sql | docker exec -i emr-db psql -U emr_user -d emr_db
  
  # Verify existence
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT count(*) FROM platform_audit_logs;"
  
  rm /home/ubuntu/emr/fix-audit-logs.sql
EOF

rm /tmp/deploy_key_audit_fix
