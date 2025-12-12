/**
 * Migration: Add encryption support to patients table
 * 
 * Adds:
 * - encryption_metadata JSONB column for storing encryption metadata
 * - Optionally encrypts existing patient data
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

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('Starting patient encryption migration...\n');

    // Add encryption_metadata column if it doesn't exist
    console.log('1. Adding encryption_metadata column...');
    await client.query(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS encryption_metadata JSONB DEFAULT '{}'::jsonb
    `);
    console.log('   ✅ encryption_metadata column added\n');

    // Create index on encryption_metadata for queries
    console.log('2. Creating index on encryption_metadata...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_encryption_metadata 
      ON patients USING GIN (encryption_metadata)
    `);
    console.log('   ✅ Index created\n');

    // Check if we should encrypt existing data
    const encryptExisting = process.env.ENCRYPT_EXISTING_DATA === 'true';
    
    if (encryptExisting) {
      console.log('3. Encrypting existing patient data...');
      console.log('   ⚠️  This may take a while for large datasets...\n');

      // Get all patients
      const result = await client.query('SELECT * FROM patients');
      const patients = result.rows;
      
      console.log(`   Found ${patients.length} patients to encrypt\n`);

      let encrypted = 0;
      let errors = 0;

      for (const patient of patients) {
        try {
          // Check if already encrypted (has encryption_metadata with fields)
          const metadata = patient.encryption_metadata || {};
          const hasEncryptedFields = Object.keys(metadata).length > 0;
          
          if (hasEncryptedFields) {
            console.log(`   ⏭️  Patient ${patient.id} already encrypted, skipping...`);
            continue;
          }

          // Encrypt PHI fields
          const encryptedPatient = await patientEncryptionService.encryptPatientPHI(patient);
          
          // Update patient with encrypted data
          const updateFields = [];
          const updateValues = [];
          let paramIndex = 1;

          for (const field of patientEncryptionService.PHI_FIELDS) {
            if (encryptedPatient[field] !== undefined && encryptedPatient[field] !== patient[field]) {
              updateFields.push(`${field} = $${paramIndex}`);
              updateValues.push(encryptedPatient[field]);
              paramIndex++;
            }
          }

          if (updateFields.length > 0) {
            updateFields.push(`encryption_metadata = $${paramIndex}`);
            updateValues.push(JSON.stringify(encryptedPatient.encryption_metadata));
            paramIndex++;
            
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            updateValues.push(patient.id);

            await client.query(
              `UPDATE patients SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
              updateValues
            );

            encrypted++;
            if (encrypted % 10 === 0) {
              console.log(`   ✅ Encrypted ${encrypted}/${patients.length} patients...`);
            }
          }
        } catch (error) {
          console.error(`   ❌ Error encrypting patient ${patient.id}:`, error.message);
          errors++;
        }
      }

      console.log(`\n   ✅ Encryption complete: ${encrypted} encrypted, ${errors} errors\n`);
    } else {
      console.log('3. Skipping existing data encryption (set ENCRYPT_EXISTING_DATA=true to enable)\n');
    }

    await client.query('COMMIT');
    console.log('✅ Patient encryption migration completed successfully!\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };





















