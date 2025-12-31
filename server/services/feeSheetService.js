const pool = require('../db');
const billingService = require('./billingService');
const auditService = require('./auditService');

/**
 * Port of OpenEMR's FeeSheet logic
 */
class FeeSheetService {
    /**
     * Port of FeeSheet::save
     * @param {Object} params
     * @param {string} params.visitId - UUID of the visit
     * @param {string} params.patientId - UUID of the patient
     * @param {Array} params.bill - Array of service line items
     * @param {Array} params.prod - Array of product line items
     * @param {string} params.providerId - Rendering provider UUID
     * @param {string} params.userId - User performing the save
     * @param {number} params.copay - Copay amount
     * @param {string} params.paymentMethod - Cash, Check, Card
     * @param {string} params.expectedChecksum - Expected state of the fee sheet
     */
    async save({ visitId, patientId, bill = [], prod = [], providerId, userId, copay, paymentMethod, expectedChecksum }) {
        const client = await pool.connect();
        try {
            // 0. Concurrency Check
            if (expectedChecksum) {
                const currentChecksum = await this.getChecksum(visitId);
                if (currentChecksum !== expectedChecksum) {
                    const error = new Error('Fee sheet has been modified by another user. Please refresh and try again.');
                    error.code = 'CONCURRENCY_ERROR';
                    throw error;
                }
            }

            await client.query('BEGIN');

            // 1. Handle Service Items (bill)
            for (const item of bill) {
                if (item.billed) continue; // Skip already billed items

                const id = item.id;
                const isDelete = !!item.del;

                // Prepare common fields
                const codeType = item.code_type;
                const code = item.code;
                const units = parseInt(item.units) || 1;
                const modifier1 = item.modifier1 || '';
                const modifier2 = item.modifier2 || '';
                const modifier3 = item.modifier3 || '';
                const modifier4 = item.modifier4 || '';
                const justify = item.justify || ''; // Diagnosis pointers
                const fee = parseFloat(item.fee) || 0.0;
                const pricelevel = item.pricelevel || 'Standard';
                const ndc_info = item.ndc_info || '';

                if (id) {
                    if (isDelete) {
                        await client.query(
                            'UPDATE billing SET activity = false WHERE id = $1',
                            [id]
                        );
                    } else {
                        await client.query(`
                            UPDATE billing SET
                                code_type = $2,
                                code = $3,
                                units = $4,
                                modifier1 = $5,
                                modifier2 = $6,
                                modifier3 = $7,
                                modifier4 = $8,
                                justify = $9,
                                fee = $10,
                                pricelevel = $11,
                                ndc_info = $12,
                                provider_id = $13,
                                user_id = $14,
                                date = CURRENT_TIMESTAMP
                            WHERE id = $1
                        `, [id, codeType, code, units, modifier1, modifier2, modifier3, modifier4, justify, fee, pricelevel, ndc_info, providerId, userId]);
                    }
                } else if (!isDelete) {
                    // New item
                    await client.query(`
                        INSERT INTO billing (
                            pid, encounter, code_type, code, units, modifier1, modifier2, modifier3, modifier4, justify, fee, pricelevel, ndc_info, provider_id, user_id, activity
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
                    `, [patientId, visitId, codeType, code, units, modifier1, modifier2, modifier3, modifier4, justify, fee, pricelevel, ndc_info, providerId, userId]);
                }
            }

            // 2. Handle Product Items (prod)
            for (const item of prod) {
                const id = item.id;
                const isDelete = !!item.del;

                if (id) {
                    if (isDelete) {
                        await client.query('DELETE FROM drug_sales WHERE id = $1', [id]);
                    } else {
                        await client.query(`
                            UPDATE drug_sales SET
                                quantity = $2,
                                fee = $3,
                                pricelevel = $4,
                                notes = $5,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = $1
                        `, [id, item.units, item.fee, item.pricelevel, item.notes]);
                    }
                } else if (!isDelete) {
                    // Check & Decrement inventory before sale
                    await this.checkInventory(item.drug_id, item.units, client);

                    await client.query(`
                        INSERT INTO drug_sales (
                            pid, encounter, drug_id, quantity, fee, pricelevel, notes, user_id
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [patientId, visitId, item.drug_id, item.units, item.fee, item.pricelevel, item.notes, userId]);
                }
            }

            // 3. Handle Copay
            if (copay && parseFloat(copay) > 0) {
                // Check if copay already exists for this encounter to avoid duplicates
                const existingCopay = await client.query(
                    'SELECT id FROM ar_session WHERE encounter = $1 AND patient_id = $2',
                    [visitId, patientId]
                );

                if (existingCopay.rows.length === 0) {
                    const sessionRes = await client.query(`
                        INSERT INTO ar_session (
                            patient_id, encounter, pay_total, payment_method, description, payment_type, user_id
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
                    `, [patientId, visitId, copay, paymentMethod || 'Cash', `Copay for Visit ${visitId}`, 'Patient Payment', userId]);

                    const sessionId = sessionRes.rows[0].id;

                    await client.query(`
                        INSERT INTO ar_activity (
                            pid, encounter, sequence_no, pay_amount, session_id, post_user, memo, payer_type
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
                    `, [patientId, visitId, 1, copay, sessionId, userId, 'Copay Payment']);
                }
            }

            // 4. Update the visit's rendering provider if changed
            if (providerId) {
                await client.query(
                    'UPDATE visits SET provider_id = $1 WHERE id = $2',
                    [providerId, visitId]
                );
            }

            // 5. Audit Log
            // 5. Audit Log (TODO: Implement proper tenant-level audit service)
            // await auditService.logAudit({
            //     userId,
            //     action: 'SAVE_FEE_SHEET',
            //     resource: 'visit',
            //     resourceId: visitId,
            //     details: { bill_count: bill.length, prod_count: prod.length, copay }
            // });

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error saving fee sheet:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Port of FeeSheet::checkInventory
     */
    async checkInventory(drugId, quantity, client = pool) {
        const qtyToTake = parseInt(quantity) || 0;
        if (qtyToTake <= 0) return;

        // Atomic stock check and decrement across lots in FIFO order
        const res = await client.query(
            'SELECT id, on_hand FROM drug_inventory WHERE drug_id = $1 ORDER BY expiration ASC, id ASC FOR UPDATE',
            [drugId]
        );

        const totalAvailable = res.rows.reduce((sum, r) => sum + (parseInt(r.on_hand) || 0), 0);

        if (totalAvailable < qtyToTake) {
            const error = new Error(`Insufficient stock for drug ${drugId}: ${totalAvailable} available, ${qtyToTake} requested`);
            error.code = 'INSUFFICIENT_STOCK';
            throw error;
        }

        let remaining = qtyToTake;
        for (const row of res.rows) {
            if (remaining <= 0) break;
            const rowStock = parseInt(row.on_hand) || 0;
            if (rowStock <= 0) continue;

            const take = Math.min(rowStock, remaining);
            await client.query(
                'UPDATE drug_inventory SET on_hand = on_hand - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [take, row.id]
            );
            remaining -= take;
        }
    }

    /**
     * Load items for Fee Sheet
     */
    async loadItems(visitId) {
        const billingItems = await billingService.getBillingByEncounter(visitId);

        const drugSales = await pool.query(
            'SELECT * FROM drug_sales WHERE encounter = $1 ORDER BY sale_date ASC',
            [visitId]
        );

        const checksum = await this.getChecksum(visitId);

        return {
            bill: billingItems,
            prod: drugSales.rows,
            checksum
        };
    }

    /**
     * Generates a checksum for the current fee sheet state to prevent concurrent overwrite issues.
     */
    async getChecksum(visitId) {
        const res = await pool.query(
            "SELECT id, date as updated_at FROM billing WHERE encounter = $1 AND activity = true ORDER BY id",
            [visitId]
        );
        const resProd = await pool.query(
            "SELECT id, updated_at FROM drug_sales WHERE encounter = $1 ORDER BY id",
            [visitId]
        );

        // Include AR tables so copay changes are part of concurrency state
        const resSess = await pool.query(
            "SELECT id, pay_total, updated_at FROM ar_session WHERE encounter = $1 ORDER BY id",
            [visitId]
        );
        const resAct = await pool.query(
            "SELECT id, pay_amount, post_time FROM ar_activity WHERE encounter = $1 ORDER BY id",
            [visitId]
        );

        const data =
            res.rows.map(r => `${r.id}:${r.updated_at?.getTime()}`).join('|') + '||' +
            resProd.rows.map(r => `${r.id}:${r.updated_at?.getTime()}`).join('|') + '||' +
            resSess.rows.map(r => `${r.id}:${r.pay_total}:${r.updated_at?.getTime()}`).join('|') + '||' +
            resAct.rows.map(r => `${r.id}:${r.pay_amount}:${r.post_time?.getTime()}`).join('|');

        return Buffer.from(data).toString('base64');
    }
}

module.exports = new FeeSheetService();
