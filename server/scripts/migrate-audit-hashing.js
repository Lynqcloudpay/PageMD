/**
 * Phase 3 Migration: Audit Trail Hashing (Cryptographic Chaining)
 * Adds hash and previous_hash columns to platform_audit_logs.
 * Retroactively hashes existing logs to establish a baseline chain.
 */
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(stableStringify).join(',') + ']';
    }
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map(key => {
        return JSON.stringify(key) + ':' + stableStringify(obj[key]);
    });
    return '{' + parts.join(',') + '}';
}

function generateHash(prevHash, entry) {
    // Must match AuditService.js logic exactly
    const timestampEpoch = new Date(entry.created_at).getTime();
    const content = `${prevHash}|${entry.id}|${entry.action}|${entry.target_clinic_id || ''}|${stableStringify(entry.details)}|${timestampEpoch}`;
    return crypto.createHash('sha256').update(content).digest('hex');
}

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('--- Starting Phase 3 Migration: Audit Hashing (Re-Hash) ---');

        await client.query('BEGIN');

        // 1. Add columns
        console.log('Ensuring hash columns...');
        await client.query(`
            ALTER TABLE platform_audit_logs 
            ADD COLUMN IF NOT EXISTS hash VARCHAR(64),
            ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64)
        `);

        // 2. Retroactive Hashing (Full Re-Chain)
        console.log('Re-initializing hash chain for ALL logs...');

        // Fetch all logs ordered by time
        const res = await client.query('SELECT * FROM platform_audit_logs ORDER BY created_at ASC, id ASC');
        const logs = res.rows;

        if (logs.length > 0) {
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis hash

            for (const log of logs) {
                const currentHash = generateHash(previousHash, log);

                // Always update to Ensure consistency with new algorithm
                await client.query(`
                    UPDATE platform_audit_logs 
                    SET previous_hash = $1, hash = $2 
                    WHERE id = $3
                `, [previousHash, currentHash, log.id]);

                previousHash = currentHash;
            }
            console.log(`Successfully re-hashed ${logs.length} logs.`);
        } else {
            console.log('No existing logs to hash.');
        }

        // 3. Add Index for verification speed
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_hash ON platform_audit_logs (hash)');

        await client.query('COMMIT');
        console.log('✅ Audit Hashing migration completed successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Audit Hashing migration failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
