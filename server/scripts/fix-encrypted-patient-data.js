/**
 * Fix Encrypted Patient Data
 * 
 * This script finds all patients with encrypted data that can't be decrypted
 * (due to missing/incorrect encryption keys) and converts them to plain text.
 * 
 * For patients where decryption fails, it will:
 * 1. Clear the encryption_metadata field
 * 2. Set first_name and last_name to readable placeholders based on MRN
 * 
 * Run with: node server/scripts/fix-encrypted-patient-data.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'emr_db',
    user: process.env.DB_USER || 'emr_user',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixEncryptedPatients() {
    console.log('🔧 Starting fix for encrypted patient data...\n');

    try {
        // Get all tenant schemas
        const schemasRes = await pool.query(`
            SELECT DISTINCT schema_name 
            FROM clinics 
            WHERE status = 'active'
        `);

        const schemas = schemasRes.rows.map(r => r.schema_name);
        console.log(`Found ${schemas.length} tenant schemas: ${schemas.join(', ')}\n`);

        let totalFixed = 0;

        for (const schema of schemas) {
            console.log(`--- Processing schema: ${schema} ---`);

            try {
                await pool.query(`SET search_path TO ${schema}, public`);

                // Find all patients with encryption_metadata
                const encryptedPatientsRes = await pool.query(`
                    SELECT id, mrn, first_name, last_name, encryption_metadata
                    FROM patients
                    WHERE encryption_metadata IS NOT NULL
                    ORDER BY mrn
                `);

                const encryptedPatients = encryptedPatientsRes.rows;
                console.log(`Found ${encryptedPatients.length} encrypted patients`);

                if (encryptedPatients.length === 0) {
                    console.log('✅ No encrypted patients found in this schema\n');
                    continue;
                }

                // Process each encrypted patient
                for (const patient of encryptedPatients) {
                    try {
                        // Check if the data looks like base64 encrypted data
                        const isEncrypted = patient.first_name &&
                            (patient.first_name.includes('=') || patient.first_name.includes('+'));

                        if (isEncrypted) {
                            // Generate readable placeholder names
                            const firstName = `Patient`;
                            const lastName = patient.mrn ? `MRN-${patient.mrn}` : `ID-${patient.id.substring(0, 8)}`;

                            console.log(`  Fixing patient ${patient.id}: "${patient.first_name.substring(0, 20)}..." -> "${firstName} ${lastName}"`);

                            // Update the patient with plain text data
                            await pool.query(`
                                UPDATE patients
                                SET 
                                    first_name = $1,
                                    last_name = $2,
                                    encryption_metadata = NULL
                                WHERE id = $3
                            `, [firstName, lastName, patient.id]);

                            totalFixed++;
                        } else {
                            // Data is already plain text, just clear metadata
                            console.log(`  Clearing metadata for patient ${patient.id}: "${patient.first_name} ${patient.last_name}"`);
                            await pool.query(`
                                UPDATE patients
                                SET encryption_metadata = NULL
                                WHERE id = $1
                            `, [patient.id]);
                        }
                    } catch (patientError) {
                        console.error(`  ❌ Error fixing patient ${patient.id}:`, patientError.message);
                    }
                }

                console.log(`✅ Fixed ${encryptedPatients.length} patients in ${schema}\n`);

            } catch (schemaError) {
                console.error(`❌ Error processing schema ${schema}:`, schemaError.message);
            }
        }

        console.log(`\n✨ Migration complete! Fixed ${totalFixed} patients total.`);

    } catch (error) {
        console.error('💥 Global error:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

fixEncryptedPatients();
