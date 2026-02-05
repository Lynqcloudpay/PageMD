const pool = require('./db');

async function check() {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE '%sales%'
        `);
        console.log('Sales related tables:', res.rows.map(r => r.table_name));
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        process.exit();
    }
}

check();
