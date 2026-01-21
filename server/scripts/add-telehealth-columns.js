/**
 * Add Telehealth Columns
 * 
 * This script adds 'visit_method' column to appointments and portal_appointment_requests tables.
 * 
 * Usage: node scripts/add-telehealth-columns.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if available (production/Docker), otherwise use individual env vars
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
            ? false
            : {
                rejectUnauthorized: false // Allow self-signed certificates
            },
    })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

async function addTelehealthColumns() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('Adding visit_method columns...');

        // Add visit_method to appointments
        await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='visit_method'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN visit_method VARCHAR(20) DEFAULT 'office';
        END IF;
      END $$;
    `);
        console.log('✅ Added visit_method column to appointments');

        // Add visit_method to portal_appointment_requests
        await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='portal_appointment_requests' AND column_name='visit_method'
        ) THEN
          ALTER TABLE portal_appointment_requests 
          ADD COLUMN visit_method VARCHAR(20) DEFAULT 'office';
        END IF;
      END $$;
    `);
        console.log('✅ Added visit_method column to portal_appointment_requests');

        await client.query('COMMIT');
        console.log('\n✅ Successfully added visit_method columns!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error adding visit_method columns:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addTelehealthColumns()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    });
