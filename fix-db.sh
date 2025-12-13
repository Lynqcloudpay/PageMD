#!/bin/bash
# fix-db.sh
# Fixes PostgreSQL SSL permissions and debugs startup issues

echo "🛑 Stopping containers..."
cd deploy
docker compose -f docker-compose.prod.yml down

echo "🔧 Fixing PostgreSQL permissions using the postgres image..."
# Use the exact same image to ensure UIDs match perfectly
# Use the updated volume mapping to fix certs independently of data
docker run --rm \
  -v emr_postgres_certs:/var/lib/postgresql/certs \
  --entrypoint sh \
  postgres:15-alpine \
  -c "
    echo 'Files in certs dir:'
    ls -la /var/lib/postgresql/certs/server.*
    
    echo 'Key file existence check:'
    # Create directory for certs if it doesn't exist (it should be the volume root)
    mkdir -p /var/lib/postgresql/certs

    # Remove old files if they exist to be safe
    rm -f /var/lib/postgresql/certs/server.crt
    rm -f /var/lib/postgresql/certs/server.key
    rm -f /var/lib/postgresql/certs/ca.crt

    if [ ! -f /var/lib/postgresql/certs/server.key ]; then
        echo '❌ server.key missing! Generating new certificates in certs volume...'
        apk add --no-cache openssl
        openssl req -new -x509 -days 365 -nodes \
            -text -out /var/lib/postgresql/certs/server.crt \
            -keyout /var/lib/postgresql/certs/server.key \
            -subj '/CN=postgres'
        cp /var/lib/postgresql/certs/server.crt /var/lib/postgresql/certs/ca.crt
    fi

    echo 'Correcting ownership to postgres user...'
    # Ensure postgres user owns the certs
    chown -R postgres:postgres /var/lib/postgresql/certs
    
    echo 'Setting strict mode 0600 on key...'
    chmod 600 /var/lib/postgresql/certs/server.key
    
    echo 'Verification:'
    ls -la /var/lib/postgresql/certs/server.key
  "

echo "🚀 Starting database..."
docker compose -f docker-compose.prod.yml up -d db

echo "⏳ Waiting for database to start (10s)..."
sleep 10

echo "🔍 Checking database logs (last 50 lines)..."
docker compose -f docker-compose.prod.yml logs --tail=50 db

echo "🩺 Checking container status..."
docker compose -f docker-compose.prod.yml ps

echo "🚀 If DB is healthy, starting the rest..."
if docker compose -f docker-compose.prod.yml ps db | grep -q "(healthy)"; then
    docker compose -f docker-compose.prod.yml up -d
    echo "✅ All services started."
else
    echo "❌ Database is still unhealthy. Check the logs above."
fi
