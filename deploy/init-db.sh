#!/bin/bash
set -e

# Initialize database with SSL certificates if needed
# This script runs on first database container startup

echo "Initializing database..."

# Create SSL certificates for PostgreSQL (self-signed for internal use)
# Create SSL certificates for PostgreSQL (self-signed for internal use)
if [ ! -f /var/lib/postgresql/certs/server.crt ]; then
    echo "Generating SSL certificates for PostgreSQL..."
    openssl req -new -x509 -days 365 -nodes \
        -text -out /var/lib/postgresql/certs/server.crt \
        -keyout /var/lib/postgresql/certs/server.key \
        -subj "/CN=postgres"
    chmod 600 /var/lib/postgresql/certs/server.key
    chmod 644 /var/lib/postgresql/certs/server.crt
    cp /var/lib/postgresql/certs/server.crt /var/lib/postgresql/certs/ca.crt
fi

echo "Database initialization complete."
