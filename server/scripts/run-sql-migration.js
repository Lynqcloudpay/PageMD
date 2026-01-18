const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration(filePath) {
    const sql = fs.readFileSync(filePath, 'utf8');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`✅ Migration ${path.basename(filePath)} completed successfully`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${path.basename(filePath)} failed:`, err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

const file = process.argv[2];
if (!file) {
    console.error('Please provide a migration file path');
    process.exit(1);
}

runMigration(path.resolve(file));
