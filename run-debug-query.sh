#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_debug_node
chmod 600 /tmp/deploy_key_debug_node
KEY_PATH="/tmp/deploy_key_debug_node"

echo "🔐 Copying and running debug script..."

scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "/Volumes/Mel's SSD/paper emr/debug-query.js" $USER@$HOST:/home/ubuntu/emr/debug-query.js

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  docker cp /home/ubuntu/emr/debug-query.js emr-api:/app/debug-query.js
  docker exec emr-api node /app/debug-query.js
  
  rm /home/ubuntu/emr/debug-query.js
EOF

rm /tmp/deploy_key_debug_node
