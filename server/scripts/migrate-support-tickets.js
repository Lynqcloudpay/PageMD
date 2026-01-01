const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
    (process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL)
        ? {
            connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'paper_emr',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        }
);

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Creating platform_support_tickets table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_support_tickets (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                clinic_id UUID REFERENCES clinics(id),
                user_email VARCHAR(255) NOT NULL,
                user_role VARCHAR(50),
                subject VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
                status VARCHAR(20) DEFAULT 'open',
                context_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_support_clinic ON platform_support_tickets(clinic_id);
            CREATE INDEX IF NOT EXISTS idx_support_status ON platform_support_tickets(status);
        `);

        await client.query('COMMIT');
        console.log('✅ Support Tickets migration successful');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
