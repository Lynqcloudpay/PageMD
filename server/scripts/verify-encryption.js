/**
 * Verification Script: Test Patient Encryption
 * 
 * This script verifies that patient encryption is working correctly:
 * 1. Creates a test patient with PHI
 * 2. Verifies PHI is encrypted in database
 * 3. Retrieves patient and verifies PHI is decrypted
 * 4. Cleans up test data
 */

const { Pool } = require('pg');
const patientEncryptionService = require('../services/patientEncryptionService');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function verifyEncryption() {
  console.log('🔍 Verifying Patient Encryption Implementation...\n');
  
  let testPatientId = null;
  
  try {
    // Step 1: Check encryption_metadata column exists
    console.log('1. Checking database schema...');
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'patients' AND column_name = 'encryption_metadata'
    `);
    
    if (schemaCheck.rows.length === 0) {
      console.log('   ❌ encryption_metadata column not found!');
      console.log('   Run: npm run migrate-encryption');
      process.exit(1);
    }
    console.log('   ✅ encryption_metadata column exists\n');

    // Step 2: Check encryption_keys table exists
    console.log('2. Checking encryption_keys table...');
    const keysCheck = await pool.query(`
      SELECT COUNT(*) as count FROM encryption_keys WHERE active = true
    `);
    console.log(`   ✅ Found ${keysCheck.rows[0].count} active encryption key(s)\n`);

    // Step 3: Test encryption service directly
    console.log('3. Testing encryption service...');
    const testPatient = {
      mrn: 'TEST-VERIFY-001',
      first_name: 'Test',
      last_name: 'Verification',
      dob: '1990-01-01',
      phone: '555-1234',
      email: 'test@verification.com',
      address_line1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zip: '12345'
    };

    const encrypted = await patientEncryptionService.encryptPatientPHI(testPatient);
    
    // Verify PHI fields are encrypted
    if (encrypted.first_name === testPatient.first_name) {
      console.log('   ❌ first_name was not encrypted!');
      process.exit(1);
    }
    if (encrypted.last_name === testPatient.last_name) {
      console.log('   ❌ last_name was not encrypted!');
      process.exit(1);
    }
    if (encrypted.phone === testPatient.phone) {
      console.log('   ❌ phone was not encrypted!');
      process.exit(1);
    }
    
    // Verify non-PHI fields remain unchanged
    if (encrypted.mrn !== testPatient.mrn) {
      console.log('   ❌ mrn was incorrectly modified!');
      process.exit(1);
    }
    
    // Verify encryption metadata exists
    if (!encrypted.encryption_metadata || Object.keys(encrypted.encryption_metadata).length === 0) {
      console.log('   ❌ encryption_metadata is missing!');
      process.exit(1);
    }
    
    console.log('   ✅ Encryption working correctly\n');

    // Step 4: Test decryption
    console.log('4. Testing decryption service...');
    const decrypted = await patientEncryptionService.decryptPatientPHI(encrypted);
    
    if (decrypted.first_name !== testPatient.first_name) {
      console.log(`   ❌ Decryption failed! Expected "${testPatient.first_name}", got "${decrypted.first_name}"`);
      process.exit(1);
    }
    if (decrypted.last_name !== testPatient.last_name) {
      console.log(`   ❌ Decryption failed! Expected "${testPatient.last_name}", got "${decrypted.last_name}"`);
      process.exit(1);
    }
    if (decrypted.phone !== testPatient.phone) {
      console.log(`   ❌ Decryption failed! Expected "${testPatient.phone}", got "${decrypted.phone}"`);
      process.exit(1);
    }
    
    console.log('   ✅ Decryption working correctly\n');

    // Step 5: Test database roundtrip
    console.log('5. Testing database roundtrip...');
    
    // Insert encrypted patient
    const insertResult = await pool.query(`
      INSERT INTO patients (
        mrn, first_name, last_name, dob, phone, email, 
        address_line1, city, state, zip, encryption_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, first_name, encryption_metadata
    `, [
      encrypted.mrn,
      encrypted.first_name,
      encrypted.last_name,
      encrypted.dob,
      encrypted.phone,
      encrypted.email,
      encrypted.address_line1,
      encrypted.city,
      encrypted.state,
      encrypted.zip,
      JSON.stringify(encrypted.encryption_metadata)
    ]);
    
    testPatientId = insertResult.rows[0].id;
    
    // Verify stored data is encrypted
    const stored = insertResult.rows[0];
    if (stored.first_name === testPatient.first_name) {
      console.log('   ❌ PHI stored in plaintext in database!');
      process.exit(1);
    }
    if (stored.first_name.length < 50) {
      console.log('   ❌ Encrypted data seems too short!');
      process.exit(1);
    }
    
    console.log('   ✅ Data stored encrypted in database\n');

    // Step 6: Test retrieval and decryption
    console.log('6. Testing retrieval and decryption...');
    const retrieved = await pool.query('SELECT * FROM patients WHERE id = $1', [testPatientId]);
    const decryptedRetrieved = await patientEncryptionService.decryptPatientPHI(retrieved.rows[0]);
    
    if (decryptedRetrieved.first_name !== testPatient.first_name) {
      console.log(`   ❌ Retrieved data decryption failed!`);
      process.exit(1);
    }
    if (decryptedRetrieved.last_name !== testPatient.last_name) {
      console.log(`   ❌ Retrieved data decryption failed!`);
      process.exit(1);
    }
    
    console.log('   ✅ Retrieval and decryption working correctly\n');

    // Step 7: Cleanup
    console.log('7. Cleaning up test data...');
    await pool.query('DELETE FROM patients WHERE id = $1', [testPatientId]);
    console.log('   ✅ Test data cleaned up\n');

    console.log('='.repeat(50));
    console.log('✅ ALL VERIFICATION TESTS PASSED!');
    console.log('='.repeat(50));
    console.log('\nPatient encryption is working correctly:');
    console.log('  ✅ PHI fields are encrypted before storage');
    console.log('  ✅ PHI fields are decrypted after retrieval');
    console.log('  ✅ Encryption metadata is stored correctly');
    console.log('  ✅ Non-PHI fields remain in plaintext');
    console.log('\nThe system is ready for production! 🎉\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    
    // Cleanup on error
    if (testPatientId) {
      try {
        await pool.query('DELETE FROM patients WHERE id = $1', [testPatientId]);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run verification
if (require.main === module) {
  verifyEncryption()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Verification script failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyEncryption };





















