const { Pool } = require('pg');
require('dotenv').config({ path: '/home/ubuntu/emr/deploy/.env.prod' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function check() {
    try {
        const res = await pool.query("SELECT id, medication_name, active, status FROM medications WHERE medication_name ILIKE '%HCTZ%'");
        console.log('HCTZ Status:', res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
