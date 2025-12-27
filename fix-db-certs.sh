#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  echo "❌ No key path provided."
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_gen
chmod 600 /tmp/deploy_key_gen
KEY_PATH="/tmp/deploy_key_gen"

echo "🔐 Fixing database SSL certificates on $HOST..."

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  set -e
  
  # Use a temporary alpine container to inspect and populate the volume
  # We assume the volume name is 'deploy_postgres_certs' based on previous output
  
  docker run --rm -v deploy_postgres_certs:/certs alpine sh -c '
    apk add --no-cache openssl
    
    # Check if certs exist
    if [ ! -f /certs/server.key ]; then
      echo "⚠️ Certs missing. Generating new self-signed certificates..."
      
      openssl req -new -x509 -days 365 -nodes \
        -text -out /certs/server.crt \
        -keyout /certs/server.key \
        -subj "/CN=postgres"
      
      # Copy cert to CA
      cp /certs/server.crt /certs/ca.crt
      
      # Fix permissions for Postgres (UID 70 on Alpine)
      # 600 for key is critical, 644 for certs
      chmod 600 /certs/server.key
      chmod 644 /certs/server.crt
      chmod 644 /certs/ca.crt
      chown 70:70 /certs/server.key /certs/server.crt /certs/ca.crt
      
      echo "✅ Certificates generated and permissions fixed."
    else
      echo "ℹ️ Certificates already exist. Resetting permissions just in case..."
      chmod 600 /certs/server.key
      chmod 644 /certs/server.crt
      chown 70:70 /certs/server.key /certs/server.crt /certs/ca.crt
    fi
    
    ls -la /certs
  '
  
  # Restart the database container
  echo "🔄 Restarting emr-db..."
  cd /home/ubuntu/emr/deploy
  docker compose -f docker-compose.prod.yml restart db
  
  echo "⏳ Waiting for DB to start..."
  sleep 5
  
  echo "📜 DB Logs:"
  docker logs emr-db --tail 20
  
  echo "🔄 Restarting API to reconnect..."
  docker compose -f docker-compose.prod.yml restart api
EOF

rm /tmp/deploy_key_gen
echo "✅ Certificate fix complete."
