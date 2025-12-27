#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_final
chmod 600 /tmp/deploy_key_final
KEY_PATH="/tmp/deploy_key_final"

# Base64 of 'CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS'
B64_PASS="Q0hBTkdFX01FX1NUUk9OR19QQVNTV09SRF9NSU5fMzJfQ0hBUlM="

echo "🔧 Applying final tenant fixes on $HOST..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "🔑 Updating tenant database password..."
  docker exec emr-db psql -U emr_user -d emr_db -c "UPDATE clinic_db_connections SET db_password_encrypted = '$B64_PASS' WHERE db_user = 'emr_user';"

  echo "🏗 Running migrations on emr_db..."
  # We force DB_NAME and DB_HOST because migrate.js defaults differ from our container setup
  # DB_HOST=db (service name)
  # DB_NAME=emr_db
  # DB_PASSWORD needs to be passed explicitly or it uses "postgres" default from migrate.js
  
  docker exec -e DB_HOST=db -e DB_NAME=emr_db -e DB_USER=emr_user -e DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS emr-api node scripts/migrate.js

  echo "👤 Seeding User: meljrodriguez14@gmail.com..."
  # Password hash for 'PageMD2024!Admin' (from seed_platform_admin.sql) is:
  # \$2b\$10\$8OKQXfYrC3N9EwYJHc6pEuZL5Ej9nz6KH.YX3.2BZHu4kXt5UzJDS
  # We will use the same password.
  
  HASH="\$2b\$10\$8OKQXfYrC3N9EwYJHc6pEuZL5Ej9nz6KH.YX3.2BZHu4kXt5UzJDS"
  
  # Check if roles table exists and get admin role id if needed, 
  # but current user schema in migrate.js uses string 'role', not 'role_id'.
  # Let's check migrate.js again.
  # Line 26: role VARCHAR(50) NOT NULL CHECK (role IN ('clinician', 'nurse', 'front_desk', 'admin'))
  
  docker exec -i emr-db psql -U emr_user -d emr_db << SQL
    INSERT INTO users (
        email, 
        password_hash, 
        first_name, 
        last_name, 
        role, 
        active
    ) VALUES (
        'meljrodriguez14@gmail.com',
        '$HASH',
        'Mel',
        'Rodriguez',
        'admin',
        true
    ) ON CONFLICT (email) DO UPDATE SET 
        password_hash = '$HASH',
        role = 'admin',
        active = true;
SQL
  
  echo "✅ Tenant Fixes Complete."
EOF

rm /tmp/deploy_key_final
