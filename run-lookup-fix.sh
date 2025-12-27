#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_lookup
chmod 600 /tmp/deploy_key_lookup
KEY_PATH="/tmp/deploy_key_lookup"

# Copy SQL to server
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "$(dirname "$0")/create-user-lookup.sql" $USER@$HOST:/home/ubuntu/emr/create-user-lookup.sql

# Run SQL
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  docker exec -i emr-db psql -U emr_user -d emr_db < /home/ubuntu/emr/create-user-lookup.sql
EOF

rm /tmp/deploy_key_lookup
