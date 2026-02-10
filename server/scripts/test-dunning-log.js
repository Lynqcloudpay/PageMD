/**
 * Test script to insert a mock dunning log
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
});

async function test() {
    const clinicId = '60456326-868d-4e21-942a-fd35190ed4fc';

    try {
        console.log(`Inserting test dunning log for clinic ${clinicId}...`);

        await pool.query(`
            INSERT INTO clinic_dunning_logs 
            (clinic_id, event_type, previous_phase, current_phase, details) 
            VALUES ($1, $2, $3, $4, $5)
        `, [
            clinicId,
            'phase_escalated',
            0,
            1,
            JSON.stringify({ message: 'Manual test event', triggered_by: 'Antigravity' })
        ]);

        console.log('✅ Test log inserted successfully!');
    } catch (err) {
        console.error('❌ Failed to insert test log:', err);
    } finally {
        await pool.end();
    }
}

test();
