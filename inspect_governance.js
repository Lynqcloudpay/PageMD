const pool = require('./server/db');
async function check() {
    try {
        const res = await pool.controlPool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('platform_role_templates', 'platform_role_template_privileges', 'platform_audit_logs')
      ORDER BY table_name, ordinal_position
    `);
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
