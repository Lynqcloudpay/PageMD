const pool = require('../db');

/**
 * Flag Service
 * Handles background operations for patient flags
 */
const flagService = {
    /**
     * Scan and expire flags that have reached their expires_at date
     */
    expireFlags: async () => {
        const client = await pool.connect();
        try {
            console.log('[FlagService] Scanning for expired flags...');

            // Start transaction
            await client.query('BEGIN');

            // 1. Identify flags that need to be expired
            const expiredFlags = await client.query(`
                SELECT id, patient_id, clinic_id, flag_type_id
                FROM patient_flags
                WHERE status = 'active' 
                AND expires_at IS NOT NULL 
                AND expires_at <= CURRENT_TIMESTAMP
            `);

            if (expiredFlags.rowCount > 0) {
                console.log(`[FlagService] Found ${expiredFlags.rowCount} flags to expire.`);

                // 2. Update status to 'expired'
                await client.query(`
                    UPDATE patient_flags
                    SET status = 'expired',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE status = 'active'
                    AND expires_at IS NOT NULL
                    AND expires_at <= CURRENT_TIMESTAMP
                `);

                // 3. Log to audit logs for each (optional but recommended for HIPAA)
                for (const flag of expiredFlags.rows) {
                    await client.query(`
                        INSERT INTO audit_logs (
                            user_id, action, target_type, target_id, details, outcome
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        null, // System action
                        'flag.expired',
                        'patient',
                        flag.patient_id,
                        JSON.stringify({
                            reason: 'Automated expiration reached',
                            flag_id: flag.id,
                            flag_type_id: flag.flag_type_id
                        }),
                        'success'
                    ]);
                }
            }

            await client.query('COMMIT');
            return expiredFlags.rowCount;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[FlagService] Error expiring flags:', error);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Start the background maintenance job
     */
    startMaintenance: (intervalMs = 3600000) => { // Default to 1 hour
        console.log(`[FlagService] Starting maintenance job (Interval: ${intervalMs}ms)`);

        // Run immediately on start
        flagService.expireFlags().catch(console.error);

        // Schedule periodic runs
        setInterval(() => {
            flagService.expireFlags().catch(console.error);
        }, intervalMs);
    }
};

module.exports = flagService;
