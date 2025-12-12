/**
 * Migration: Update orders table constraint to include 'procedure' and 'prescription'
 * 
 * The orders table CHECK constraint was missing 'procedure' and 'prescription' types
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

    // Drop existing constraint if it exists
    await client.query(`
      ALTER TABLE orders 
      DROP CONSTRAINT IF EXISTS orders_order_type_check
    `);

    // Add updated constraint with all order types
    await client.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT orders_order_type_check 
      CHECK (order_type IN ('lab', 'imaging', 'rx', 'referral', 'procedure', 'prescription'))
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed: orders table constraint updated');
    
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












