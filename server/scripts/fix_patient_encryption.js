const encryptionService = require('../services/encryptionService.js');
const pool = require('../db.js');

async function fix() {
    try {
        const encFName = await encryptionService.encryptFieldToBase64('Arantxa');
        const encLName = await encryptionService.encryptFieldToBase64('Estolt');
        const encCountry = await encryptionService.encryptFieldToBase64('United States');

        const res = await pool.query(`SELECT encryption_metadata FROM tenant_miami_cardiology_institute.patients WHERE id = 'a01ff686-d21a-48e7-8925-4903740cdf38'`);
        // Ensure meta is an object
        let meta = res.rows[0].encryption_metadata;
        if (typeof meta === 'string') meta = JSON.parse(meta);
        if (!meta) meta = {};

        meta.first_name = encFName.metadata;
        meta.last_name = encLName.metadata;
        meta.country = encCountry.metadata;

        await pool.query(
            `UPDATE tenant_miami_cardiology_institute.patients SET first_name = $1, last_name = $2, country = $3, encryption_metadata = $4 WHERE id = 'a01ff686-d21a-48e7-8925-4903740cdf38'`,
            [encFName.ciphertext, encLName.ciphertext, encCountry.ciphertext, JSON.stringify(meta)]
        );

        console.log('Successfully repaired patient encryption metadata and restored missing PHI keys.');
    } catch (e) {
        console.error('Error during script:', e);
    } finally {
        process.exit();
    }
}
fix();
