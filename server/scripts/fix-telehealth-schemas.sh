#!/bin/bash
HOST="pagemdemr.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  echo "Usage: ./fix-telehealth-schemas.sh [path_to_key]"
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_telehealth_fix
chmod 600 /tmp/deploy_key_telehealth_fix
KEY_PATH="/tmp/deploy_key_telehealth_fix"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << 'EOF'
  echo "Fixing telehealth columns and constraints in all clinic schemas..."
  
  # Get all tenant schemas
  SCHEMAS=$(docker exec emr-db psql -U emr_user -d emr_db -t -c "SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname LIKE 'tenant_%';")
  
  for SCHEMA in $SCHEMAS; do
    echo "Processing $SCHEMA..."
    docker exec emr-db psql -U emr_user -d emr_db -c "
      SET search_path TO $SCHEMA, public;
      
      -- Add visit_method to appointments
      DO \$\$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='visit_method'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN visit_method VARCHAR(20) DEFAULT 'office';
        END IF;
      END \$\$;

      -- Update appointments_appointment_type_check if it exists
      DO \$\$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_appointment_type_check') THEN
          ALTER TABLE appointments DROP CONSTRAINT appointments_appointment_type_check;
        END IF;
        
        ALTER TABLE appointments ADD CONSTRAINT appointments_appointment_type_check 
          CHECK (appointment_type IN ('Follow-up', 'New Patient', 'Sick Visit', 'Physical', 'Telehealth Visit', 'Other'));
      END \$\$;

      -- Add visit_method to portal_appointment_requests
      DO \$\$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='portal_appointment_requests' AND column_name='visit_method'
        ) THEN
          ALTER TABLE portal_appointment_requests 
          ADD COLUMN visit_method VARCHAR(20) DEFAULT 'office';
        END IF;
      END \$\$;
    "
  done
EOF

rm /tmp/deploy_key_telehealth_fix
