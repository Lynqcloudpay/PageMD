#!/bin/bash
# Test script to verify SSH connection to Lightsail server
# This helps verify your SSH key works before setting up GitHub Actions

HOST="bemypcp.com"
USER="ubuntu"
KEY_FILE="${1:-~/.ssh/id_rsa}"

echo "🔐 Testing SSH connection to $USER@$HOST..."
echo ""

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ SSH key file not found: $KEY_FILE"
    echo ""
    echo "Usage: $0 [path_to_ssh_key]"
    echo "Example: $0 ~/.ssh/lightsail_key.pem"
    exit 1
fi

# Test SSH connection
echo "Testing connection..."
ssh -i "$KEY_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no $USER@$HOST << 'EOF'
    echo "✅ SSH connection successful!"
    echo ""
    echo "Server information:"
    echo "- Hostname: $(hostname)"
    echo "- User: $(whoami)"
    echo "- Current directory: $(pwd)"
    echo ""
    echo "Checking for app directory..."
    if [ -d "/home/ubuntu/emr" ]; then
        echo "✅ App directory found: /home/ubuntu/emr"
        cd /home/ubuntu/emr
        echo "- Git status:"
        git status 2>/dev/null | head -5 || echo "  (not a git repo or git not available)"
    else
        echo "⚠️  App directory /home/ubuntu/emr not found"
        echo "Available directories:"
        ls -la /home/ubuntu/ | head -10
    fi
    echo ""
    echo "Docker status:"
    docker --version 2>/dev/null || echo "Docker not found"
    docker compose version 2>/dev/null || echo "Docker Compose not found"
EOF

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ SSH connection test passed!"
    echo "You can now safely add the SSH key to GitHub Secrets."
else
    echo ""
    echo "❌ SSH connection failed (exit code: $EXIT_CODE)"
    echo ""
    echo "Troubleshooting:"
    echo "1. Verify the key file path is correct"
    echo "2. Check that the key has correct permissions: chmod 600 $KEY_FILE"
    echo "3. Verify the hostname: $HOST"
    echo "4. Check that your IP is allowed in Lightsail firewall"
    exit $EXIT_CODE
fi







