const pool = require('../db');
const eraParser = require('./eraParser');
const arService = require('./arService');

/**
 * ERA Service
 * Handles ERA upload, parsing, matching, and posting
 */
class ERAService {

    /**
     * Upload and parse ERA file
     */
    async uploadERA(filename, content, userId, tenantId = 'default') {
        // Parse 835
        const parsed = eraParser.parse835(content);

        // Store ERA file
        const res = await pool.query(`
            INSERT INTO era_files (
                tenant_id, filename, status, raw_content, parsed_content,
                check_eft_number, check_date, total_paid, uploaded_by
            ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            tenantId,
            filename,
            content,
            JSON.stringify(parsed),
            parsed.checkNumber,
            parsed.checkDate,
            parsed.totalPaid,
            userId
        ]);

        const eraFile = res.rows[0];

        // Attempt auto-match for each claim
        for (const claim of parsed.claims) {
            await this.matchClaim(eraFile.id, claim);
        }

        return eraFile;
    }

    /**
     * Match ERA claim to database claim
     */
    async matchClaim(eraFileId, eraClaim) {
        // Try to find matching claim by patient control number (usually our claim_number)
        let matchedClaimId = null;
        let matchConfidence = 0;
        let patientId = null;

        // Strategy 1: Exact match on claim_number
        const exactRes = await pool.query(`
            SELECT id, patient_id FROM claims 
            WHERE claim_number = $1 OR claim_number ILIKE $2
        `, [eraClaim.patientControlNumber, `%${eraClaim.patientControlNumber}%`]);

        if (exactRes.rows.length > 0) {
            matchedClaimId = exactRes.rows[0].id;
            patientId = exactRes.rows[0].patient_id;
            matchConfidence = 100;
        }

        // Strategy 2: By payer claim control number (if we stored it)
        if (!matchedClaimId && eraClaim.payerClaimControlNumber) {
            const payerRes = await pool.query(`
                SELECT claim_id FROM claim_submission_items 
                WHERE payer_claim_number = $1
            `, [eraClaim.payerClaimControlNumber]);

            if (payerRes.rows.length > 0) {
                matchedClaimId = payerRes.rows[0].claim_id;
                matchConfidence = 95;

                // Get patient
                const claimRes = await pool.query('SELECT patient_id FROM claims WHERE id = $1', [matchedClaimId]);
                if (claimRes.rows.length > 0) {
                    patientId = claimRes.rows[0].patient_id;
                }
            }
        }

        // Strategy 3: By amount + date (lower confidence)
        if (!matchedClaimId && eraClaim.chargedAmount > 0) {
            const amountRes = await pool.query(`
                SELECT id, patient_id FROM claims 
                WHERE (total_charges = $1 OR total_amount = $1)
                AND status IN ('submitted', 'pending')
                LIMIT 1
            `, [eraClaim.chargedAmount]);

            if (amountRes.rows.length > 0) {
                matchedClaimId = amountRes.rows[0].id;
                patientId = amountRes.rows[0].patient_id;
                matchConfidence = 60;
            }
        }

        // Insert ERA claim record
        const eraClaimRes = await pool.query(`
            INSERT INTO era_claims (
                era_file_id, claim_id, patient_id, payer_claim_number,
                billed_amount, paid_amount, patient_responsibility,
                status, match_confidence
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            eraFileId,
            matchedClaimId,
            patientId,
            eraClaim.payerClaimControlNumber,
            eraClaim.chargedAmount,
            eraClaim.paidAmount,
            eraClaim.patientResponsibility,
            matchedClaimId ? 'matched' : 'unmatched',
            matchConfidence
        ]);

        const eraClaimRecord = eraClaimRes.rows[0];

        // Insert line items
        for (const line of eraClaim.lines) {
            await pool.query(`
                INSERT INTO era_lines (
                    era_claim_id, procedure_code, billed_amount, paid_amount,
                    adj_group_code, adj_reason_code, adj_amount, units
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                eraClaimRecord.id,
                line.procedureCode,
                line.billedAmount,
                line.paidAmount,
                line.adjustments?.[0]?.groupCode || null,
                line.adjustments?.[0]?.reasonCode || null,
                line.adjustments?.[0]?.amount || 0,
                line.units
            ]);
        }

        return eraClaimRecord;
    }

    /**
     * Get ERA files
     */
    async getERAFiles(tenantId = 'default', status = null) {
        let query = `
            SELECT e.*, 
                   u.first_name || ' ' || u.last_name as uploaded_by_name,
                   (SELECT COUNT(*) FROM era_claims WHERE era_file_id = e.id) as claim_count,
                   (SELECT COUNT(*) FROM era_claims WHERE era_file_id = e.id AND status = 'matched') as matched_count
            FROM era_files e
            LEFT JOIN users u ON e.uploaded_by = u.id
            WHERE e.tenant_id = $1
        `;
        const params = [tenantId];

        if (status) {
            query += ' AND e.status = $2';
            params.push(status);
        }

        query += ' ORDER BY e.received_at DESC';

        const res = await pool.query(query, params);
        return res.rows;
    }

    /**
     * Get ERA file details with claims
     */
    async getERADetails(eraFileId) {
        const fileRes = await pool.query('SELECT * FROM era_files WHERE id = $1', [eraFileId]);
        if (fileRes.rows.length === 0) return null;

        const eraFile = fileRes.rows[0];

        // Get claims
        const claimsRes = await pool.query(`
            SELECT ec.*, 
                   c.claim_number,
                   p.first_name, p.last_name, p.mrn
            FROM era_claims ec
            LEFT JOIN claims c ON ec.claim_id = c.id
            LEFT JOIN patients p ON ec.patient_id = p.id
            WHERE ec.era_file_id = $1
        `, [eraFileId]);

        eraFile.claims = [];

        for (const claim of claimsRes.rows) {
            // Get lines
            const linesRes = await pool.query(
                'SELECT * FROM era_lines WHERE era_claim_id = $1',
                [claim.id]
            );
            claim.lines = linesRes.rows;
            eraFile.claims.push(claim);
        }

        return eraFile;
    }

    /**
     * Manually match ERA claim to database claim
     */
    async manualMatch(eraClaimId, claimId) {
        const claimRes = await pool.query('SELECT patient_id FROM claims WHERE id = $1', [claimId]);
        if (claimRes.rows.length === 0) {
            throw new Error('Claim not found');
        }

        await pool.query(`
            UPDATE era_claims 
            SET claim_id = $1, patient_id = $2, status = 'matched', 
                match_confidence = 100, manual_match = true
            WHERE id = $3
        `, [claimId, claimRes.rows[0].patient_id, eraClaimId]);

        return { success: true };
    }

    /**
     * Post ERA payments and adjustments
     */
    async postERA(eraFileId, userId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const eraDetails = await this.getERADetails(eraFileId);
            if (!eraDetails) {
                throw new Error('ERA file not found');
            }

            if (eraDetails.status === 'posted') {
                throw new Error('ERA already posted');
            }

            // Process each matched claim
            for (const eraClaim of eraDetails.claims) {
                if (eraClaim.status !== 'matched' || !eraClaim.claim_id) {
                    continue; // Skip unmatched
                }

                // Get encounter ID from claim
                const claimRes = await client.query(
                    'SELECT visit_id FROM claims WHERE id = $1',
                    [eraClaim.claim_id]
                );

                if (claimRes.rows.length === 0) continue;

                const visitId = claimRes.rows[0].visit_id;

                // Create AR Session for this ERA posting
                const sessionRes = await client.query(`
                    INSERT INTO ar_session (
                        user_id, patient_id, payer_id, payer_type,
                        check_date, reference, deposit_date, pay_total,
                        payment_type, payment_method
                    ) VALUES ($1, $2, NULL, 'insurance', $3, $4, $3, $5, 'insurance', 'era')
                    RETURNING *
                `, [
                    userId,
                    eraClaim.patient_id,
                    eraDetails.check_date || new Date(),
                    eraDetails.check_eft_number || `ERA-${eraFileId.substring(0, 8)}`,
                    eraClaim.paid_amount
                ]);

                const session = sessionRes.rows[0];

                // Post payment for each line
                for (const line of eraClaim.lines) {
                    // Find matching billing line
                    const billingRes = await client.query(`
                        SELECT id FROM billing 
                        WHERE encounter = $1 AND code = $2 AND activity = true
                        LIMIT 1
                    `, [visitId, line.procedure_code]);

                    const billingId = billingRes.rows.length > 0 ? billingRes.rows[0].id : null;

                    // Post payment
                    if (line.paid_amount > 0) {
                        await client.query(`
                            INSERT INTO ar_activity (
                                session_id, encounter_id, code, pay_amount,
                                reason_code, adj_amount, memo, payer_type
                            ) VALUES ($1, $2, $3, $4, NULL, 0, 'ERA Payment', 'insurance')
                        `, [session.id, visitId, line.procedure_code, line.paid_amount]);
                    }

                    // Post adjustments
                    if (line.adj_amount > 0) {
                        const adjReason = eraParser.getAdjustmentReason(line.adj_group_code, line.adj_reason_code);

                        await client.query(`
                            INSERT INTO ar_activity (
                                session_id, encounter_id, code, pay_amount,
                                reason_code, adj_amount, memo, payer_type
                            ) VALUES ($1, $2, $3, 0, $4, $5, $6, 'insurance')
                        `, [
                            session.id,
                            visitId,
                            line.procedure_code,
                            line.adj_reason_code,
                            line.adj_amount,
                            `${adjReason.group}: ${adjReason.reason}`
                        ]);
                    }
                }

                // Update claim status
                await client.query(`
                    UPDATE claims 
                    SET status = CASE 
                        WHEN $1 >= total_charges THEN 'paid'
                        WHEN $1 > 0 THEN 'partial_paid'
                        ELSE 'denied'
                    END,
                    paid_at = NOW()
                    WHERE id = $2
                `, [eraClaim.paid_amount, eraClaim.claim_id]);

                // Update ERA claim status
                await client.query(`
                    UPDATE era_claims SET status = 'posted' WHERE id = $1
                `, [eraClaim.id]);
            }

            // Mark ERA file as posted
            await client.query(`
                UPDATE era_files 
                SET status = 'posted', posted_at = NOW(), posted_by = $1
                WHERE id = $2
            `, [userId, eraFileId]);

            await client.query('COMMIT');

            return { success: true, posted: eraDetails.claims.filter(c => c.status === 'matched').length };

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Void/Reverse ERA posting
     */
    async voidERA(eraFileId, userId, reason) {
        // This would reverse all postings from this ERA
        // For now, mark as voided and add audit
        await pool.query(`
            UPDATE era_files 
            SET status = 'voided'
            WHERE id = $1
        `, [eraFileId]);

        // Log audit
        await pool.query(`
            INSERT INTO billing_event_log (event_type, actor_id, details)
            VALUES ('era_voided', $1, $2)
        `, [userId, JSON.stringify({ eraFileId, reason })]);

        return { success: true };
    }
}

module.exports = new ERAService();
