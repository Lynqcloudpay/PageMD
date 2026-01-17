const pool = require('../db');
const mipsComputationService = require('./mipsComputationService');

/**
 * MIPS Auto Sync Service
 * Periodically recomputes quality measures to keep data fresh.
 */
const mipsAutoSyncService = {
    isJobRunning: false,

    async start() {
        console.log('[MIPS Auto-Sync] Service started. Setting up 1-hour interval.');
        // Run immediately on start
        this.runSync();

        // Then every hour
        setInterval(() => {
            this.runSync();
        }, 60 * 60 * 1000);
    },

    async runSync() {
        if (this.isJobRunning) return;
        this.isJobRunning = true;

        console.log(`[MIPS Auto-Sync] Starting background computation: ${new Date().toISOString()}`);

        try {
            const year = new Date().getFullYear();

            // Fetch all active quality measures
            const measuresRes = await pool.query(
                "SELECT id FROM qpp_measures WHERE category = 'QUALITY' AND performance_year = $1 AND is_active = true",
                [year]
            );
            const measureIds = measuresRes.rows.map(r => r.id);

            // Fetch all active clinical providers
            const providersRes = await pool.query(
                "SELECT id FROM users WHERE role IN ('clinician', 'doctor', 'provider') AND active = true"
            );
            const providerIds = providersRes.rows.map(r => r.id);

            if (measureIds.length === 0 || providerIds.length === 0) {
                console.log('[MIPS Auto-Sync] No measures or providers to sync.');
                this.isJobRunning = false;
                return;
            }

            let successCount = 0;
            for (const pId of providerIds) {
                for (const mId of measureIds) {
                    try {
                        await mipsComputationService.computeMeasure(pId, mId, year);
                        successCount++;
                    } catch (err) {
                        // Silicon failure on one measure shouldn't stop others
                        // console.error(`[MIPS Auto-Sync] Failed: ${pId}/${mId}`, err.message);
                    }
                }
            }

            console.log(`[MIPS Auto-Sync] Completed. ${successCount} computations performed.`);
        } catch (error) {
            console.error('[MIPS Auto-Sync] Fatal Error in job:', error);
        } finally {
            this.isJobRunning = false;
        }
    }
};

module.exports = mipsAutoSyncService;
