const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function deleteAllOrdersets() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete all ordersets
    const result = await client.query('DELETE FROM ordersets');
    
    await client.query('COMMIT');
    console.log(`✅ Successfully deleted ${result.rowCount} ordersets`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting ordersets:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  deleteAllOrdersets()
    .then(() => {
      console.log('✅ Deletion completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deletion failed:', error);
      process.exit(1);
    });
}

module.exports = { deleteAllOrdersets };




