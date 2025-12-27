#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_seed_default
chmod 600 /tmp/deploy_key_seed_default
KEY_PATH="/tmp/deploy_key_seed_default"

echo "🌱 Seeding default clinic on $HOST..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
   # Copy local seed file content to server and pipe to psql
   echo "INSERT INTO clinics (slug, display_name, legal_name, specialty, status) VALUES ('default', 'My Practice', 'My Practice, LLC', 'Primary Care', 'active') ON CONFLICT (slug) DO NOTHING;" | docker exec -i emr-db psql -U emr_user -d emr_db
   
   echo "INSERT INTO clinic_db_connections (clinic_id, host, port, db_name, db_user, db_password_encrypted) SELECT id, 'emr-db', 5432, 'emr_db', 'emr_user', 'placeholder' FROM clinics WHERE slug = 'default' ON CONFLICT (clinic_id) DO NOTHING;" | docker exec -i emr-db psql -U emr_user -d emr_db
   
   echo "INSERT INTO clinic_settings (clinic_id) SELECT id FROM clinics WHERE slug = 'default' ON CONFLICT (clinic_id) DO NOTHING;" | docker exec -i emr-db psql -U emr_user -d emr_db

   echo "✅ Default clinic seeded."
EOF

rm /tmp/deploy_key_seed_default
