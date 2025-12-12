const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function addInboxFields() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Add reviewed and comment fields to orders table
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS comment TEXT
    `);

    // Add reviewed and comment fields to documents table
    await client.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS comment TEXT
    `);

    await client.query('COMMIT');
    console.log('✅ Successfully added inbox fields to orders and documents tables');
    
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding inbox fields:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addInboxFields();
































