const { Pool } = require('pg');
require('dotenv').config();

const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(config);

async function addColumns() {
    const client = await pool.connect();
    try {
        console.log('Adding missing columns to patients table...');

        await client.query('BEGIN');

        const columns = [
            'middle_name TEXT',
            'name_suffix TEXT',
            'preferred_name TEXT',
            'gender TEXT',
            'race TEXT',
            'ethnicity TEXT',
            'marital_status TEXT',
            'phone_secondary TEXT',
            'phone_work TEXT',
            'phone_preferred TEXT',
            'email_secondary TEXT',
            'preferred_language TEXT',
            'interpreter_needed BOOLEAN',
            'communication_preference TEXT',
            'consent_to_text BOOLEAN',
            'consent_to_email BOOLEAN',
            'country TEXT',
            'address_type TEXT',
            'employment_status TEXT',
            'occupation TEXT',
            'employer_name TEXT',
            'emergency_contact_relationship TEXT',
            'emergency_contact_address TEXT',
            'emergency_contact_2_name TEXT',
            'emergency_contact_2_phone TEXT',
            'emergency_contact_2_relationship TEXT',
            'insurance_group_number TEXT',
            'insurance_plan_name TEXT',
            'insurance_plan_type TEXT',
            'insurance_subscriber_name TEXT',
            'insurance_subscriber_dob DATE',
            'insurance_subscriber_relationship TEXT',
            'insurance_copay TEXT',
            'insurance_effective_date DATE',
            'insurance_expiry_date DATE',
            'insurance_notes TEXT',
            'pharmacy_npi TEXT',
            'pharmacy_fax TEXT',
            'pharmacy_preferred BOOLEAN',
            'referral_source TEXT',
            'smoking_status TEXT',
            'alcohol_use TEXT',
            'allergies_known BOOLEAN',
            'deceased BOOLEAN',
            'deceased_date DATE'
        ];

        for (const col of columns) {
            const [name, type] = col.split(' ');
            // Check if column exists
            const res = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'patients' AND column_name = $1
            `, [name]);

            if (res.rows.length === 0) {
                console.log(`Adding column: ${name} (${type})`);
                await client.query(`ALTER TABLE patients ADD COLUMN "${name}" ${type}`);
            } else {
                console.log(`Column ${name} already exists.`);
            }
        }

        await client.query('COMMIT');
        console.log('Successfully added missing columns.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding columns:', err);
    } finally {
        client.release();
        pool.end();
    }
}

addColumns();
