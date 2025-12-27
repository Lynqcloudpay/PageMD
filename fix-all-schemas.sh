#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_fix_all
chmod 600 /tmp/deploy_key_fix_all
KEY_PATH="/tmp/deploy_key_fix_all"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "Fixing all clinic schemas..."
  
  # Get all tenant schemas
  SCHEMAS=\$(docker exec emr-db psql -U emr_user -d emr_db -t -c "SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname LIKE 'tenant_%';")
  
  for SCHEMA in \$SCHEMAS; do
    echo "Processing \$SCHEMA..."
    docker exec emr-db psql -U emr_user -d emr_db -c "
      SET search_path TO \$SCHEMA, public;
      
      CREATE TABLE IF NOT EXISTS roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(50) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO roles (name, description) VALUES 
          ('admin', 'Clinic Administrator'),
          ('clinician', 'Healthcare Provider'),
          ('staff', 'Clinic Staff')
      ON CONFLICT (name) DO NOTHING;

      -- Ensure users table has role_id and status
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

      -- If role_id is null, try to map from role string
      UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'admin') WHERE role = 'admin' AND role_id IS NULL;
      UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'clinician') WHERE role IN ('clinician', 'doctor', 'provider') AND role_id IS NULL;
      
      -- Set is_admin true for admin role
      UPDATE users SET is_admin = true WHERE role = 'admin';

      CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID,
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(50),
          entity_id UUID,
          details JSONB,
          ip_address VARCHAR(45),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    "
  done
EOF

rm /tmp/deploy_key_fix_all
