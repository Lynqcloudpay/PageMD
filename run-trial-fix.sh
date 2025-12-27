#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_trial_fix
chmod 600 /tmp/deploy_key_trial_fix
KEY_PATH="/tmp/deploy_key_trial_fix"

echo "🔐 Fixing trial_end_date column on $HOST..."

# scp the sql file
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "/Volumes/Mel's SSD/paper emr/fix-trial-date.sql" $USER@$HOST:/home/ubuntu/emr/fix-trial-date.sql

# run it
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  cat /home/ubuntu/emr/fix-trial-date.sql | docker exec -i emr-db psql -U emr_user -d emr_db
  
  rm /home/ubuntu/emr/fix-trial-date.sql
  
  echo "Verify columns:"
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT column_name FROM information_schema.columns WHERE table_name='clinic_subscriptions';"
EOF

rm /tmp/deploy_key_trial_fix
