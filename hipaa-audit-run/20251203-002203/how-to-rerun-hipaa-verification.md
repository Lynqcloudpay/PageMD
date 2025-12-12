# How to Re-Run HIPAA Verification Suite

This guide provides exact commands to re-run the complete HIPAA verification suite.

---

## Prerequisites

### Required Software
- Node.js 20+ (check with `node --version`)
- PostgreSQL (running and accessible)
- npm or yarn

### Optional (for full suite)
- gitleaks (for secret scanning)
- trufflehog (for secret scanning)
- semgrep (for static analysis)
- OWASP ZAP (for DAST scanning)

### Environment Setup
```bash
# Set test environment variables
export NODE_ENV=test
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=paper_emr_test
export DB_USER=postgres
export DB_PASSWORD=postgres
export JWT_SECRET=test-secret-key-for-hipaa-verification-only
export KMS_PROVIDER=local
export BACKUP_ENCRYPTION_KEY=test-backup-encryption-key-32-bytes-long!!
```

---

## Step-by-Step Verification

### 1. Install Dependencies
```bash
cd server
npm ci
```

### 2. Run Database Migrations
```bash
# Base migration
npm run migrate

# HIPAA security migration
npm run migrate-hipaa

# Encryption migration
npm run migrate-encryption
```

### 3. Setup Test Database
```bash
# Create encryption key for testing
node tests/setup-test-db.js
```

### 4. Run Unit/Integration Tests
```bash
# Run all tests
npm test -- --runInBand --json --outputFile=../hipaa-audit-run/$(date +%Y%m%d-%H%M%S)/jest-results.json

# Or run specific test suites
npm test -- tests/hipaa-integration.test.js
npm test -- tests/patient-encryption.test.js
```

### 5. Run Verification Scripts
```bash
# Encryption verification
NODE_ENV=test node scripts/verify-encryption.js > verify-encryption.out 2>&1

# RBAC verification
node scripts/test-rbac.js > test-rbac.out 2>&1

# Audit log integrity
NODE_ENV=test node test-audit-log-integrity.js > audit-log-integrity.out 2>&1

# Backup/restore
NODE_ENV=test node test-backup-restore.js > backup-restore.log 2>&1
```

### 6. Static Analysis
```bash
# ESLint
npx eslint . --ext .js --format json -o eslint-results.json

# npm audit
npm audit --json > npm-audit.json

# PHI detection
rg -n --hidden "SSN|social_security|mrn|medical_record|dob|date_of_birth|patient_name|first_name|last_name|address|zip_code|phone_number|notes" server/ > phi-grep.txt

# Logger usage
rg "console\.log|logger\.info|logger\.debug|print\(" server/ -n > logger-grep.txt
```

### 7. Secret Scanning (if tools installed)
```bash
# gitleaks
gitleaks detect --source . --report-format json --report-path gitleaks-report.json

# trufflehog
trufflehog git --json --depth=50 . > trufflehog.json
```

### 8. Database Inspection
```bash
# Check encryption metadata column
psql -h localhost -U postgres -d paper_emr_test -c "SELECT column_name FROM information_schema.columns WHERE table_name='patients' AND column_name='encryption_metadata';"

# Check encrypted data
psql -h localhost -U postgres -d paper_emr_test -c "SELECT id, LEFT(first_name, 50) as first_name_preview, LEFT(encryption_metadata::text, 100) as metadata_preview FROM patients LIMIT 3;"

# Check audit log trigger
psql -h localhost -U postgres -d paper_emr_test -c "SELECT trigger_name, event_manipulation FROM information_schema.triggers WHERE event_object_table = 'audit_logs';"
```

### 9. Adversarial RBAC Testing (requires running server)
```bash
# Start server in test mode
NODE_ENV=test npm start &

# Wait for server to start
sleep 5

# Run adversarial tests
node rbac-adversarial-test.js

# Stop server
pkill -f "node.*index.js"
```

### 10. Session Timeout Testing (requires running server)
```bash
# Start server
NODE_ENV=test npm start &

# Run session tests
node test-session-timeout.js > session-tests.out 2>&1

# Stop server
pkill -f "node.*index.js"
```

### 11. DAST Scanning (optional, requires OWASP ZAP)
```bash
# Start server
NODE_ENV=test npm start &

# Run ZAP scan
docker run --rm -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:3000 -r zap-report.html

# Stop server
pkill -f "node.*index.js"
```

---

## Docker Compose Setup (Alternative)

