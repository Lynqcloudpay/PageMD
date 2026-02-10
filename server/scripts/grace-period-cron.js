const gracePeriodService = require('../services/GracePeriodService');

async function run() {
    try {
        console.log('[Cron] Running Grace Period Escalations...');
        await gracePeriodService.processEscalations();
        console.log('[Cron] Completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('[Cron] Failed:', err);
        process.exit(1);
    }
}

run();
