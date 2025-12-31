#!/bin/bash
set -e

# Deploy PageMD Tablet UI to tablet.pagemdemr.com
# This script builds the tablet UI and deploys it to the server

HOST="pagemdemr.com"
USER="ubuntu"
TABLET_DIR="/home/ubuntu/emr/tablet-ui"
INPUT_KEY_PATH="$1"

PROJECT_ROOT="/Volumes/Mel's SSD/paper emr"

echo "🚀 Deploying Tablet UI to tablet.$HOST..."

# Handle Key
if [ ! -z "$INPUT_KEY_PATH" ]; then
  cp "$INPUT_KEY_PATH" /tmp/deploy_key
  chmod 600 /tmp/deploy_key
  KEY_PATH="/tmp/deploy_key"
else
  echo "❌ No key path provided"
  exit 1
fi

# 1. Build Tablet UI
echo "🏗️  Building tablet UI..."
cd "$PROJECT_ROOT/pagemd-tablet-ui"
echo "VITE_API_BASE_URL=https://pagemdemr.com/api" > .env.production.local
npm run build

# 2. Create directory on server
echo "📁 Creating directory on server..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST "mkdir -p $TABLET_DIR"

# 3. Sync built files
echo "📤 Syncing tablet UI to server..."
rsync -av --delete -e "ssh -i $KEY_PATH -o StrictHostKeyChecking=no" \
  "$PROJECT_ROOT/pagemd-tablet-ui/dist/" \
  "$USER@$HOST:$TABLET_DIR/"

# 4. Verify
echo "🔍 Verifying deployment..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST "ls -la $TABLET_DIR/index.html"

echo ""
echo "✅ Tablet UI deployed!"
echo ""
echo "⚠️  IMPORTANT: You still need to:"
echo "   1. Add DNS A record: tablet -> [server IP]"
echo "   2. Add Caddy config for tablet.pagemdemr.com"
echo ""
echo "   Example Caddy config:"
echo "   tablet.pagemdemr.com {"
echo "       root * /home/ubuntu/emr/tablet-ui"
echo "       file_server"
echo "       try_files {path} /index.html"
echo "   }"

rm /tmp/deploy_key
