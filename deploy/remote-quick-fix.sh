#!/bin/bash
# Remote quick fix - run from your local machine
# Usage: ./deploy/remote-quick-fix.sh [command]
# Commands: status, fix-502, restart, deploy

KEY_PATH="${1:-temp_deploy_key}"
COMMAND="${2:-status}"

if [ ! -f "$KEY_PATH" ]; then
    echo "❌ SSH key not found: $KEY_PATH"
    echo "Usage: $0 [key_path] [command]"
    echo "Commands: status, fix-502, restart, deploy"
    exit 1
fi

HOST="pagemdemr.com"
USER="ubuntu"

case "$COMMAND" in
    status)
        echo "📊 Checking server status..."
        ssh -i "$KEY_PATH" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $USER@$HOST "cd /home/ubuntu/emr/deploy && bash quick-status.sh" 2>&1
        ;;
    fix-502)
        echo "🔧 Fixing 502 error..."
        ssh -i "$KEY_PATH" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $USER@$HOST "cd /home/ubuntu/emr/deploy && bash fix-502.sh" 2>&1
        ;;
    restart)
        echo "⚡ Quick restart..."
        ssh -i "$KEY_PATH" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $USER@$HOST "cd /home/ubuntu/emr/deploy && bash quick-restart.sh" 2>&1
        ;;
    deploy)
        echo "🚀 Fast deployment..."
        ssh -i "$KEY_PATH" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $USER@$HOST "cd /home/ubuntu/emr/deploy && bash fast-deploy.sh" 2>&1
        ;;
    *)
        echo "❌ Unknown command: $COMMAND"
        echo "Commands: status, fix-502, restart, deploy"
        exit 1
        ;;
esac



