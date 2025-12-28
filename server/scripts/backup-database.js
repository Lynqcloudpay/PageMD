/**
 * Database Backup Script
 * 
 * HIPAA-compliant automated database backup:
 * - Encrypted backups
 * - Retention policy (daily 30 days, weekly 90 days, monthly 1 year)
 * - Offsite storage
 * - Automated scheduling
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const { URL } = require('url');

let DB_HOST = process.env.DB_HOST || 'localhost';
let DB_PORT = process.env.DB_PORT || 5432;
let DB_NAME = process.env.DB_NAME || 'paper_emr';
let DB_USER = process.env.DB_USER || 'postgres';
let DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    DB_HOST = dbUrl.hostname;
    DB_PORT = dbUrl.port || 5432;
    DB_NAME = dbUrl.pathname.split('/')[1];
    DB_USER = dbUrl.username;
    DB_PASSWORD = dbUrl.password;
  } catch (err) {
    console.warn('Failed to parse DATABASE_URL, falling back to individual env vars');
  }
}

// --- ENCRYPTION HARDENING (Phase 4) ---
// In production, we MUST fail if the explicit backup key is missing.
let BACKUP_ENCRYPTION_KEY;

if (process.env.NODE_ENV === 'production') {
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    throw new Error('CRITICAL: BACKUP_ENCRYPTION_KEY environment variable is required in production. Backup aborted to prevent insecure storage.');
  }
  BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;
} else {
  // Development Fallback
  // ...
  if (process.env.BACKUP_ENCRYPTION_KEY) {
    BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;
  } else {
    // ...
    BACKUP_ENCRYPTION_KEY = crypto.scryptSync(process.env.JWT_SECRET || 'dev-secret', 'backup-salt', 32);
  }
}

// Normalize Key to Buffer (32 bytes for AES-256)
if (typeof BACKUP_ENCRYPTION_KEY === 'string') {
  if (BACKUP_ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(BACKUP_ENCRYPTION_KEY)) {
    // Hex String
    BACKUP_ENCRYPTION_KEY = Buffer.from(BACKUP_ENCRYPTION_KEY, 'hex');
  } else if (BACKUP_ENCRYPTION_KEY.length !== 32) {
    // If not 32 chars (bytes) and not 64 chars (hex), try scrypt to derive a valid key from the passphrase
    // This is safer than failing or using padding
    console.warn(`WARNING: BACKUP_ENCRYPTION_KEY length is ${BACKUP_ENCRYPTION_KEY.length} (expected 32 bytes or 64 hex chars). Deriving key via scrypt...`);
    BACKUP_ENCRYPTION_KEY = crypto.scryptSync(BACKUP_ENCRYPTION_KEY, 'salt', 32);
  }
}

/**
 * Encrypt backup file
 */
function encryptBackup(inputPath, outputPath) {
  // ...
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', BACKUP_ENCRYPTION_KEY, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    // Write IV at the beginning
    output.write(iv);

    input.pipe(cipher).pipe(output);

    output.on('finish', () => {
      // Append auth tag
      const authTag = cipher.getAuthTag();
      fs.appendFileSync(outputPath, authTag);
      resolve();
    });

    output.on('error', reject);
    input.on('error', reject);
  });
}

/**
 * Create database backup
 */
async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupType = getBackupType();
  const backupFileName = `${DB_NAME}-${backupType}-${timestamp}.sql`;
  const backupPath = path.join(BACKUP_DIR, backupType, backupFileName);
  const encryptedPath = `${backupPath}.encrypted`;

  // Create backup directory
  const backupTypeDir = path.join(BACKUP_DIR, backupType);
  if (!fs.existsSync(backupTypeDir)) {
    fs.mkdirSync(backupTypeDir, { recursive: true });
  }

  console.log(`Creating ${backupType} backup: ${backupFileName}`);

  // Create pg_dump command
  const pgDumpCmd = `PGPASSWORD="${DB_PASSWORD}" pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F c -f "${backupPath}"`;

  return new Promise((resolve, reject) => {
    exec(pgDumpCmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Backup error: ${error.message}`);
        return reject(error);
      }

      if (stderr) {
        console.warn(`Backup warnings: ${stderr}`);
      }

      // Encrypt backup
      encryptBackup(backupPath, encryptedPath)
        .then(() => {
          // Remove unencrypted backup
          fs.unlinkSync(backupPath);

          // Calculate checksum
          const checksum = calculateChecksum(encryptedPath);
          const metadata = {
            timestamp: new Date().toISOString(),
            type: backupType,
            filename: path.basename(encryptedPath),
            size: fs.statSync(encryptedPath).size,
            checksum: checksum,
            database: DB_NAME
          };

          // Save metadata
          const metadataPath = `${encryptedPath}.meta.json`;
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

          console.log(`✅ Backup created: ${path.basename(encryptedPath)}`);
          console.log(`   Size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`   Checksum: ${checksum}`);

          resolve(metadata);
        })
        .catch(reject);
    });
  });
}

/**
 * Determine backup type based on date
 */
function getBackupType() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();

  // Monthly backup on 1st of month
  if (dayOfMonth === 1) {
    return 'monthly';
  }

  // Weekly backup on Sunday
  if (dayOfWeek === 0) {
    return 'weekly';
  }

  // Daily backup
  return 'daily';
}

/**
 * Calculate file checksum
 */
function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Cleanup old backups based on retention policy
 */
async function cleanupOldBackups() {
  const retention = {
    daily: 30, // days
    weekly: 90, // days
    monthly: 365 // days
  };

  for (const [type, days] of Object.entries(retention)) {
    const backupTypeDir = path.join(BACKUP_DIR, type);
    if (!fs.existsSync(backupTypeDir)) continue;

    const files = fs.readdirSync(backupTypeDir)
      .filter(f => f.endsWith('.encrypted'))
      .map(f => ({
        name: f,
        path: path.join(backupTypeDir, f),
        mtime: fs.statSync(path.join(backupTypeDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let deleted = 0;
    for (const file of files) {
      if (file.mtime < cutoffDate) {
        fs.unlinkSync(file.path);
        // Also delete metadata file
        const metaPath = `${file.path}.meta.json`;
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old ${type} backup(s)`);
    }
  }
}

/**
 * List available backups
 */
function listBackups() {
  const backups = [];

  for (const type of ['daily', 'weekly', 'monthly']) {
    const backupTypeDir = path.join(BACKUP_DIR, type);
    if (!fs.existsSync(backupTypeDir)) continue;

    const files = fs.readdirSync(backupTypeDir)
      .filter(f => f.endsWith('.encrypted'))
      .map(f => {
        const filePath = path.join(backupTypeDir, f);
        const metaPath = `${filePath}.meta.json`;
        let metadata = {};

        if (fs.existsSync(metaPath)) {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }

        return {
          type,
          filename: f,
          ...metadata
        };
      });

    backups.push(...files);
  }

  return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Main execution
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'backup') {
    createBackup()
      .then(() => cleanupOldBackups())
      .then(() => {
        console.log('✅ Backup completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Backup failed:', error);
        process.exit(1);
      });
  } else if (command === 'list') {
    const backups = listBackups();
    console.log('\nAvailable Backups:');
    console.log('==================');
    backups.forEach(backup => {
      console.log(`${backup.type.padEnd(8)} ${backup.filename.padEnd(50)} ${backup.timestamp || 'N/A'}`);
    });
  } else if (command === 'cleanup') {
    cleanupOldBackups()
      .then(() => {
        console.log('✅ Cleanup completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node backup-database.js [backup|list|cleanup]');
    process.exit(1);
  }
}

module.exports = {
  createBackup,
  cleanupOldBackups,
  listBackups
};
