#!/bin/bash
# Script to add DoseSpot environment variables to production server

HOST="bemypcp.com"
USER="ubuntu"
DEPLOY_DIR="/home/ubuntu/emr/deploy"

# Try to find SSH key
KEY_PATH=""
for key in temp_deploy_key ~/.ssh/id_rsa ~/.ssh/id_ed25519 deploy_key; do
    if [ -f "$key" ]; then
        KEY_PATH="$key"
        break
    fi
done

if [ -z "$KEY_PATH" ]; then
    echo "❌ No SSH key found. Please provide path to SSH key:"
    read -p "SSH key path: " KEY_PATH
    if [ ! -f "$KEY_PATH" ]; then
        echo "❌ Key file not found: $KEY_PATH"
        exit 1
    fi
fi

echo "🔐 Connecting to server..."
echo "📝 Adding DoseSpot environment variables..."

# Create a script to append to .env.prod
ssh -i "$KEY_PATH" -o ConnectTimeout=15 -o StrictHostKeyChecking=no $USER@$HOST << 'ENDSSH'
cd /home/ubuntu/emr/deploy

# Check if .env.prod exists, if not copy from example
if [ ! -f .env.prod ]; then
    echo "📋 Creating .env.prod from template..."
    cp env.prod.example .env.prod
fi

# Check if DoseSpot variables already exist
if grep -q "EPRESCRIBE_PROVIDER" .env.prod; then
    echo "⚠️  DoseSpot variables already exist in .env.prod"
    echo "Current values:"
    grep -E "EPRESCRIBE|DOSESPOT" .env.prod
    echo ""
    read -p "Do you want to update them? (y/n): " update
    if [ "$update" != "y" ]; then
        echo "Skipping update."
        exit 0
    fi
    # Remove old values
    sed -i '/^# ============================================$/d' .env.prod
    sed -i '/^# ePrescribing (DoseSpot)$/d' .env.prod
    sed -i '/^EPRESCRIBE_PROVIDER=/d' .env.prod
    sed -i '/^DOSESPOT_BASE_URL=/d' .env.prod
    sed -i '/^DOSESPOT_CLIENT_ID=/d' .env.prod
    sed -i '/^DOSESPOT_CLIENT_SECRET=/d' .env.prod
    sed -i '/^DOSESPOT_CLINIC_ID=/d' .env.prod
    sed -i '/^DOSESPOT_WEBHOOK_SECRET=/d' .env.prod
    sed -i '/^EPRESCRIBE_EPCS_ENABLED=/d' .env.prod
fi

# Add DoseSpot section before the Notes section
if grep -q "^# ============================================$" .env.prod && grep -q "^# Notes$" .env.prod; then
    # Insert before Notes section
    sed -i '/^# ============================================$/i\
# ============================================\
# ePrescribing (DoseSpot)\
# ============================================\
# EPRESCRIBE_PROVIDER can be '\''dosespot'\'' or '\''internal'\''\
EPRESCRIBE_PROVIDER=internal\
\
# DoseSpot API configuration (fill from vendor portal)\
DOSESPOT_BASE_URL=https://api.dosespot.com\
DOSESPOT_CLIENT_ID=CHANGE_ME_DOSESPOT_CLIENT_ID\
DOSESPOT_CLIENT_SECRET=CHANGE_ME_DOSESPOT_CLIENT_SECRET\
DOSESPOT_CLINIC_ID=CHANGE_ME_DOSESPOT_CLINIC_ID\
DOSESPOT_WEBHOOK_SECRET=CHANGE_ME_WEBHOOK_SECRET\
\
# Enable EPCS (controlled substances) once vendor + Surescripts certification complete\
EPRESCRIBE_EPCS_ENABLED=false\
' .env.prod
else
    # Append to end of file
    cat >> .env.prod << 'EOF'

# ============================================
# ePrescribing (DoseSpot)
# ============================================
# EPRESCRIBE_PROVIDER can be 'dosespot' or 'internal'
EPRESCRIBE_PROVIDER=internal

# DoseSpot API configuration (fill from vendor portal)
DOSESPOT_BASE_URL=https://api.dosespot.com
DOSESPOT_CLIENT_ID=CHANGE_ME_DOSESPOT_CLIENT_ID
DOSESPOT_CLIENT_SECRET=CHANGE_ME_DOSESPOT_CLIENT_SECRET
DOSESPOT_CLINIC_ID=CHANGE_ME_DOSESPOT_CLINIC_ID
DOSESPOT_WEBHOOK_SECRET=CHANGE_ME_WEBHOOK_SECRET

# Enable EPCS (controlled substances) once vendor + Surescripts certification complete
EPRESCRIBE_EPCS_ENABLED=false
EOF
fi

echo "✅ Added DoseSpot variables to .env.prod"
echo ""
echo "📋 Current DoseSpot configuration:"
grep -E "EPRESCRIBE|DOSESPOT" .env.prod
echo ""
echo "⚠️  Remember to:"
echo "   1. Update the CHANGE_ME_* values with your actual DoseSpot credentials"
echo "   2. Set EPRESCRIBE_PROVIDER=dosespot when ready to use DoseSpot"
echo "   3. Restart the API container: docker-compose -f docker-compose.prod.yml restart api"
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully added DoseSpot variables to server!"
    echo ""
    echo "Next steps:"
    echo "1. SSH into server and edit .env.prod with your actual DoseSpot credentials"
    echo "2. Restart API: ssh -i $KEY_PATH $USER@$HOST 'cd /home/ubuntu/emr/deploy && docker-compose -f docker-compose.prod.yml restart api'"
else
    echo "❌ Failed to add variables. Check SSH connection and permissions."
    exit 1
fi

