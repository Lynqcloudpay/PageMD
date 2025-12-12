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

    // Ordersets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ordersets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        specialty VARCHAR(100),
        category VARCHAR(100),
        orders JSONB NOT NULL, -- Array of order objects
        tags TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Index for searching
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ordersets_specialty 
      ON ordersets(specialty) WHERE is_active = true
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ordersets_category 
      ON ordersets(category) WHERE is_active = true
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ordersets_tags 
      ON ordersets USING GIN(tags) WHERE is_active = true
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ordersets_name 
      ON ordersets(name) WHERE is_active = true
    `);

    await client.query('COMMIT');
    console.log('✅ Ordersets table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating ordersets table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };

