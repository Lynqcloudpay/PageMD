const pool = require('./db');

async function fixColumnLengths() {
    console.log('🚀 Starting column length fix...');

    try {
        // 1. Fix clinic_settings table in control DB
        console.log('Updating clinic_settings table...');
        await pool.controlPool.query(`
      ALTER TABLE clinic_settings 
      ALTER COLUMN time_zone TYPE VARCHAR(255),
      ALTER COLUMN date_format TYPE VARCHAR(100),
      ALTER COLUMN time_format TYPE VARCHAR(100);
    `);

        // 2. Fix clinics table in control DB
        console.log('Updating clinics table...');
        await pool.controlPool.query(`
      ALTER TABLE clinics
      ALTER COLUMN tax_id TYPE VARCHAR(100),
      ALTER COLUMN npi TYPE VARCHAR(100),
      ALTER COLUMN state TYPE VARCHAR(100),
      ALTER COLUMN zip TYPE VARCHAR(100);
    `);

        // 3. Fix practice_settings table in all tenant schemas
        console.log('Fetching tenant schemas...');
        const tenants = await pool.controlPool.query('SELECT schema_name FROM clinics');

        for (const tenant of tenants.rows) {
            const schema = tenant.schema_name;
            console.log(`Updating practice_settings in schema: ${schema}...`);
            try {
                await pool.controlPool.query(`
          ALTER TABLE ${schema}.practice_settings 
          ALTER COLUMN tax_id TYPE VARCHAR(100),
          ALTER COLUMN npi TYPE VARCHAR(100),
          ALTER COLUMN state TYPE VARCHAR(100),
          ALTER COLUMN zip TYPE VARCHAR(100),
          ALTER COLUMN phone TYPE VARCHAR(100),
          ALTER COLUMN fax TYPE VARCHAR(100),
          ALTER COLUMN timezone TYPE VARCHAR(255),
          ALTER COLUMN date_format TYPE VARCHAR(100),
          ALTER COLUMN time_format TYPE VARCHAR(100);
        `);
            } catch (e) {
                console.warn(`Could not update schema ${schema}:`, e.message);
            }
        }

        console.log('✅ Column length fix completed successfully!');
    } catch (error) {
        console.error('❌ Error during column length fix:', error);
    } finally {
        process.exit(0);
    }
}

fixColumnLengths();
