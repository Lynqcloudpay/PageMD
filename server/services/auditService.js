const pool = require('../db');
const crypto = require('crypto');

/**
 * Helper to ensure JSON serialization is deterministic (keys sorted)
 */
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

/**
 * Audit Service
 * Handles secure logging with cryptographic chaining (SHA-256).
 */
class AuditService {

    /**
     * Create a tamper-evident audit log entry
     * @param {Object} client - Database client (optional, for transactions)
     * @param {string} action - The action performed (e.g., 'clinic_created')
     * @param {string} targetClinicId - The UUID of the affected clinic
     * @param {Object} details - JSON details of the event
     */
    static async log(client, action, targetClinicId, details) {
        const useTransaction = !!client;

        // Use provided client or lease a new one
        const queryClient = useTransaction ? client : await pool.controlPool.connect();

        try {
            if (!useTransaction) await queryClient.query('BEGIN');

            // 1. Serialization Lock
            // Obtain an advisory xact (transaction-level) lock to ensure strictly linear chaining.
            // ID 1001 is arbitrarily chosen for 'AUDIT_LOG_WRITE_LOCK'
            await queryClient.query('SELECT pg_advisory_xact_lock(1001)');

            // 2. Get the Tip of the Chain
            // Using a standard SELECT is now safe because we are serialized by the advisory lock.
            const prevRes = await queryClient.query('SELECT hash FROM platform_audit_logs ORDER BY created_at DESC, id DESC LIMIT 1');
            const previousHash = prevRes.rows.length > 0 ? prevRes.rows[0].hash : '0000000000000000000000000000000000000000000000000000000000000000';

            // 3. Prepare Timestamp
            // We use DB time for creation ? No, we need time in the hash calculation.
            // To be precise: We'll calculate hash in App using App Time, then insert.
            const createdAt = new Date().toISOString();

            // 4. Draft Insert to get ID (Optional? No, we need ID for hash?)
            // If we include ID in the hash, we must INSERT first then UPDATE. 
            // BUT, if we insert first, we might break the chain if we crash before update.
            // Ideally content shouldn't depend on ID generated *after*.
            // The requirement says: hash_i = SHA256( canonical(event_i) + previous_hash_i )
            // event_i includes 'id' according to previous implementation.
            // Let's stick to the Insert-then-Update pattern, relying on the Transaction to safeguard validity.
            // The Advisory Lock holds until Commit, so no one else can insert in between.

            const insertRes = await queryClient.query(`
                INSERT INTO platform_audit_logs (action, target_clinic_id, details, created_at, previous_hash)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, created_at
            `, [action, targetClinicId, details, createdAt, previousHash]);

            const newRow = insertRes.rows[0];
            const newId = newRow.id;

            // Match created_at precision by using the DB-returned value
            // newRow.created_at is a Date object (parsed from TIMESTAMPTZ)
            // This ensures log() and verifyChain() use the exact same epoch time.
            const timestampEpoch = new Date(newRow.created_at).getTime();

            // 5. Calculate Hash
            // Content: prevHash|id|action|target_clinic_id|details|timestampEpoch
            const content = `${previousHash}|${newId}|${action}|${targetClinicId || ''}|${stableStringify(details)}|${timestampEpoch}`;
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            // 6. Update Row
            await queryClient.query('UPDATE platform_audit_logs SET hash = $1 WHERE id = $2', [hash, newId]);

            if (!useTransaction) {
                await queryClient.query('COMMIT');
            }

            return { success: true, id: newId, hash };

        } catch (error) {
            if (!useTransaction) await queryClient.query('ROLLBACK');
            console.error('Audit Logging Failed:', error);
            throw error; // Propagate error, auditing is critical
        } finally {
            if (!useTransaction) queryClient.release();
        }
    }

    /**
     * Verify the integrity of the audit chain
     * @param {number} limit - Number of logs to verify (default 1000)
     */
    static async verifyChain(limit = 1000) {
        const res = await pool.controlPool.query(`
            SELECT * FROM platform_audit_logs 
            ORDER BY created_at ASC, id ASC
            LIMIT $1
        `, [limit]); // Note: Ideally we page this, but for Phase 3 limit is acceptable

        const logs = res.rows;
        let broken = false;
        let errors = [];

        if (logs.length === 0) return { valid: true, count: 0, errors: [] };

        // We need to know where the chain segment starts.
        // If we fetched from 0 (Genesis), prev is 000...
        // If we fetched a slice, we need the preceding row to check valid start?
        // For now, assuming Full Verification from Genesis or accepting first prev_hash as "Given".
        // Requirement implies verifying the *retrieved* chain.
        // If LIMIT is small, we might start in middle.
        // Let's assume we verify from Genesis if we want TRUE audit.
        // But for the endpoint, let's verify internally consistency of the returned block.
        // Warning: If we don't start at Genesis, we can't verify the very first row of the block.

        // Adjusted Strategy: Always load from Genesis for pure verification, but limit might truncate.
        // Let's follow requirement "verify chain ... returns first broken row id".

        let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

        for (const log of logs) {
            // Check Previous Hash Link
            if (log.previous_hash !== prevHash) {
                broken = true;
                errors.push(`Broken Chain at ID ${log.id}: Stored prev_hash (${log.previous_hash}) != Expected (${prevHash})`);
            }

            // Recompute Hash (Tamper check)
            const timestampEpoch = new Date(log.created_at).getTime();
            const content = `${log.previous_hash}|${log.id}|${log.action}|${log.target_clinic_id || ''}|${stableStringify(log.details)}|${timestampEpoch}`;
            const calcHash = crypto.createHash('sha256').update(content).digest('hex');

            if (calcHash !== log.hash) {
                broken = true;
                errors.push(`Integrity Failure at ID ${log.id}: Stored hash (${log.hash}) != Calculated (${calcHash})`);
            }

            prevHash = log.hash;
        }

        return { valid: !broken, count: logs.length, errors, brokenAt: errors.length > 0 ? errors[0] : null };
    }
}

module.exports = AuditService;
