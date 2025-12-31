require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'paper_emr',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

async function init() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create table
        await client.query(`
            CREATE TABLE IF NOT EXISTS clearinghouse_config (
                tenant_id VARCHAR(50) PRIMARY KEY,
                provider VARCHAR(50) NOT NULL DEFAULT 'availity',
                client_id VARCHAR(255),
                client_secret VARCHAR(255),
                mode VARCHAR(20) DEFAULT 'sandbox',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Created clearinghouse_config table");
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

init();
