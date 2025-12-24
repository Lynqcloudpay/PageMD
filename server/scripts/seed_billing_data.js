
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function seed() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Create Organization if none exists
        let orgResult = await client.query('SELECT * FROM organizations LIMIT 1');
        let orgId;

        if (orgResult.rows.length === 0) {
            console.log('Seeding Organization...');
            const newOrg = await client.query(`
        INSERT INTO organizations (name, tax_id, npi)
        VALUES ('My Medical Practice', '12-3456789', '1234567890')
        RETURNING id
      `);
            orgId = newOrg.rows[0].id;
        } else {
            orgId = orgResult.rows[0].id;
        }

        // 2. Create Location if none exists
        const locResult = await client.query('SELECT * FROM locations LIMIT 1');
        if (locResult.rows.length === 0) {
            console.log('Seeding Location...');
            await client.query(`
        INSERT INTO locations (
          name, organization_id, npi, pos_code, 
          address_line1, city, state, zip, phone, active
        )
        VALUES (
          'Main Office', $1, '1234567890', '11',
          '123 Medical Blvd', 'New York', 'NY', '10001', '555-0199', true
        )
      `, [orgId]);
        }

        await client.query('COMMIT');
        console.log('✅ Billing data seeded successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(console.error);
