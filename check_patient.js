const pool = require('./server/db');
const patientEncryptionService = require('./server/services/patientEncryptionService');

async function checkPatient() {
    try {
        const result = await pool.query("SELECT * FROM patients WHERE first_name ILIKE '%arantxa%' OR last_name ILIKE '%arantxa%'");
        console.log('Plaintext matches:', result.rows.length);

        if (result.rows.length === 0) {
            console.log('No plaintext matches. Checking all and decrypting...');
            const all = await pool.query("SELECT * FROM patients");
            console.log('Total patients in DB:', all.rows.length);
            const decrypted = await patientEncryptionService.decryptPatientsPHI(all.rows);
            const matches = decrypted.filter(p =>
                (p.first_name && p.first_name.toLowerCase().includes('arantxa')) ||
                (p.last_name && p.last_name.toLowerCase().includes('arantxa'))
            );
            console.log('Decrypted matches:', matches.length);
            if (matches.length > 0) {
                console.log('First match ID:', matches[0].id);
                console.log('Match details:', {
                    first_name: matches[0].first_name,
                    last_name: matches[0].last_name,
                    mrn: matches[0].mrn
                });
            }
        } else {
            console.log('Match found in plaintext.');
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkPatient();
