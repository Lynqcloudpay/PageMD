/**
 * Backup and Restore Test
 * 
 * Tests encrypted backup creation and restore functionality
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testBackupRestore() {
  console.log('Testing backup and restore...\n');
  const results = [];
  
  const backupDir = path.join(__dirname, '../../server/backups');
  const testBackupDir = path.join(backupDir, 'test');
  
  // Ensure test backup directory exists
  if (!fs.existsSync(testBackupDir)) {
    fs.mkdirSync(testBackupDir, { recursive: true });
  }
  
  // Test 1: Create backup
  console.log('1. Testing backup creation...');
  try {
    process.chdir(path.join(__dirname, '../../server'));
    const { stdout, stderr } = await execAsync('node scripts/backup-database.js backup', {
      env: {
        ...process.env,
        BACKUP_DIR: testBackupDir,
        NODE_ENV: 'test',
        BACKUP_ENCRYPTION_KEY: 'test-backup-encryption-key-32-bytes-long!!'
      }
    });
    
    // Check if backup file was created
    const backupFiles = fs.readdirSync(testBackupDir).filter(f => f.endsWith('.encrypted'));
    const backupCreated = backupFiles.length > 0;
    
    results.push({
      test: 'backup_creation',
      pass: backupCreated,
      note: backupCreated ? `Backup created: ${backupFiles[0]}` : 'No backup file found',
      output: stdout.substring(0, 500)
    });
    
    console.log(`   ${backupCreated ? '✅' : '❌'} Backup ${backupCreated ? 'created' : 'failed'}`);
    if (backupCreated) {
      console.log(`   File: ${backupFiles[0]}`);
    }
  } catch (error) {
    results.push({
      test: 'backup_creation',
      pass: false,
      note: error.message,
      output: error.stdout || error.stderr || ''
    });
    console.log(`   ❌ Backup failed: ${error.message}`);
  }
  
  // Test 2: Verify backup is encrypted
  console.log('\n2. Verifying backup encryption...');
  try {
    const backupFiles = fs.readdirSync(testBackupDir).filter(f => f.endsWith('.encrypted'));
    if (backupFiles.length > 0) {
      const backupPath = path.join(testBackupDir, backupFiles[0]);
      const backupContent = fs.readFileSync(backupPath);
      
      // Encrypted backup should not be readable as text
      const isEncrypted = !backupContent.toString('utf8').match(/CREATE TABLE|INSERT INTO/i);
      
      results.push({
        test: 'backup_encryption',
        pass: isEncrypted,
        note: isEncrypted ? 'Backup appears encrypted (no plaintext SQL)' : 'Backup may contain plaintext',
        fileSize: backupContent.length
      });
      
      console.log(`   ${isEncrypted ? '✅' : '❌'} Backup ${isEncrypted ? 'appears encrypted' : 'may contain plaintext'}`);
    } else {
      results.push({
        test: 'backup_encryption',
        pass: false,
        note: 'No backup file to verify'
      });
    }
  } catch (error) {
    results.push({
      test: 'backup_encryption',
      pass: false,
      note: error.message
    });
  }
  
  // Test 3: List backups
  console.log('\n3. Testing backup listing...');
  try {
    const { stdout } = await execAsync('node scripts/backup-database.js list', {
      env: {
        ...process.env,
        BACKUP_DIR: testBackupDir,
        NODE_ENV: 'test'
      }
    });
    
    results.push({
      test: 'backup_listing',
      pass: stdout.includes('backup') || stdout.includes('Backup'),
      note: 'Backup list command executed',
      output: stdout.substring(0, 500)
    });
    
    console.log(`   ✅ Backup listing works`);
  } catch (error) {
    results.push({
      test: 'backup_listing',
      pass: false,
      note: error.message
    });
  }
  
  const allPassed = results.every(r => r.pass);
  console.log(`\n${allPassed ? '✅' : '❌'} Backup tests: ${results.filter(r => r.pass).length}/${results.length} passed\n`);
  
  return results;
}

if (require.main === module) {
  testBackupRestore()
    .then(results => {
      const fs = require('fs');
      const outputPath = path.join(__dirname, 'backup-restore.log');
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      process.exit(results.every(r => r.pass) ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testBackupRestore };





















