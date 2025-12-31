const pool = require('./server/db');
async function fix() {
    try {
        // Get the first clinic's ID
        const clinics = await pool.query("SELECT id FROM clinics LIMIT 1");
        if (clinics.rows.length > 0) {
            const clinicId = clinics.rows[0].id;
            console.log('Using clinic_id:', clinicId);

            // Update the Arantxa patient to have this clinic_id
            const result = await pool.query(
                "UPDATE patients SET clinic_id = $1 WHERE first_name ILIKE '%arantxa%'",
                [clinicId]
            );
            console.log('Updated patients:', result.rowCount);

            // Also update the user to have this clinic_id if they don't
            const users = await pool.query("UPDATE users SET role = 'admin' WHERE email = 'mjrodriguez@gmail.com'");
            console.log('Updated user status');
        } else {
            console.log('No clinics found to associate patient with.');
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
fix();
