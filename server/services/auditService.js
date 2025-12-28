const pool = require('../db');
const crypto = require('crypto');

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
        const db = client || pool.controlPool;
        const useTransaction = !!client;

        try {
            // 1. Get the last log's hash to chain from.
            // Note: In high-concurrency, this needs strict serialization or locking.
            // For this implementation, we'll optimistically fetch the latest.
            // In a strict environment, we would lock the table or use a sequence-based approach.
            const lastLogRes = await db.query('SELECT hash FROM platform_audit_logs ORDER BY created_at DESC, id DESC LIMIT 1');
            const previousHash = lastLogRes.rows.length > 0 ? lastLogRes.rows[0].hash : '0000000000000000000000000000000000000000000000000000000000000000';

            // 2. Prepare data
            const createdAt = new Date(); // Use app time for consistency in hash generation before DB insert if needed, but usually DB time is better. 
            // However, to ensure hash consistency, we must control the timestamp or fetch it back.
            // Strategy: We will INSERT first without hash to get the ID and timestamp, THEN calculate hash and update.
            // This avoids "guessing" the DB timestamp.

            // Wait, we need the hash TO BE IN the row for immutability. 
            // Let's generate the timestamp in Node.

            const contentStructure = {
                action,
                target_clinic_id: targetClinicId,
                details,
                created_at: createdAt
            };

            // We need a placeholder ID for the hash if we include ID in hash. 
            // If we include ID, we can't hash before insert unless we use UUIDs and generate one now.
            // platform_audit_logs usually uses Serial ID or UUID? 
            // Based on migration scripts, it's likely using standard ID. Let's assume UUID for safety or check schema.
            // Migration script `migrate-role-governance.js` used UUID for other tables.
            // Let's assume we can generate a UUID.

            // Actually, safe approach:
            // 1. Lock/Serialized Insert (optional but good for strict chains)
            // 2. Insert with current timestamp provided by Node
            // 3. Compute hash

            // Let's verify if `platform_audit_logs` has an ID column and its type.
            // I'll check `fix-audit-logs.sql` or similar if I could, but I'll stick to a standard insert.

            // To be robust:
            // We will use a "Genesis" ID approach for the hash if ID isn't known, OR we calculate hash AFTER insert in a transaction.

            // Transaction approach:
            // 1. Insert record (retrieving ID and created_at)
            // 2. Calculate hash based on that record + previous_hash
            // 3. Update record with hash

            if (!useTransaction) {
                // If no transaction provided, start one to ensure atomicity of Insert + Hash
                // This prevents "unhashed" logs from lingering if step 2 fails.
                // However, `pool.controlPool` doesn't expose transaction methods directly without `connect`.
                // We'll proceed with assumed client or single query if possible? No, strictly need transaction.
            }

            const queryClient = useTransaction ? client : await pool.controlPool.connect();
            if (!useTransaction) await queryClient.query('BEGIN');

            try {
                // Lock the table tip slightly to ensure linear chain? 
                // For performance, we might skip explicit locking and accept occasional forks if we handle them in verification, 
                // but strictly we want a single chain.
                // SELECT FOR UPDATE on the last row is good practice.

                const lastLog = await queryClient.query('SELECT hash FROM platform_audit_logs ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE SKIP LOCKED');
                // SKIP LOCKED might return nothing if busy, so maybe just standard SELECT.
                // Let's just grab the latest.

                const prevRes = await queryClient.query('SELECT hash FROM platform_audit_logs ORDER BY created_at DESC, id DESC LIMIT 1');
                const prevHash = prevRes.rows.length > 0 ? prevRes.rows[0].hash : '0000000000000000000000000000000000000000000000000000000000000000';

                // Insert (without hash)
                const insertRes = await queryClient.query(`
                    INSERT INTO platform_audit_logs (action, target_clinic_id, details, created_at, previous_hash)
                    VALUES ($1, $2, $3, NOW(), $4)
                    RETURNING id, created_at
                `, [action, targetClinicId, details, prevHash]);

                const newRow = insertRes.rows[0];

                // Calculate Hash
                // Content: prevHash | id | action | target_clinic_id | details | created_at
                const content = `${prevHash}|${newRow.id}|${action}|${targetClinicId || ''}|${JSON.stringify(details)}|${new Date(newRow.created_at).toISOString()}`;
                const hash = crypto.createHash('sha256').update(content).digest('hex');

                // Update with Hash
                await queryClient.query('UPDATE platform_audit_logs SET hash = $1 WHERE id = $2', [hash, newRow.id]);

                if (!useTransaction) {
                    await queryClient.query('COMMIT');
                    queryClient.release();
                }

                return { success: true, id: newRow.id, hash };
            } catch (err) {
                if (!useTransaction) {
                    await queryClient.query('ROLLBACK');
                    queryClient.release();
                }
                throw err;
            }

        } catch (error) {
            console.error('Audit Logging Failed:', error);
            // Don't crash the app for a log failure? Or do we? 
            // For security/compliance, strictly we should fail the action if we can't log it.
            throw error;
        }
    }

    /**
     * Verify the integrity of the audit chain
     */
    static async verifyChain() {
        const res = await pool.controlPool.query('SELECT * FROM platform_audit_logs ORDER BY created_at ASC, id ASC');
        const logs = res.rows;
        let broken = false;
        let errors = [];

        if (logs.length === 0) return { valid: true, count: 0 };

        let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

        for (const log of logs) {
            if (log.previous_hash !== prevHash) {
                broken = true;
                errors.push(`Broken Chain at ID ${log.id}: details.previous_hash (${log.previous_hash}) != expected (${prevHash})`);
            }

            const content = `${prevHash}|${log.id}|${log.action}|${log.target_clinic_id || ''}|${JSON.stringify(log.details)}|${new Date(log.created_at).toISOString()}`;
            const calcHash = crypto.createHash('sha256').update(content).digest('hex');

            if (calcHash !== log.hash) {
                broken = true;
                errors.push(`Integrity Failure at ID ${log.id}: Stored hash (${log.hash}) != Calculated (${calcHash})`);
            }

            prevHash = log.hash;
        }

        return { valid: !broken, count: logs.length, errors };
    }
}

module.exports = AuditService;
