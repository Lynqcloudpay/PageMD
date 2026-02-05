const pool = require('./db');

async function check() {
    try {
        const res = await pool.query('SELECT * FROM sales_inquiries LIMIT 1');
        console.log('Sample Data:', res.rows);
    } catch (err) {
        console.error('Query failed:', err.message);
    } finally {
        process.exit();
    }
}

check();
