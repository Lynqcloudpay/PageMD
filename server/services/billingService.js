const pool = require('../db');

/**
 * Port of OpenEMR's BillingUtilities/Billing logic
 */
class BillingService {
    /**
     * Port of BillingUtilities::getBillingByEncounter
     * @param {string} encounterId - The visit UUID
     */
    async getBillingByEncounter(encounterId) {
        const query = `
            SELECT * FROM billing 
            WHERE encounter = $1 
            AND activity = true
            ORDER BY date ASC, id ASC
        `;
        const result = await pool.query(query, [encounterId]);
        return result.rows;
    }

    /**
     * Port of BillingUtilities::addBilling
     */
    async addBilling({
        date,
        code_type,
        code,
        pid,
        encounter,
        provider_id,
        user_id,
        authorized = false,
        code_text = '',
        modifier1 = '',
        modifier2 = '',
        modifier3 = '',
        modifier4 = '',
        units = 1,
        fee = 0.0,
        justify = '',
        pricelevel = '',
        ndc_info = ''
    }) {
        const query = `
            INSERT INTO billing (
                date, code_type, code, pid, encounter, provider_id, user_id,
                authorized, code_text, modifier1, modifier2, modifier3, modifier4, 
                units, fee, justify, pricelevel, ndc_info, activity
            ) VALUES (
                COALESCE($1, CURRENT_TIMESTAMP), $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true
            ) RETURNING *
        `;
        const values = [
            date, code_type, code, pid, encounter, provider_id || null, user_id || null,
            authorized, code_text, modifier1, modifier2, modifier3, modifier4,
            units, fee, justify, pricelevel, ndc_info
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Port of BillingUtilities::deleteBilling (Soft Delete)
     */
    async deleteBilling(id) {
        const query = `
            UPDATE billing 
            SET activity = false 
            WHERE id = $1
            RETURNING *
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    /**
     * Get Fee Schedule entry
     */
    async getPrice(codeType, code, priceLevel = '') {
        // Map OpenEMR code types to PageMD code types if necessary
        // In this project, code_type is likely 'CPT', 'HCPCS', 'ICD10'
        const query = `
            SELECT fee_amount 
            FROM fee_schedule 
            WHERE code_type = $1 AND code = $2 AND price_level = $3
            LIMIT 1
        `;
        const result = await pool.query(query, [codeType, code, priceLevel || 'Standard']);

        if (result.rows.length === 0 && priceLevel !== 'Standard') {
            // Fallback to Standard
            const fallback = await pool.query(query, [codeType, code, 'Standard']);
            return fallback.rows[0]?.fee_amount || 0;
        }

        return result.rows[0]?.fee_amount || 0;
    }
    /**
     * Search for billing items (Billing Manager)
     */
    async getBillingReport({ startDate, endDate, billed, patientId, payerId }) {
        let query = `
            SELECT b.*, 
                   p.first_name, p.last_name, p.mrn,
                   v.visit_date
            FROM billing b
            JOIN visits v ON b.encounter = v.id
            JOIN patients p ON b.pid = p.id
            WHERE b.activity = true
        `;

        // Fix for payer join: In tenantSchema 'billing.payer_id' relates to payer.
        // We will assume basic fetch for now.

        const params = [];
        let idx = 1;

        if (startDate) {
            query += ` AND v.visit_date >= $${idx++}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND v.visit_date <= $${idx++}`;
            params.push(endDate);
        }
        if (billed !== undefined && billed !== 'all') {
            query += ` AND b.billed = $${idx++}`;
            params.push(String(billed) === '1' || String(billed) === 'true');
        }
        if (patientId) {
            query += ` AND b.pid = $${idx++}`;
            params.push(patientId);
        }

        query += ` ORDER BY v.visit_date DESC, b.encounter ASC`;

        try {
            const result = await pool.query(query, params);
            return result.rows;
        } catch (e) {
            console.error("Billing Report Error", e);
            throw e;
        }
    }

    /**
     * Generate Claims (X12) for selected encounters
     */
    /**
     * Generate Claims (Batch)
     */
    async generateClaims(encounterIds, x12PartnerId, userId, batchId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const res = await client.query(
                `SELECT DISTINCT encounter, pid FROM billing WHERE encounter = ANY($1) AND activity = true`,
                [encounterIds]
            );

            const results = [];

            for (const row of res.rows) {
                const { encounter, pid } = row;
                const claimKey = batchId ? `${batchId}-${encounter}` : null;
                const x12Content = `ISA*00*...~GS*HC*...~ST*837*... (Stub for Encounter ${encounter})`;
                const fileName = `claim_${encounter}_${Date.now()}.x12`;

                // Create Claim
                const verRes = await client.query(
                    `SELECT COALESCE(MAX(version), 0) + 1 as next_ver FROM claims WHERE encounter_id = $1`,
                    [encounter]
                );
                const nextVer = verRes.rows[0].next_ver;

                try {
                    const claimRes = await client.query(`
                        INSERT INTO claims (
                            patient_id, encounter_id, version, 
                            status, payer_type, bill_process, 
                            bill_time, process_time, process_file, 
                            submitted_claim,
                            created_by, idempotency_key, x12_partner_id
                        ) VALUES (
                            $1, $2, $3,
                            1, 1, 1, 
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, 
                            $6,
                            $7, $8, $4
                        ) RETURNING id
                    `, [
                        pid, encounter, nextVer,
                        x12PartnerId || null,
                        fileName,
                        x12Content,
                        userId,
                        claimKey
                    ]);

                    const claimId = claimRes.rows[0].id;

                    // Audit Log
                    await client.query(`
                        INSERT INTO billing_event_log (
                            event_type, actor_id, visit_id, claim_id, details
                        ) VALUES (
                            'claim_generated', $1, $2, $3, $4
                        )
                    `, [
                        userId, encounter, claimId,
                        JSON.stringify({ batchId, version: nextVer, partner: x12PartnerId })
                    ]);

                } catch (err) {
                    if (err.code === '23505') {
                        results.push({ encounter, status: 'already_generated', file: null });
                        continue;
                    }
                    throw err;
                }

                await client.query(`
                    UPDATE billing 
                    SET billed = true, 
                        bill_date = CURRENT_TIMESTAMP, 
                        x12_partner_id = $2
                    WHERE encounter = $1 AND activity = true
                `, [encounter, x12PartnerId]);

                results.push({ encounter, status: 'generated', file: fileName });
            }

            await client.query('COMMIT');
            return results;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Get Claim Details
     */
    async getClaim(claimId) {
        const query = `
            SELECT c.*, 
                   p.first_name, p.last_name, p.mrn, 
                   v.visit_date
            FROM claims c
            JOIN patients p ON c.patient_id = p.id
            JOIN visits v ON c.encounter_id = v.id
            WHERE c.id = $1
        `;
        const res = await pool.query(query, [claimId]);
        if (res.rows.length === 0) return null;

        const claim = res.rows[0];

        // Fetch billing lines (services)
        // Linked by encounter and version?
        // OpenEMR links by encounter.
        const linesRes = await pool.query(`
            SELECT * FROM billing 
            WHERE encounter = $1 AND activity = true AND billed = true
            ORDER BY date ASC
        `, [claim.encounter_id]);

        claim.lines = linesRes.rows;
        return claim;
    }
}

module.exports = new BillingService();
