/**
 * Test Database Setup
 * Creates encryption_keys table for testing
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function setupTestDB() {
  try {
    // Create encryption_keys table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_id VARCHAR(255) UNIQUE NOT NULL,
        key_version VARCHAR(50) NOT NULL,
        dek_encrypted BYTEA NOT NULL,
        algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create a test DEK if one doesn't exist
    const existing = await pool.query(
      'SELECT * FROM encryption_keys WHERE active = true LIMIT 1'
    );

    if (existing.rows.length === 0) {
      // Create a test DEK (in real usage, this would be encrypted with KMS)
      const crypto = require('crypto');
      const testDEK = crypto.randomBytes(32);
      const testDEKBase64 = testDEK.toString('base64');
      
      // For testing with local KMS, we need to "encrypt" it using the local KMS
      // to match the format expected by the encryption service
      const appSecret = process.env.JWT_SECRET || 'test-secret-key-for-encryption';
      const key = crypto.scryptSync(appSecret, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(testDEKBase64, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      const encryptedDEK = Buffer.from(`${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`, 'hex');
      
      await pool.query(`
        INSERT INTO encryption_keys (key_id, key_version, dek_encrypted, algorithm, active)
        VALUES ($1, $2, $3, $4, true)
      `, [
        'test-dek-1',
        '1',
        encryptedDEK,
        'AES-256-GCM'
      ]);
    }

    console.log('✅ Test database setup complete');
  } catch (error) {
    console.error('❌ Test database setup failed:', error.message);
    // Don't throw - tests might run without DB
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  setupTestDB()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { setupTestDB };

