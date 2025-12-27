#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_mig_schema
chmod 600 /tmp/deploy_key_mig_schema
KEY_PATH="/tmp/deploy_key_mig_schema"

echo "🔐 Running Schema Migration for Multi-tenancy..."

scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "/Volumes/Mel's SSD/paper emr/schema-migration.sql" $USER@$HOST:/home/ubuntu/emr/schema-migration.sql

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  cat /home/ubuntu/emr/schema-migration.sql | docker exec -i emr-db psql -U emr_user -d emr_db
  rm /home/ubuntu/emr/schema-migration.sql
  
  echo "✅ Migration Complete. Verifying..."
  docker exec emr-db psql -U emr_user -d emr_db -c "SELECT slug, schema_name FROM clinics;"
EOF

rm /tmp/deploy_key_mig_schema
