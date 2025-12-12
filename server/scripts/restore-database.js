/**
 * Database Restore Script
 * 
 * HIPAA-compliant database restore procedure
 * - Decrypts backup
 * - Validates checksum
 * - Restores database
 * - Verifies restore
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'paper_emr';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

// Encryption key (should match backup key)
const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || 
  crypto.scryptSync(process.env.JWT_SECRET || 'dev-secret', 'backup-salt', 32);

/**
 * Decrypt backup file
 */
function decryptBackup(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(inputPath);
    
    // Extract IV (first 16 bytes) and auth tag (last 16 bytes)
    const iv = fileBuffer.slice(0, 16);
    const authTag = fileBuffer.slice(-16);
    const encrypted = fileBuffer.slice(16, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', BACKUP_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    const output = fs.createWriteStream(outputPath);
    output.write(decipher.update(encrypted));
    output.write(decipher.final());
    output.end();
    
    output.on('finish', resolve);
    output.on('error', reject);
  });
}

/**
 * Verify backup checksum
 */
function verifyChecksum(backupPath) {
  const metaPath = `${backupPath}.meta.json`;
  
  if (!fs.existsSync(metaPath)) {
    console.warn('⚠️  No metadata file found, skipping checksum verification');
    return true;
  }
  
  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const expectedChecksum = metadata.checksum;
  
  const fileBuffer = fs.readFileSync(backupPath);
  const actualChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  if (actualChecksum !== expectedChecksum) {
    throw new Error('Checksum verification failed! Backup file may be corrupted.');
  }
  
  console.log('✅ Checksum verified');
  return true;
}

/**
 * Restore database from backup
 */
async function restoreDatabase(backupPath, options = {}) {
  const { dryRun = false, createNew = false } = options;
  
  console.log(`\n📦 Restoring database from: ${path.basename(backupPath)}`);
  
  // Verify checksum
  verifyChecksum(backupPath);
  
  // Decrypt backup
  const decryptedPath = `${backupPath}.decrypted`;
  console.log('🔓 Decrypting backup...');
  await decryptBackup(backupPath, decryptedPath);
  console.log('✅ Backup decrypted');
  
  if (dryRun) {
    console.log('🔍 DRY RUN: Would restore database');
    fs.unlinkSync(decryptedPath);
    return;
  }
  
  try {
    // Drop existing database if createNew
    if (createNew) {
      console.log(`🗑️  Dropping existing database: ${DB_NAME}`);
      const dropCmd = `PGPASSWORD="${DB_PASSWORD}" psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -c "DROP DATABASE IF EXISTS ${DB_NAME};"`;
      await execPromise(dropCmd);
      
      console.log(`➕ Creating new database: ${DB_NAME}`);
      const createCmd = `PGPASSWORD="${DB_PASSWORD}" psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -c "CREATE DATABASE ${DB_NAME};"`;
      await execPromise(createCmd);
    }
    
    // Restore from backup
    console.log('📥 Restoring database...');
    const restoreCmd = `PGPASSWORD="${DB_PASSWORD}" pg_restore -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "${decryptedPath}"`;
    await execPromise(restoreCmd);
    
    console.log('✅ Database restored successfully');
    
    // Verify restore
    console.log('🔍 Verifying restore...');
    const verifyCmd = `PGPASSWORD="${DB_PASSWORD}" psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "SELECT COUNT(*) FROM users;"`;
    const result = await execPromise(verifyCmd);
    console.log('✅ Restore verified');
    
  } finally {
    // Clean up decrypted file
    if (fs.existsSync(decryptedPath)) {
      fs.unlinkSync(decryptedPath);
    }
  }
}

/**
 * Execute command and return promise
 */
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject(error);
      }
      if (stderr && !stderr.includes('WARNING')) {
        console.warn(`Warning: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

/**
 * Find backup file
 */
function findBackup(backupName) {
  // Search in all backup type directories
  for (const type of ['daily', 'weekly', 'monthly']) {
    const backupTypeDir = path.join(BACKUP_DIR, type);
    if (!fs.existsSync(backupTypeDir)) continue;
    
    const files = fs.readdirSync(backupTypeDir)
      .filter(f => f.endsWith('.encrypted'));
    
    // Try exact match
    if (files.includes(backupName)) {
      return path.join(backupTypeDir, backupName);
    }
    
    // Try partial match
    const match = files.find(f => f.includes(backupName));
    if (match) {
      return path.join(backupTypeDir, match);
    }
  }
  
  throw new Error(`Backup not found: ${backupName}`);
}

// Main execution
if (require.main === module) {
  const backupName = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  const createNew = process.argv.includes('--create-new');
  
  if (!backupName) {
    console.error('Usage: node restore-database.js <backup-filename> [--dry-run] [--create-new]');
    console.error('\nExample:');
    console.error('  node restore-database.js paper_emr-daily-2024-01-15T10-30-00.sql.encrypted');
    console.error('  node restore-database.js paper_emr-daily-2024-01-15T10-30-00.sql.encrypted --dry-run');
    console.error('  node restore-database.js paper_emr-daily-2024-01-15T10-30-00.sql.encrypted --create-new');
    process.exit(1);
  }
  
  try {
    const backupPath = findBackup(backupName);
    restoreDatabase(backupPath, { dryRun, createNew })
      .then(() => {
        console.log('\n✅ Restore completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Restore failed:', error.message);
        process.exit(1);
      });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

module.exports = {
  restoreDatabase,
  verifyChecksum,
  findBackup
};





















