#!/bin/bash
# Database Backup Script with Encryption
# HIPAA-compliant encrypted backups

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-emr_db}"
DB_USER="${DB_USER:-emr_user}"
DB_PASSWORD="${DB_PASSWORD}"

# AWS S3 Configuration (optional)
S3_BUCKET="${AWS_S3_BACKUP_BUCKET}"
S3_REGION="${AWS_S3_BACKUP_REGION:-us-east-1}"

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

# Check required variables
if [ -z "$DB_PASSWORD" ]; then
    log_error "DB_PASSWORD environment variable is required"
    exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    log_error "BACKUP_ENCRYPTION_KEY environment variable is required"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/emr_backup_${TIMESTAMP}.sql"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"

log_info "Starting database backup..."
log_info "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

# Set PGPASSWORD for pg_dump
export PGPASSWORD="$DB_PASSWORD"

# Create database dump
log_info "Creating database dump..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --clean --if-exists \
    -F p > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    log_error "Database dump failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Encrypt backup
log_info "Encrypting backup..."
openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "$BACKUP_FILE" \
    -out "$ENCRYPTED_FILE" \
    -pass "pass:${ENCRYPTION_KEY}"

if [ $? -ne 0 ]; then
    log_error "Encryption failed"
    rm -f "$BACKUP_FILE" "$ENCRYPTED_FILE"
    exit 1
fi

# Remove unencrypted backup
rm -f "$BACKUP_FILE"
log_info "Encrypted backup created: ${ENCRYPTED_FILE}"

# Calculate checksum
CHECKSUM=$(sha256sum "$ENCRYPTED_FILE" | cut -d' ' -f1)
CHECKSUM_FILE="${ENCRYPTED_FILE}.sha256"
echo "$CHECKSUM  $(basename $ENCRYPTED_FILE)" > "$CHECKSUM_FILE"
log_info "Checksum: ${CHECKSUM}"

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
    log_info "Uploading to S3: s3://${S3_BUCKET}/"
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_warn "AWS CLI not found. Skipping S3 upload."
    else
        # Upload backup
        aws s3 cp "$ENCRYPTED_FILE" "s3://${S3_BUCKET}/backups/" --region "$S3_REGION"
        
        # Upload checksum
        aws s3 cp "$CHECKSUM_FILE" "s3://${S3_BUCKET}/backups/" --region "$S3_REGION"
        
        if [ $? -eq 0 ]; then
            log_info "Backup uploaded to S3 successfully"
        else
            log_error "S3 upload failed"
        fi
    fi
fi

# Clean up old backups (local)
log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "emr_backup_*.sql.enc" -type f -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "emr_backup_*.sql.enc.sha256" -type f -mtime +${RETENTION_DAYS} -delete
log_info "Cleanup complete"

# Summary
ENCRYPTED_SIZE=$(du -h "$ENCRYPTED_FILE" | cut -f1)
log_info "Backup completed successfully!"
log_info "  File: ${ENCRYPTED_FILE}"
log_info "  Size: ${ENCRYPTED_SIZE}"
log_info "  Checksum: ${CHECKSUM}"

# Unset password
unset PGPASSWORD

exit 0

