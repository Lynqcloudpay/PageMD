const pool = require('../db');

async function testQuery() {
    try {
        const patientId = '00000000-0000-0000-0000-000000000000'; // Dummy or need real one?
        // Let's get "any" patient ID first
        const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
        if (pRes.rows.length === 0) {
            console.log('No patients found');
            return;
        }
        const realPatientId = pRes.rows[0].id;
        console.log('Testing with patient ID:', realPatientId);

        const query = `SELECT 
        p.id, p.patient_id, p.prescriber_user_id, p.medication_name, p.sig,
        p.quantity, p.days_supply, p.refills, p.status, p.vendor_message_id,
        p.vendor_payload, p.sent_at, p.filled_at, p.created_at, p.updated_at,
        u.first_name || ' ' || u.last_name as prescriber_name
       FROM prescriptions p
       LEFT JOIN users u ON p.prescriber_user_id = u.id
       WHERE p.patient_id = $1
       ORDER BY p.created_at DESC
       LIMIT 100`;

        console.log('Inserting dummy prescription...');
        // Insert dummy
        const prescriberRes = await pool.query('SELECT id FROM users LIMIT 1');
        const prescriberId = prescriberRes.rows[0].id;

        await pool.query(`INSERT INTO prescriptions (patient_id, prescriber_id, prescriber_user_id, medication_name, quantity, sig, vendor_payload, created_by, written_date) VALUES ($1, $2, $2, 'Test Med', 10, 'Take 1', '{"test": true}', $2, NOW())`, [realPatientId, prescriberId]);


        const res = await pool.query(query, [realPatientId]);
        console.log('Query success! Rows:', res.rows.length);
        if (res.rows.length > 0) {
            const row = res.rows.find(r => r.medication_name === 'Test Med') || res.rows[0];
            // mimic the map
            const mapped = {
                ...row,
                vendor_payload: typeof row.vendor_payload === 'string' ? JSON.parse(row.vendor_payload) : row.vendor_payload
            };
            console.log('Mapped row payload type:', typeof mapped.vendor_payload);
            console.log('Payload:', mapped.vendor_payload);
        }

    } catch (error) {
        console.error('Query failed:', error);
    } finally {
        pool.end();
    }
}

testQuery();
