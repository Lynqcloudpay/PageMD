const { Pool } = require('pg');
const patientEncryptionService = require('../services/patientEncryptionService');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db' : 'localhost'),
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || (process.env.NODE_ENV === 'production' ? 'emr_db' : 'paper_emr'),
        user: process.env.DB_USER || (process.env.NODE_ENV === 'production' ? 'emr_user' : 'postgres'),
        password: process.env.DB_PASSWORD || 'postgres',
    };

if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

async function repairPhoneNormalized() {
    const client = await pool.connect();
    console.log('--- Repairing phone_normalized via Decryption (Multi-Tenant Aware) ---');

    try {
        // 1. Get all clinis and their schemas
        const clinicsRes = await client.query('SELECT id, display_name, schema_name FROM public.clinics WHERE schema_name IS NOT NULL');
        console.log(`Found ${clinicsRes.rows.length} clinics/schemas to process.`);

        for (const clinic of clinicsRes.rows) {
            console.log(`\nProcessing clinic: ${clinic.display_name} (${clinic.schema_name})`);

            // Set search path to this tenant
            await client.query(`SET search_path TO ${clinic.schema_name}, public`);

            const res = await client.query('SELECT * FROM patients');
            console.log(`Found ${res.rows.length} patients in ${clinic.schema_name}.`);

            for (const row of res.rows) {
                try {
                    const decrypted = await patientEncryptionService.decryptPatientPHI(row);
                    const p = decrypted.phone || '';
                    const c = decrypted.phone_cell || '';
                    const s = decrypted.phone_secondary || '';
                    const w = decrypted.phone_work || '';

                    const normalized = (p + c + s + w).replace(/\D/g, '');

                    if (normalized) {
                        await client.query(
                            'UPDATE patients SET phone_normalized = $1 WHERE id = $2',
                            [normalized, row.id]
                        );
                        process.stdout.write('.');
                    }
                } catch (err) {
                    console.error(`\nFailed to process patient ${row.id}:`, err.message);
                }
            }
            console.log(`\nDone with ${clinic.display_name}`);
        }

        console.log('\n✅ All tenants processed.');
    } catch (error) {
        console.error('❌ Repair failed:', error);
    } finally {
        // Reset search path
        try { await client.query('SET search_path TO public'); } catch (e) { }
        client.release();
        await pool.end();
    }
}

repairPhoneNormalized();
