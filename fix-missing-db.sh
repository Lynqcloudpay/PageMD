#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  echo "❌ No key path provided."
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_fixdb
chmod 600 /tmp/deploy_key_fixdb
KEY_PATH="/tmp/deploy_key_fixdb"

echo "🔧 Checking and Fixing Database on $HOST..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🔎 Listing Databases..."
  # Connect to default 'postgres' db to check others
  docker exec emr-db psql -U emr_user -d postgres -c "\l"
  
  echo "🛠 Checking for emr_db..."
  if ! docker exec emr-db psql -U emr_user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='emr_db'" | grep -q 1; then
      echo "⚠️ emr_db NOT FOUND. Creating it..."
      docker exec emr-db psql -U emr_user -d postgres -c "CREATE DATABASE emr_db;"
      echo "✅ emr_db created."
  else
      echo "✅ emr_db already exists."
  fi
  
  echo "📥 Seeding Control Schema (Platform Admin tables)..."
  # We need to pipe the schema file into the docker container
  # Since the file is local, we need to handle this carefully.
  # We will use the copy we pushed to the server via git.
  
  cd /home/ubuntu/emr/deploy
  
  # Check if control_schema.sql exists in parent dir (it should, from git pull)
  if [ -f ../control_schema.sql ]; then
      echo "found ../control_schema.sql"
      cat ../control_schema.sql | docker exec -i emr-db psql -U emr_user -d emr_db
  else
      echo "❌ ../control_schema.sql not found!"
  fi
  
  echo "📥 Seeding Platform Admin User..."
  if [ -f ../seed_platform_admin.sql ]; then
      cat ../seed_platform_admin.sql | docker exec -i emr-db psql -U emr_user -d emr_db
  else
       echo "❌ ../seed_platform_admin.sql not found!"
  fi

  echo "🔄 Restarting API..."
  docker compose -f docker-compose.prod.yml restart api
EOF

rm /tmp/deploy_key_fixdb
echo "✅ Database fix complete."
