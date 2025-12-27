#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_seed_def
chmod 600 /tmp/deploy_key_seed_def
KEY_PATH="/tmp/deploy_key_seed_def"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "Provisioning tenant_default schema with tables..."
  # Use the same logic as TenantManager but for the existing default schema
  docker exec emr-db psql -U emr_user -d emr_db -c "
    SET search_path TO tenant_default, public;
    
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

    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50),
        role_id UUID REFERENCES roles(id),
        is_admin BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active',
        active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Seed a default admin if missing
    INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin)
    VALUES ('meljrodriguez14@gmail.com', '\\\$2a\\\$10\\\$7vKzJzWcK6Qn8X1J8f5U9.qX... (placeholder or actual hash)', 'Mel', 'Rodriguez', 'admin', true)
    ON CONFLICT (email) DO NOTHING;
  "
EOF

rm /tmp/deploy_key_seed_def
