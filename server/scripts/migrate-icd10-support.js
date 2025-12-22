const pool = require('../db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrateICD10Support() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, 'migrations', '20251222_icd10_support.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🚀 Starting ICD-10 Support Migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('✅ Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrateICD10Support().then(() => process.exit(0));