If you prefer Docker:

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: paper_emr_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
  
  app:
    build: ./server
    environment:
      NODE_ENV: test
      DB_HOST: postgres
      DB_NAME: paper_emr_test
      DB_USER: postgres
      DB_PASSWORD: postgres
    depends_on:
      - postgres
    command: npm test
```

Run with:
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

---

## Complete Verification Script

Save this as `run-hipaa-verification.sh`:

```bash
#!/bin/bash
set -e

AUDIT_DIR="hipaa-audit-run/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$AUDIT_DIR"

echo "Starting HIPAA verification suite..."
echo "Results will be saved to: $AUDIT_DIR"

# Set environment
export NODE_ENV=test
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=paper_emr_test
export DB_USER=postgres
export DB_PASSWORD=postgres
export JWT_SECRET=test-secret-key-for-hipaa-verification-only
export KMS_PROVIDER=local
export BACKUP_ENCRYPTION_KEY=test-backup-encryption-key-32-bytes-long!!

cd server

# Install dependencies
echo "Installing dependencies..."
npm ci

# Run migrations
echo "Running migrations..."
npm run migrate || true
npm run migrate-hipaa || true
npm run migrate-encryption || true

# Setup test DB
echo "Setting up test database..."
node tests/setup-test-db.js || true

# Run tests
echo "Running tests..."
npm test -- --runInBand --json --outputFile="../$AUDIT_DIR/jest-results.json" || true

# Run verification scripts
echo "Running verification scripts..."
NODE_ENV=test node scripts/verify-encryption.js > "../$AUDIT_DIR/verify-encryption.out" 2>&1 || true
node scripts/test-rbac.js > "../$AUDIT_DIR/test-rbac.out" 2>&1 || true
NODE_ENV=test node "../$AUDIT_DIR/test-audit-log-integrity.js" > "../$AUDIT_DIR/audit-log-integrity.out" 2>&1 || true
NODE_ENV=test node "../$AUDIT_DIR/test-backup-restore.js" > "../$AUDIT_DIR/backup-restore.log" 2>&1 || true

# Static analysis
echo "Running static analysis..."
npx eslint . --ext .js --format json -o "../$AUDIT_DIR/eslint-results.json" || true
npm audit --json > "../$AUDIT_DIR/npm-audit.json" || true

# PHI detection
echo "Scanning for PHI..."
cd ..
rg -n --hidden "SSN|social_security|mrn|medical_record|dob|date_of_birth|patient_name|first_name|last_name|address|zip_code|phone_number|notes" server/ > "$AUDIT_DIR/phi-grep.txt" 2>/dev/null || true
rg "console\.log|logger\.info|logger\.debug|print\(" server/ -n > "$AUDIT_DIR/logger-grep.txt" 2>/dev/null || true

echo "Verification complete! Results in: $AUDIT_DIR"
```

Make executable and run:
```bash
chmod +x run-hipaa-verification.sh
./run-hipaa-verification.sh
```

---

## Expected Results

### All Tests Should Pass
- ✅ Encryption verification: Exit code 0
- ✅ RBAC verification: Exit code 0
- ✅ Audit log integrity: Exit code 0
- ✅ Backup/restore: Exit code 0
- ✅ Jest tests: All passing

### Artifacts Generated
- `jest-results.json` - Test results
- `verify-encryption.out` - Encryption test output
- `test-rbac.out` - RBAC test output
- `audit-log-integrity.out` - Audit log test
- `backup-restore.log` - Backup test
- `eslint-results.json` - Linting results
- `npm-audit.json` - Vulnerability scan
- `phi-grep.txt` - PHI field detection
- `logger-grep.txt` - Logger usage

---

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
psql -h localhost -U postgres -c "SELECT 1;"

# Create test database if needed
createdb -h localhost -U postgres paper_emr_test
```

### Encryption Service Errors
- Ensure `encryption_keys` table exists
- Run `node tests/setup-test-db.js` to create test DEK
- Check KMS_PROVIDER is set to 'local' for testing

### Test Failures
- Check database migrations have run
- Verify test database is clean
- Check environment variables are set correctly

---

## Production Verification

For production verification, use real KMS:

```bash
export KMS_PROVIDER=aws  # or gcp, azure
export AWS_KMS_KEY_ID=arn:aws:kms:...
export AWS_REGION=us-east-1
export BACKUP_ENCRYPTION_KEY=<production-key>
export NODE_ENV=production
```

**⚠️ Never run verification against production database with real PHI!**

---

**Last Updated:** December 19, 2024





















