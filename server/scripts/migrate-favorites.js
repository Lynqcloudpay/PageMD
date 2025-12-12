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

    // Favorites table - stores user favorites for ordersets and orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        favorite_type VARCHAR(50) NOT NULL CHECK (favorite_type IN ('orderset', 'order')),
        favorite_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, favorite_type, favorite_id)
      )
    `);

    // Indexes for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_favorites_user_id 
      ON favorites(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_favorites_type_id 
      ON favorites(favorite_type, favorite_id)
    `);

    await client.query('COMMIT');
    console.log('✅ Favorites table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating favorites table:', error);
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





