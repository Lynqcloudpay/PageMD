
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.prod if available, otherwise default to local
const envPath = path.resolve(__dirname, '../deploy/.env.prod');
require('dotenv').config({ path: envPath });

const pool = new Pool({
    user: process.env.DB_USER || 'emr_user',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'emr_db',
    password: process.env.DB_PASSWORD || 'CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS',
    port: 5432,
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Reset Password Columns migration...');

        // 1. Add columns to sales_team_users
        console.log('  Adding reset columns to sales_team_users...');
        await client.query(`
      ALTER TABLE sales_team_users
      ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP WITH TIME ZONE;
    `);

        // Add index for token lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_team_users_reset_token ON sales_team_users(reset_password_token);
    `);


        // 2. Add columns to super_admins
        console.log('  Adding reset columns to super_admins...');
        await client.query(`
      ALTER TABLE super_admins
      ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP WITH TIME ZONE;
    `);

        // Add index for token lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_super_admins_reset_token ON super_admins(reset_password_token);
    `);

        console.log('✅ Migration completed successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
