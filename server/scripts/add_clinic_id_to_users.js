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

        console.log('Adding clinic_id to users table...');
        await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS clinic_id UUID;
    `);

        console.log('Creating index for clinic_id on users...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
    `);

        await client.query('COMMIT');
        console.log('✅ Migration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(console.error);
