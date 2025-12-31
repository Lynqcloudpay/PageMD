const pool = require('./server/db');
async function checkPatient() {
    try {
        const result = await pool.query("SELECT id, first_name, last_name, clinic_id FROM patients WHERE first_name ILIKE '%arantxa%'");
        console.log('Matches:', JSON.stringify(result.rows, null, 2));

        // Also check current users
        const users = await pool.query("SELECT id, email, clinic_id FROM users");
        console.log('Users:', JSON.stringify(users.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
checkPatient();
