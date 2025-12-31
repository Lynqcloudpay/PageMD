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
            date, code_type, code, pid, encounter, provider_id, user_id,
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
}

module.exports = new BillingService();
