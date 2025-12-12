/**
 * Migration: Add order-diagnosis relationship
 * 
 * Creates junction table to link orders (prescriptions, labs, referrals, procedures) to diagnoses
 * Supports many-to-many relationship (one order can have multiple diagnoses)
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

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create order_diagnoses junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_diagnoses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('prescription', 'lab', 'imaging', 'referral', 'procedure')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(order_id, problem_id, order_type)
      )
    `);

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_diagnoses_order_id ON order_diagnoses(order_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_diagnoses_problem_id ON order_diagnoses(problem_id)
    `);

    // Add order_type column to orders table if it doesn't exist (for linking)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='orders' AND column_name='order_type'
        ) THEN
          ALTER TABLE orders ADD COLUMN order_type VARCHAR(50);
        END IF;
      END $$;
    `);

    // Add diagnosis_id column to prescriptions table for backward compatibility
    // (but we'll primarily use the junction table)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='prescriptions' AND column_name='diagnosis_id'
        ) THEN
          ALTER TABLE prescriptions ADD COLUMN diagnosis_id UUID REFERENCES problems(id);
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed: order-diagnosis relationship tables created');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };













