const { Pool } = require('pg');
require('dotenv').config();

const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(config);

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Sales Admin Privileges migration...');

        // 1. Add privileges column
        console.log('  Adding privileges column to sales_team_users...');
        await client.query(`
            ALTER TABLE sales_team_users 
            ADD COLUMN IF NOT EXISTS privileges JSONB DEFAULT '[]';
        `);

        // 2. Update existing users with default privileges based on role
        console.log('  Updating default privileges for existing users...');

        // Admin
        const adminPrivs = JSON.stringify([
            'manage_leads', 'manage_demos', 'manage_team',
            'view_master_schedule', 'view_global_pipeline', 'delete_leads'
        ]);
        await client.query(`
            UPDATE sales_team_users 
            SET privileges = $1 
            WHERE role = 'admin' OR username = 'admin';
        `, [adminPrivs]);

        // Sales Manager
        const managerPrivs = JSON.stringify([
            'manage_leads', 'manage_demos', 'manage_team',
            'view_master_schedule', 'view_global_pipeline'
        ]);
        await client.query(`
            UPDATE sales_team_users 
            SET privileges = $1 
            WHERE role = 'sales_manager';
        `, [managerPrivs]);

        // Seller (Sales)
        const sellerPrivs = JSON.stringify([
            'manage_leads', 'manage_demos'
        ]);
        await client.query(`
            UPDATE sales_team_users 
            SET privileges = $1 
            WHERE role = 'seller' OR role IS NULL OR privileges = '[]'::jsonb;
        `, [sellerPrivs]);

        console.log('✅ Migration completed successfully.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
