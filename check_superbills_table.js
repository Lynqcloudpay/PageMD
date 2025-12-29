const pool = require('./server/db');
async function checkTable() {
    try {
        const res = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'superbills')");
        console.log('Superbills table exists:', res.rows[0].exists);
        if (res.rows[0].exists) {
            const columns = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'superbills'");
            console.log('Columns:', columns.rows);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}
checkTable();
