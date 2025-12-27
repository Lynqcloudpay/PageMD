#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_payment_fix
chmod 600 /tmp/deploy_key_payment_fix
KEY_PATH="/tmp/deploy_key_payment_fix"

echo "🔐 Fixing payments schema on $HOST..."

# scp the sql file
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "/Volumes/Mel's SSD/paper emr/fix-payments-schema.sql" $USER@$HOST:/home/ubuntu/emr/fix-payments-schema.sql

# run it
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  cat /home/ubuntu/emr/fix-payments-schema.sql | docker exec -i emr-db psql -U emr_user -d emr_db
  
  rm /home/ubuntu/emr/fix-payments-schema.sql
  
  echo "Verify tables:"
  docker exec emr-db psql -U emr_user -d emr_db -c "\\dt"
EOF

rm /tmp/deploy_key_payment_fix
