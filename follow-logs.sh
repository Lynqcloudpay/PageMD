#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_follow_logs
chmod 600 /tmp/deploy_key_follow_logs
KEY_PATH="/tmp/deploy_key_follow_logs"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "📡 Following API logs. Please attempt login now."
  docker logs -f emr-api --tail 0 &
  PID=\$!
  sleep 30  # Wait 30s for user to try login
  kill \$PID
EOF

rm /tmp/deploy_key_follow_logs
