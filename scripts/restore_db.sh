#!/bin/bash
# Database Restore Script
# Restores encrypted database backup

set -e

# Configuration
BACKUP_FILE="$1"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-emr_db}"
DB_USER="${DB_USER:-emr_user}"
DB_PASSWORD="${DB_PASSWORD}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check arguments
if [ -z "$BACKUP_FILE" ]; then
    log_error "Usage: $0 <encrypted_backup_file.enc>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Check required variables
if [ -z "$DB_PASSWORD" ]; then
    log_error "DB_PASSWORD environment variable is required"
    exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    log_error "BACKUP_ENCRYPTION_KEY environment variable is required"
    exit 1
fi

# Verify checksum if available
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    log_info "Verifying backup checksum..."
    if sha256sum -c "$CHECKSUM_FILE" > /dev/null 2>&1; then
        log_info "Checksum verified successfully"
    else
        log_error "Checksum verification failed! Backup may be corrupted."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    log_warn "Checksum file not found. Skipping verification."
fi

# Decrypt backup
TEMP_FILE="${BACKUP_FILE}.decrypted"
log_info "Decrypting backup..."
openssl enc -aes-256-cbc -d -pbkdf2 \
    -in "$BACKUP_FILE" \
    -out "$TEMP_FILE" \
    -pass "pass:${ENCRYPTION_KEY}"

if [ $? -ne 0 ]; then
    log_error "Decryption failed. Check your BACKUP_ENCRYPTION_KEY."
    rm -f "$TEMP_FILE"
    exit 1
fi

log_info "Backup decrypted successfully"

# Confirm restore
log_warn "WARNING: This will DROP and RECREATE the database: ${DB_NAME}"
log_warn "All current data will be lost!"
read -p "Are you sure you want to continue? (yes/NO): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Restore cancelled"
    rm -f "$TEMP_FILE"
    exit 0
fi

# Set PGPASSWORD
export PGPASSWORD="$DB_PASSWORD"

# Restore database
log_info "Restoring database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
-- Terminate existing connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();

-- Drop and recreate database
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
EOF

# Restore from backup
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$TEMP_FILE"

if [ $? -eq 0 ]; then
    log_info "Database restored successfully!"
else
    log_error "Database restore failed"
    rm -f "$TEMP_FILE"
    unset PGPASSWORD
    exit 1
fi

# Clean up
rm -f "$TEMP_FILE"
unset PGPASSWORD

log_info "Restore complete!"

