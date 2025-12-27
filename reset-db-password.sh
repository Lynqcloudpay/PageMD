#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_reset_pass
chmod 600 /tmp/deploy_key_reset_pass
KEY_PATH="/tmp/deploy_key_reset_pass"

# The password we WANT to use (matches the one in API env)
PASS="CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS"
# The base64 version for clinic_db_connections (TenantManager uses this)
B64_PASS="Q0hBTkdFX01FX1NUUk9OR19QQVNTV09SRF9NSU5fMzJfQ0hBUlM="

echo "🔐 Resetting DB password on $HOST..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  echo "1. Resetting Postgres User Password..."
  # We use the postgres superuser (via docker exec) to reset the app user password
  # Note: The container default superuser is usually 'postgres' or the one defined in POSTGRES_USER.
  # Based on docker-compose, POSTGRES_USER defaults to 'emr_user'.
  # If 'emr_user' is the superuser, we can't log in if we don't know the password!
  
  # BUT, we can use 'docker exec' to run psql locally inside the container.
  # Local connections via unix socket often use 'trust' auth in docker images, or we can use PGUSER.
  # Let's try connecting as the user without password (trust) or use the POSTGRES_USER env var if known.
  
  # Wait, if POSTGRES_USER is emr_user, then that IS the superuser.
  # If we can't auth, we can't change it.
  
  # However, standard postgres images allow 'postgres' user via local socket if not overridden, 
  # or we can edit pg_hba.conf to trust.
  
  # Let's try to assume 'trust' on local socket.
  # We'll use 'postgres' user just in case it exists, or 'emr_user'.
  
  # Try blindly altering emr_user password using emr_user (assuming trusted local connection)
  echo "Attempting to reset password for emr_user..."
  docker exec emr-db psql -U emr_user -d postgres -c "ALTER USER emr_user WITH PASSWORD '$PASS';"
  
  # If that fails (peer authentication failed), we might need to edit pg_hba.conf to trust temporarily.
  
  echo "2. Ensuring clinic_db_connections matches..."
  docker exec emr-db psql -U emr_user -d emr_db -c "UPDATE clinic_db_connections SET db_password_encrypted = '$B64_PASS' WHERE db_user = 'emr_user';"

  echo "✅ Password reset attempted."
EOF

rm /tmp/deploy_key_reset_pass
