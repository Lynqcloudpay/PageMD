#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  echo "❌ No key path provided."
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_caddy
chmod 600 /tmp/deploy_key_caddy
KEY_PATH="/tmp/deploy_key_caddy"

echo "🔎 Checking Caddy and API status on $HOST..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "📊 Container Status:"
  docker ps -a
  
  echo "🌐 Checking Caddy Logs:"
  docker logs emr-caddy --tail 50

  echo "🔌 Checking open ports on server:"
  netstat -tulpn | grep -E '80|443'
EOF

rm /tmp/deploy_key_caddy
