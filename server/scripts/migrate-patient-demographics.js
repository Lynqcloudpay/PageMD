/**
 * Migration: Add comprehensive patient demographics fields
 * 
 * Adds fields commonly found in commercial EMR systems like Epic, Cerner, Allscripts
 */

const pool = require('../db');

async function migrate() {
    console.log('Starting patient demographics migration...');
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Add new columns one by one with existence checks
        const columnsToAdd = [
            // Name fields
            { name: 'middle_name', type: 'VARCHAR(100)' },
            { name: 'name_suffix', type: 'VARCHAR(10)', comment: 'Jr, Sr, II, III, etc.' },
            { name: 'preferred_name', type: 'VARCHAR(100)', comment: 'Preferred first name' },
            
            // Demographics
            { name: 'gender', type: 'VARCHAR(20)', comment: 'More detailed than sex: Male, Female, Non-binary, Prefer not to say' },
            { name: 'race', type: 'VARCHAR(100)', comment: 'American Indian, Asian, Black, White, etc.' },
            { name: 'ethnicity', type: 'VARCHAR(100)', comment: 'Hispanic, Non-Hispanic, etc.' },
            { name: 'marital_status', type: 'VARCHAR(50)', comment: 'Single, Married, Divorced, Widowed, Domestic Partner' },
            { name: 'employment_status', type: 'VARCHAR(50)', comment: 'Employed, Unemployed, Retired, Student, Disabled' },
            { name: 'occupation', type: 'VARCHAR(255)' },
            { name: 'employer_name', type: 'VARCHAR(255)' },
            
            // Contact information
            { name: 'phone_secondary', type: 'VARCHAR(20)', comment: 'Alternate phone' },
            { name: 'phone_cell', type: 'VARCHAR(20)', comment: 'Cell phone' },
            { name: 'phone_work', type: 'VARCHAR(20)', comment: 'Work phone' },
            { name: 'phone_preferred', type: 'VARCHAR(20)', comment: 'Primary, Secondary, Cell, Work' },
            { name: 'email_secondary', type: 'VARCHAR(255)' },
            { name: 'preferred_language', type: 'VARCHAR(50)', comment: 'English, Spanish, etc.' },
            { name: 'interpreter_needed', type: 'BOOLEAN DEFAULT false' },
            
            // Address details
            { name: 'country', type: 'VARCHAR(100) DEFAULT \'United States\'' },
            { name: 'address_type', type: 'VARCHAR(20) DEFAULT \'Home\'', comment: 'Home, Work, Mailing' },
            { name: 'address_validated', type: 'BOOLEAN DEFAULT false' },
            
            // Emergency Contact
            { name: 'emergency_contact_name', type: 'VARCHAR(255)' },
            { name: 'emergency_contact_phone', type: 'VARCHAR(20)' },
            { name: 'emergency_contact_relationship', type: 'VARCHAR(100)', comment: 'Spouse, Parent, Sibling, etc.' },
            { name: 'emergency_contact_address', type: 'TEXT' },
            { name: 'emergency_contact_2_name', type: 'VARCHAR(255)' },
            { name: 'emergency_contact_2_phone', type: 'VARCHAR(20)' },
            { name: 'emergency_contact_2_relationship', type: 'VARCHAR(100)' },
            
            // Insurance details
            { name: 'insurance_group_number', type: 'VARCHAR(100)' },
            { name: 'insurance_plan_name', type: 'VARCHAR(255)' },
            { name: 'insurance_plan_type', type: 'VARCHAR(50)', comment: 'HMO, PPO, POS, etc.' },
            { name: 'insurance_subscriber_name', type: 'VARCHAR(255)', comment: 'If different from patient' },
            { name: 'insurance_subscriber_dob', type: 'DATE', comment: 'DOB of insurance subscriber' },
            { name: 'insurance_subscriber_relationship', type: 'VARCHAR(50)', comment: 'Self, Spouse, Child, etc.' },
            { name: 'insurance_copay', type: 'DECIMAL(10,2)' },
            { name: 'insurance_effective_date', type: 'DATE' },
            { name: 'insurance_expiry_date', type: 'DATE' },
            { name: 'insurance_notes', type: 'TEXT' },
            
            // Pharmacy details
            { name: 'pharmacy_npi', type: 'VARCHAR(50)', comment: 'Pharmacy NPI number' },
            { name: 'pharmacy_fax', type: 'VARCHAR(20)' },
            { name: 'pharmacy_preferred', type: 'BOOLEAN DEFAULT true' },
            
            // Additional information
            { name: 'referral_source', type: 'VARCHAR(255)', comment: 'How patient heard about clinic' },
            { name: 'communication_preference', type: 'VARCHAR(50)', comment: 'Phone, Email, Text, Mail' },
            { name: 'consent_to_text', type: 'BOOLEAN DEFAULT false' },
            { name: 'consent_to_email', type: 'BOOLEAN DEFAULT false' },
            { name: 'smoking_status', type: 'VARCHAR(50)', comment: 'Never, Current, Former, Unknown' },
            { name: 'alcohol_use', type: 'VARCHAR(50)', comment: 'None, Social, Regular, Heavy' },
            { name: 'allergies_known', type: 'BOOLEAN DEFAULT false' },
            { name: 'deceased', type: 'BOOLEAN DEFAULT false' },
            { name: 'deceased_date', type: 'DATE' },
            { name: 'notes', type: 'TEXT', comment: 'General notes about patient' },
        ];

        for (const column of columnsToAdd) {
            try {
                const checkColumn = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'patients' AND column_name = $1
                `, [column.name]);

                if (checkColumn.rows.length === 0) {
                    await client.query(`
                        ALTER TABLE patients 
                        ADD COLUMN ${column.name} ${column.type}
                    `);
                    console.log(`✅ Added column: ${column.name}`);
                } else {
                    console.log(`⚠️  Column already exists: ${column.name}`);
                }
            } catch (error) {
                console.error(`❌ Error adding column ${column.name}:`, error.message);
                // Continue with other columns
            }
        }

        // Add index on commonly queried fields
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_patients_dob ON patients(dob);
            `);
            console.log('✅ Added indexes');
        } catch (error) {
            console.warn('⚠️  Index creation warning:', error.message);
        }

        await client.query('COMMIT');
        console.log('✅ Patient demographics migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = migrate;





















