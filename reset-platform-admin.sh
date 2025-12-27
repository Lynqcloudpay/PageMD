#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_reset_admin
chmod 600 /tmp/deploy_key_reset_admin
KEY_PATH="/tmp/deploy_key_reset_admin"

echo "🔐 Resetting Platform Admin on $HOST..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "1. Checking if emr_db exists (it should)..."
  docker exec emr-db psql -U emr_user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='emr_db'"
  
  echo "2. Re-seeding Platform Admin User..."
  # We use the content from the local file, effectively
  # Hash is for 'PageMD2024!Admin'
  HASH="\\\$2b\\\$10\\\$8OKQXfYrC3N9EwYJHc6pEuZL5Ej9nz6KH.YX3.2BZHu4kXt5UzJDS"
  
  docker exec -i emr-db psql -U emr_user -d emr_db << SQL
    INSERT INTO super_admins (
        email,
        password_hash,
        first_name,
        last_name,
        role,
        is_active
    )
    VALUES (
        'admin@pagemd.com',
        '$HASH',
        'Platform',
        'Administrator',
        'super_admin',
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        password_hash = '$HASH',
        role = 'super_admin',
        is_active = true;
        
    -- Check result
    SELECT email, role, is_active FROM super_admins WHERE email = 'admin@pagemd.com';
SQL

  echo "✅ Platform Admin Reset Complete."
EOF

rm /tmp/deploy_key_reset_admin
