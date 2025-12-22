const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function checkData() {
    try {
        const orders = await pool.query("SELECT COUNT(*) FROM orders WHERE order_type IN ('lab', 'imaging')");
        const docs = await pool.query("SELECT COUNT(*) FROM documents");
        const messages = await pool.query("SELECT COUNT(*) FROM messages");

        console.log('--- Data Counts ---');
        console.log('Lab/Imaging Orders:', orders.rows[0].count);
        console.log('Documents:', docs.rows[0].count);
        console.log('Messages:', messages.rows[0].count);

        if (orders.rows[0].count > 0) {
            const sample = await pool.query("SELECT id, order_type, reviewed FROM orders WHERE order_type IN ('lab', 'imaging') LIMIT 1");
            console.log('Sample Order:', sample.rows[0]);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkData();
