#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  echo "Usage: $0 <key_path>"
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_orders
chmod 600 /tmp/deploy_key_orders
KEY_PATH="/tmp/deploy_key_orders"

echo "🚀 Starting Orders System Migration & Seeding..."

# 1. Transfer the migration SQL and seeding script
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
    "/Volumes/Mel's SSD/paper emr/server/scripts/migrations/20251222_orders_system.sql" \
    "/Volumes/Mel's SSD/paper emr/server/scripts/orders/seed_cardiology.js" \
    $USER@$HOST:/home/ubuntu/emr/

# 2. Run the migration SQL
echo "📑 Running SQL Migration..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  cat /home/ubuntu/emr/20251222_orders_system.sql | docker exec -i emr-db psql -U emr_user -d emr_db
  rm /home/ubuntu/emr/20251222_orders_system.sql
EOF

# 3. Run the Seeding Script
echo "🌱 Seeding Cardiology Orders..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  docker cp /home/ubuntu/emr/seed_cardiology.js emr-api:/app/scripts/seed_cardiology.js
  docker exec -i emr-api node scripts/seed_cardiology.js
  rm /home/ubuntu/emr/seed_cardiology.js
EOF

echo "✅ Orders System Ready."

# 4. Verify
echo "🔍 Verifying tables:"
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'orders_%' OR table_name = 'visit_orders';"
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT count(*) FROM orders_catalog;"
EOF

rm /tmp/deploy_key_orders
