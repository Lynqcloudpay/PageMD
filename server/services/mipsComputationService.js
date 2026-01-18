const pool = require('../db');

/**
 * MIPS Computation Service
 * Pragmatically computes denominator and numerator counts for Quality measures.
 * Based on CMS/QPP specifications.
 */
const mipsComputationService = {
    /**
     * Compute a measure for a provider
     */
    async computeMeasure(providerId, measureId, year) {
        console.log(`Computing measure ${measureId} for provider ${providerId} in ${year}`);

        // Fetch measure details
        const measureRes = await pool.query('SELECT * FROM qpp_measures WHERE id = $1', [measureId]);
        if (measureRes.rows.length === 0) throw new Error('Measure not found');
        const measure = measureRes.rows[0];

        if (measure.category !== 'QUALITY') {
            console.log(`Measure ${measure.qpp_id} is not a Quality measure, skipping computation.`);
            return;
        }

        // Standard Performance Period: Jan 1 to Dec 31
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        let denominator = 0;
        let numerator = 0;
        let patientsInDenominator = [];
        let patientsInNumerator = [];

        // Pragmatic Logic for common measures
        switch (measure.qpp_id) {
            case '236': // Controlling High Blood Pressure
                ({ denominator, numerator, patientsInDenominator, patientsInNumerator } = await this.computeHypertension(providerId, startDate, endDate));
                break;
            case '001': // Diabetes: Hemoglobin A1c (HbA1c) Poor Control (>9%)
                ({ denominator, numerator, patientsInDenominator, patientsInNumerator } = await this.computeDiabetesA1c(providerId, startDate, endDate));
                break;
            default:
                console.log(`Computation logic not implemented for ${measure.qpp_id}`);
                return;
        }

        // Upsert results into provider_measure_scores
        await pool.query(
            `INSERT INTO provider_measure_scores (
                provider_id, measure_id, performance_year, 
                denominator_count, numerator_count, computed_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (provider_id, measure_id, performance_year) DO UPDATE SET
                denominator_count = EXCLUDED.denominator_count,
                numerator_count = EXCLUDED.numerator_count,
                computed_at = CURRENT_TIMESTAMP`,
            [providerId, measureId, year, denominator, numerator]
        );

        // Update patient_measure_states for gaps
        // This is a simplified version - in reality we would loop through all patients
        for (const pId of patientsInDenominator) {
            const inNumerator = patientsInNumerator.includes(pId);
            await pool.query(
                `INSERT INTO patient_measure_states (
                    patient_id, measure_id, performance_year, 
                    denominator_status, numerator_status, last_computed_at
                ) VALUES ($1, $2, $3, true, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (patient_id, measure_id, performance_year) DO UPDATE SET
                    denominator_status = EXCLUDED.denominator_status,
                    numerator_status = EXCLUDED.numerator_status,
                    last_computed_at = CURRENT_TIMESTAMP`,
                [pId, measureId, year, inNumerator]
            );
        }

        return { denominator, numerator };
    },

    /**
     * CMS 165 (QPP 236): Controlling High Blood Pressure
     * Denominator: Patients 18-85 with Hypertension diagnosis.
     * Numerator: Most recent BP < 140/90.
     */
    /**
     * CMS 165 (QPP 236): Controlling High Blood Pressure
     * Denominator: Patients 18-85 with Hypertension diagnosis.
     * Numerator: Most recent BP < 140/90.
     */
    async computeHypertension(providerId, start, end) {
        // Find patients seen by this provider in the period with HTN diagnosis
        const denQuery = `
            SELECT DISTINCT p.id 
            FROM patients p
            JOIN visits v ON v.patient_id = p.id
            JOIN problems prob ON prob.patient_id = p.id
            WHERE v.provider_id = $1 
              AND v.visit_date BETWEEN $2 AND $3
              AND (prob.icd10_code LIKE 'I10%' OR prob.icd10_code LIKE 'I11%' OR prob.icd10_code LIKE 'I12%' OR prob.icd10_code LIKE 'I13%' OR prob.icd10_code LIKE 'I15%')
              AND prob.status = 'active'
              AND p.dob <= ($2::date - interval '18 years')
              AND p.dob >= ($2::date - interval '85 years')
        `;
        const denRes = await pool.query(denQuery, [providerId, start, end]);
        const denIds = denRes.rows.map(r => r.id);

        let numCount = 0;
        let numIds = [];

        // For each patient in denominator, find most recent BP in performance period
        for (const pId of denIds) {
            const bpQuery = `
                SELECT (vitals->>'bp_systolic')::numeric as systolic, (vitals->>'bp_diastolic')::numeric as diastolic 
                FROM visits v
                WHERE v.patient_id = $1 
                  AND v.visit_date BETWEEN $2 AND $3
                  AND vitals IS NOT NULL
                  AND vitals->>'bp_systolic' IS NOT NULL 
                  AND vitals->>'bp_diastolic' IS NOT NULL
                ORDER BY v.visit_date DESC, v.created_at DESC
                LIMIT 1
            `;
            const bpRes = await pool.query(bpQuery, [pId, start, end]);
            if (bpRes.rows.length > 0) {
                const { systolic, diastolic } = bpRes.rows[0];
                if (systolic < 140 && diastolic < 90) {
                    numCount++;
                    numIds.push(pId);
                }
            }
        }

        return { denominator: denIds.length, numerator: numCount, patientsInDenominator: denIds, patientsInNumerator: numIds };
    },

    /**
     * CMS 122 (QPP 001): Diabetes A1c Poor Control (>9%)
     * Note: This is an INVERSE measure. Numerator is "Poor Control".
     * Denominator: Patients 18-75 with Diabetes diagnosis.
     * Numerator: Most recent HbA1c > 9% or no A1c in period.
     */
    async computeDiabetesA1c(providerId, start, end) {
        const denQuery = `
            SELECT DISTINCT p.id 
            FROM patients p
            JOIN visits v ON v.patient_id = p.id
            JOIN problems prob ON prob.patient_id = p.id
            WHERE v.provider_id = $1 
              AND v.visit_date BETWEEN $2 AND $3
              AND (prob.icd10_code LIKE 'E10%' OR prob.icd10_code LIKE 'E11%')
              AND prob.status = 'active'
              AND p.dob <= ($2::date - interval '18 years')
              AND p.dob >= ($2::date - interval '75 years')
        `;
        const denRes = await pool.query(denQuery, [providerId, start, end]);
        const denIds = denRes.rows.map(r => r.id);

        let numCount = 0;
        let numIds = [];

        // For each patient, find most recent A1c lab result
        for (const pId of denIds) {
            const labQuery = `
                SELECT order_payload
                FROM orders o
                WHERE o.patient_id = $1
                  AND o.order_type = 'lab'
                  AND (o.order_payload->>'test_name' ILIKE '%A1c%' OR o.order_payload->>'name' ILIKE '%A1c%')
                  AND o.updated_at BETWEEN $2 AND $3
                  AND o.status = 'completed'
                ORDER BY o.updated_at DESC
                LIMIT 1
            `;
            const labRes = await pool.query(labQuery, [pId, start, end]);

            if (labRes.rows.length === 0) {
                // No test done = Poor Control (Numerator for inverse measure)
                numCount++;
                numIds.push(pId);
            } else {
                const payload = labRes.rows[0].order_payload;
                const results = payload.results;
                let testValue = null;

                if (Array.isArray(results)) {
                    const testResult = results.find(r => (r.test || r.name || '').toLowerCase().includes('a1c'));
                    if (testResult) testValue = parseFloat(testResult.value || testResult.result);
                }

                if (testValue === null || isNaN(testValue) || testValue > 9.0) {
                    numCount++;
                    numIds.push(pId);
                }
            }
        }

        return { denominator: denIds.length, numerator: numCount, patientsInDenominator: denIds, patientsInNumerator: numIds };
    }
};

module.exports = mipsComputationService;
