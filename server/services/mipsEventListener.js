const mipsComputationService = require('./mipsComputationService');
const pool = require('../db');

/**
 * MIPSEventListener
 * Reacts to clinical events by triggering MIPS re-computations.
 */
class MIPSEventListener {
    /**
     * Handles a clinical event and triggers relevant MIPS re-computations.
     * @param {Object} event - The clinical event
     */
    static async handleEvent(event) {
        const { event_type, patient_id, clinic_id } = event;

        // Define event types that affect Quality measures
        const triggerTypes = [
            'VITAL_RECORDED',
            'DX_ADDED', 'DX_RESOLVED', 'DX_UPDATED',
            'ORDER_PLACED', 'ORDER_RESULTED'
        ];

        if (!triggerTypes.includes(event_type)) return;

        const year = new Date().getFullYear();
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;

        try {
            // Find clinicians who have seen this patient this year
            const providersRes = await pool.query(
                `SELECT DISTINCT provider_id 
                 FROM visits 
                 WHERE patient_id = $1 
                   AND visit_date BETWEEN $2 AND $3`,
                [patient_id, start, end]
            );

            if (providersRes.rows.length === 0) return;

            // Fetch active Quality measures for this year
            const measuresRes = await pool.query(
                "SELECT id FROM qpp_measures WHERE category = 'QUALITY' AND performance_year = $1 AND is_active = true",
                [year]
            );

            if (measuresRes.rows.length === 0) return;

            console.log(`[MIPS-REACTIVE] Triggering re-computation for ${providersRes.rows.length} providers across ${measuresRes.rows.length} measures.`);

            // Run computations (non-blocking)
            for (const pRow of providersRes.rows) {
                for (const mRow of measuresRes.rows) {
                    mipsComputationService.computeMeasure(pRow.provider_id, mRow.id, year).catch(err => {
                        console.error(`[MIPS-REACTIVE] Error computing ${mRow.id} for ${pRow.provider_id}:`, err.message);
                    });
                }
            }
        } catch (error) {
            console.error('[MIPS-REACTIVE] Fatal listener error:', error);
        }
    }
}

module.exports = MIPSEventListener;
