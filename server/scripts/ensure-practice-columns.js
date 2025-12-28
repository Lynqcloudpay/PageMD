const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function ensureColumns() {
    const columnsToAdd = [
        { name: 'practice_type', type: 'VARCHAR(100)' },
        { name: 'tax_id', type: 'VARCHAR(50)' },
        { name: 'npi', type: 'VARCHAR(10)' },
        { name: 'address_line1', type: 'VARCHAR(255)' },
        { name: 'address_line2', type: 'VARCHAR(255)' },
        { name: 'city', type: 'VARCHAR(100)' },
        { name: 'state', type: 'VARCHAR(50)' },
        { name: 'zip', type: 'VARCHAR(20)' },
        { name: 'phone', type: 'VARCHAR(20)' },
        { name: 'fax', type: 'VARCHAR(20)' },
        { name: 'email', type: 'VARCHAR(255)' },
        { name: 'website', type: 'VARCHAR(255)' },
        { name: 'logo_url', type: 'TEXT' },
        { name: 'timezone', type: 'VARCHAR(50)', default: "'America/New_York'" },
        { name: 'date_format', type: 'VARCHAR(20)', default: "'MM/DD/YYYY'" },
        { name: 'time_format', type: 'VARCHAR(20)', default: "'12h'" }
    ];

    try {
        for (const col of columnsToAdd) {
            const checkRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'practice_settings' AND column_name = $1
      `, [col.name]);

            if (checkRes.rows.length === 0) {
                console.log(`Adding column ${col.name}...`);
                let query = `ALTER TABLE practice_settings ADD COLUMN ${col.name} ${col.type}`;
                if (col.default) {
                    query += ` DEFAULT ${col.default}`;
                }
                await pool.query(query);
            } else {
                console.log(`Column ${col.name} already exists.`);
            }
        }
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

ensureColumns();
