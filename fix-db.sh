#!/bin/bash
# fix-db.sh
# Fixes PostgreSQL SSL permissions and debugs startup issues

echo "🛑 Stopping containers..."
cd deploy
docker compose -f docker-compose.prod.yml down

echo "🔧 Fixing PostgreSQL permissions using the postgres image..."
# Use the exact same image to ensure UIDs match perfectly
docker run --rm -v emr_postgres_data:/var/lib/postgresql/data \
  --entrypoint sh \
  postgres:15-alpine \
  -c "
    echo 'Files in data dir:'
    ls -la /var/lib/postgresql/data/server.*
    
    echo 'Key file existence check:'
    # Force remove existing certs to ensure fresh generation and correct path
    rm -f /var/lib/postgresql/data/server.crt 
    rm -f /var/lib/postgresql/data/server.key
    rm -f /var/lib/postgresql/data/ca.crt

    if [ ! -f /var/lib/postgresql/data/server.key ]; then
        echo '❌ server.key missing! Generating new certificates...'
        apk add --no-cache openssl
        openssl req -new -x509 -days 365 -nodes \
            -text -out /var/lib/postgresql/data/server.crt \
            -keyout /var/lib/postgresql/data/server.key \
            -subj '/CN=postgres'
        cp /var/lib/postgresql/data/server.crt /var/lib/postgresql/data/ca.crt
    fi

    echo 'Correcting ownership to postgres user...'
    # Ensure postgres user owns the certs
    chown postgres:postgres /var/lib/postgresql/data/server.key
    chown postgres:postgres /var/lib/postgresql/data/server.crt
    chown postgres:postgres /var/lib/postgresql/data/ca.crt
    
    echo 'Setting strict mode 0600 on key...'
    chmod 600 /var/lib/postgresql/data/server.key
    
    echo 'Verification:'
    ls -la /var/lib/postgresql/data/server.key
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
