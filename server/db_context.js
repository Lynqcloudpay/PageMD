const pool = require('./db');

async function check() {
    try {
        const res = await pool.query('SELECT current_database(), current_user, version()');
        console.log('DB Context:', res.rows[0]);

        const res2 = await pool.query('SELECT nspname FROM pg_catalog.pg_namespace');
        console.log('Schemas:', res2.rows.map(r => r.nspname));
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        process.exit();
    }
}

check();
