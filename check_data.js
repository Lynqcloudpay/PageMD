const pool = require('./server/db');
async function check() {
    try {
        const users = await pool.query("SELECT id, email, clinic_id, role FROM users");
        console.log('Users:', JSON.stringify(users.rows, null, 2));
        const clinics = await pool.query("SELECT id, name, slug FROM clinics");
        console.log('Clinics:', JSON.stringify(clinics.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
check();
