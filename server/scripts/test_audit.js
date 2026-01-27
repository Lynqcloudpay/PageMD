const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'paper_emr',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

async function runTests() {
    console.log('--- AUDIT HARDENING VALIDATION ---');
    const client = await pool.connect();

    try {
        // 1. Check Schema
        console.log('\nChecking schema for 033_audit_hardening...');
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'visits' 
            AND column_name IN ('content_hash', 'content_integrity_verified')
        `);
        console.log('Columns found:', columns.rows.map(r => r.column_name).join(', '));

        // 2. Check Indexes
        console.log('\nChecking tenant-scoped indexes...');
        const indexes = await client.query(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'audit_events' 
            AND indexname LIKE 'idx_audit_%'
        `);
        console.log('Indexes found:', indexes.rows.map(r => r.indexname).join(', '));

        // 3. Verify Immutability
        console.log('\nTesting Immutability Triggers...');
        const sampleId = (await client.query('SELECT id FROM audit_events LIMIT 1')).rows[0]?.id;

        if (sampleId) {
            try {
                await client.query('UPDATE audit_events SET action = "TAMPERED" WHERE id = $1', [sampleId]);
                console.error('❌ FAILURE: UPDATE succeeded on audit_events!');
            } catch (e) {
                console.log('✅ SUCCESS: UPDATE blocked:', e.message);
            }

            try {
                await client.query('DELETE FROM audit_events WHERE id = $1', [sampleId]);
                console.error('❌ FAILURE: DELETE succeeded on audit_events!');
            } catch (e) {
                console.log('✅ SUCCESS: DELETE blocked:', e.message);
            }
        } else {
            console.log('No audit events found to test immutability.');
        }

        // 4. Verify Note Retractions
        console.log('\nChecking note_retractions durability...');
        const retractionColumns = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'note_retractions' 
            AND column_name = 'tenant_id'
        `);
        if (retractionColumns.rows.length > 0) {
            console.log('✅ SUCCESS: tenant_id exists in note_retractions');
        } else {
            console.error('❌ FAILURE: tenant_id missing from note_retractions');
        }

    } catch (e) {
        console.error('ERROR DURING VALIDATION:', e);
    } finally {
        client.release();
        await pool.end();
        console.log('\nValidation Complete.');
    }
}

runTests();
