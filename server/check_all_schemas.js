const pool = require('./db');

async function check() {
    try {
        const res = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE '%sales%'
        `);
        console.log('Sales related tables in all schemas:', res.rows);
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        process.exit();
    }
}

check();
