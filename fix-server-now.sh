#!/bin/bash
# Complete fix: upload scripts and fix 502 error
# Usage: ./fix-server-now.sh

KEY_PATH="temp_deploy_key"
HOST="bemypcp.com"
USER="ubuntu"

if [ ! -f "$KEY_PATH" ]; then
    echo "❌ SSH key not found: $KEY_PATH"
    exit 1
fi

echo "📤 Uploading quick-fix scripts to server..."
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no deploy/quick-status.sh deploy/fix-502.sh deploy/quick-restart.sh deploy/fast-deploy.sh $USER@$HOST:/home/ubuntu/emr/deploy/

echo "🔧 Running 502 fix..."
ssh -i "$KEY_PATH" -o ConnectTimeout=10 -o StrictHostKeyChecking=no $USER@$HOST << 'EOF'
cd /home/ubuntu/emr/deploy
chmod +x *.sh
bash fix-502.sh
EOF

echo "✅ Done! Check status with: ./deploy/remote-quick-fix.sh $KEY_PATH status"



