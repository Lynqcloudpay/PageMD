const pool = require('./server/db');
async function check() {
    try {
        const res = await pool.controlPool.query("SELECT * FROM platform_user_lookup WHERE email = 'admin@miami.com'");
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
