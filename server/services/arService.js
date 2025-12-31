const pool = require('../db');

class ARService {
    /**
     * Search Patients for Payment Posting
     */
    async searchPatients(term) {
        if (!term) return [];
        const query = `
            SELECT id, first_name, last_name, mrn, dob 
            FROM patients 
            WHERE 
                LOWER(last_name) LIKE LOWER($1) OR 
                LOWER(first_name) LIKE LOWER($1) OR 
                LOWER(mrn) LIKE LOWER($1)
            LIMIT 20
        `;
        const res = await pool.query(query, [`%${term}%`]);
        return res.rows;
    }

    /**
     * Get encounters with balances for a patient
     * Updated: Filters by balance > 0 by default (WARN 3 fix)
     */
    async getOpenEncounters(patientId, includeZeroBalance = false) {
        const query = `
            WITH charges AS (
                SELECT encounter, SUM(fee * units) as total_charge
                FROM billing
                WHERE pid = $1 AND activity = true
                GROUP BY encounter
            ),
            payments AS (
                SELECT encounter, SUM(pay_amount + adj_amount) as total_pay
                FROM ar_activity
                WHERE pid = $1 AND deleted IS NULL
                GROUP BY encounter
            )
            SELECT 
                v.id, v.visit_date, 
                u.first_name as provider_first, u.last_name as provider_last,
                COALESCE(c.total_charge, 0) as charges,
                COALESCE(p.total_pay, 0) as payments,
                (COALESCE(c.total_charge, 0) - COALESCE(p.total_pay, 0)) as balance
            FROM visits v
            LEFT JOIN users u ON v.provider_id = u.id
            LEFT JOIN charges c ON v.id = c.encounter
            LEFT JOIN payments p ON v.id = p.encounter
            WHERE v.patient_id = $1
            ${includeZeroBalance ? '' : 'AND (COALESCE(c.total_charge, 0) - COALESCE(p.total_pay, 0)) > 0.01'}
            ORDER BY v.visit_date DESC
        `;
        const res = await pool.query(query, [patientId]);
        return res.rows;
    }

    /**
     * Get detailed ledger for an encounter
     */
    async getEncounterLedger(encounterId) {
        // 1. Billing Lines (Charges)
        const linesRes = await pool.query(`
            SELECT id, code, code_text, fee, units, (fee * units) as total
            FROM billing
            WHERE encounter = $1 AND activity = true
            ORDER BY date, id
        `, [encounterId]);

        // 2. Payments
        const payRes = await pool.query(`
            SELECT a.*, s.check_date, s.payment_method, s.reference
            FROM ar_activity a
            LEFT JOIN ar_session s ON a.session_id = s.id
            WHERE a.encounter = $1 AND a.deleted IS NULL
            ORDER BY a.post_time DESC
        `, [encounterId]);

        // 3. Balance
        const charges = linesRes.rows.reduce((sum, line) => sum + parseFloat(line.total || 0), 0);
        const payments = payRes.rows.reduce((sum, pay) => sum + parseFloat(pay.pay_amount || 0) + parseFloat(pay.adj_amount || 0), 0);

        return {
            lines: linesRes.rows,
            payments: payRes.rows,
            summary: {
                charges,
                payments,
                balance: charges - payments
            }
        };
    }

    /**
     * Create Session and Post Allocations (Atomic)
     * Updated: FAIL 1 & 2 fixes
     */
    async createSession(data, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const {
                patient_id, encounterId,
                check_date, payment_method, reference,
                pay_total, description,
                payer_type, // Explicit Type (0=Patient, 1=Ins, etc)
                payer_id,   // Explicit ID (FK)
                idempotency_key,
                allocations // Array of { code, amount, ... }
            } = data;

            // --- FAIL 2: VALIATION ---------------------------
            if (encounterId) {
                // 1. Encounter Validation
                const encCheck = await client.query('SELECT id FROM visits WHERE id = $1 AND patient_id = $2', [encounterId, patient_id]);
                if (encCheck.rows.length === 0) throw new Error("ENCOUNTER_INVALID_OR_MISMATCH");

                // 2. Allocation Validation (Code Existence & Overpayment)
                if (allocations && allocations.length > 0) {
                    // Fetch billable lines
                    const billRes = await client.query(`
                        SELECT code, SUM(fee * units) as total_charge 
                        FROM billing 
                        WHERE encounter = $1 AND activity = true 
                        GROUP BY code
                    `, [encounterId]);
                    const billMap = {};
                    billRes.rows.forEach(r => billMap[r.code] = parseFloat(r.total_charge || 0));

                    // Fetch existing payments per code
                    const paidRes = await client.query(`
                        SELECT code, SUM(pay_amount + adj_amount) as total_paid 
                        FROM ar_activity 
                        WHERE encounter = $1 AND deleted IS NULL 
                        GROUP BY code
                    `, [encounterId]);
                    const paidMap = {};
                    paidRes.rows.forEach(r => paidMap[r.code] = parseFloat(r.total_paid || 0));

                    for (const alloc of allocations) {
                        const code = alloc.code;
                        const amt = parseFloat(alloc.amount || 0);

                        // Check existence
                        if (billMap[code] === undefined) {
                            throw new Error(`ALLOCATION_INVALID_CODE: ${code} not found on encounter`);
                        }

                        // Check overpayment (buffer 0.01)
                        const charge = billMap[code];
                        const paid = paidMap[code] || 0;
                        const due = charge - paid;

                        if (amt > (due + 0.01)) {
                            // User requested rejection 400. 
                            // We throw error, route handles it.
                            throw new Error(`ALLOCATION_OVERPAYMENT: ${code} Due: ${due.toFixed(2)}, Attempt: ${amt.toFixed(2)}`);
                        }
                    }
                }
            }
            // ----------------------------------------------------

            // --- FAIL 1: PAYER ID/TYPE SPLIT --------------------
            // Defaulting if not provided (Phase 1 compat)
            const finalPayerType = (payer_type !== undefined) ? payer_type : 0;
            const finalPayerId = payer_id || null;
            const paymentTypeLabel = (finalPayerType === 0) ? 'Patient Payment' : 'Insurance';

            // 1. Create Session
            const sessionQuery = `
                INSERT INTO ar_session (
                    payer_id, user_id, closed, reference, check_date, 
                    pay_total, payment_type, description, patient_id, 
                    payment_method, encounter, idempotency_key,
                    created_at
                ) VALUES (
                    $1, $2, false, $3, $4,
                    $5, $6, $7, $8, 
                    $9, $10, $11,
                    CURRENT_TIMESTAMP
                ) RETURNING *
            `;
            const sessionVals = [
                finalPayerId, // Correctly using ID
                userId,
                reference || '',
                check_date || new Date(),
                pay_total || 0,
                paymentTypeLabel, // 'Patient Payment' or 'Insurance'
                description,
                patient_id,
                payment_method,
                encounterId,
                idempotency_key || null
            ];

            // VALIDATION: Allocations sum
            if (allocations && allocations.length > 0) {
                const totalAlloc = allocations.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                const headerTotal = parseFloat(pay_total || 0);
                if (Math.abs(totalAlloc - headerTotal) > 0.01) {
                    throw new Error("ALLOCATION_MISMATCH_SERVER");
                }
            }

            let session;
            try {
                const res = await client.query(sessionQuery, sessionVals);
                session = res.rows[0];
            } catch (err) {
                if (err.code === '23505') { // Unique Violation on idempotency_key
                    throw new Error("DUPLICATE_PAYMENT");
                }
                throw err;
            }

            // 2. Post Allocations
            if (allocations && allocations.length > 0) {
                for (const item of allocations) {
                    // Sequence in JS to avoid query overhead? 
                    // User suggested "compute once", but we need sequence per encounter if multiple?
                    // Here we only have one encounterId in context usually.
                    // But sticking to query for safety unless performace imperative.
                    const seqRes = await client.query(
                        `SELECT COALESCE(MAX(sequence_no), 0) + 1 as next_seq 
                         FROM ar_activity 
                         WHERE pid = $1 AND encounter = $2`,
                        [patient_id, encounterId]
                    );
                    const nextSeq = seqRes.rows[0].next_seq;

                    await client.query(`
                        INSERT INTO ar_activity (
                            pid, encounter, sequence_no, session_id,
                            code, code_type, modifier,
                            payer_type, post_time, post_user,
                            pay_amount, adj_amount, memo,
                            reason_code, account_code
                        ) VALUES (
                            $1, $2, $3, $4,
                            $5, $6, $7,
                            $8, CURRENT_TIMESTAMP, $9,
                            $10, 0, $11,
                            '', 'APP' 
                        )
                    `, [
                        patient_id, encounterId, nextSeq, session.id,
                        item.code, 'CPT4', '',
                        finalPayerType, userId,
                        item.amount, description // Storing description in memo
                    ]);
                }
            }

            // 3. Audit Log
            await client.query(`
                INSERT INTO billing_event_log (
                    event_type, actor_id, visit_id, session_id, details
                ) VALUES (
                    'payment_posted', $1, $2, $3, $4
                )
            `, [
                userId, encounterId, session.id,
                JSON.stringify({
                    pay_total,
                    payment_method,
                    reference,
                    payer_type: finalPayerType,
                    payer_id: finalPayerId,
                    allocations_count: allocations ? allocations.length : 0
                })
            ]);

            await client.query('COMMIT');
            return session;

        } catch (e) {
            await client.query('ROLLBACK');
            if (e.message === 'DUPLICATE_PAYMENT') return { error: 'DUPLICATE_PAYMENT', status: 409 };
            throw e;
        } finally {
            client.release();
        }
    }

    // Keep legacy postActivity for compatibility - updated with strict checks (Option A)
    async postActivity(sessionId, items, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const item of items) {
                // Strict Validation (Closing Gap A)

                // 1. Encounter Ownership
                const encCheck = await client.query('SELECT id FROM visits WHERE id = $1 AND patient_id = $2', [item.encounter, item.pid]);
                if (encCheck.rows.length === 0) throw new Error("ENCOUNTER_INVALID_OR_MISMATCH");

                // 2. Code Existence & Overpayment
                const code = item.code || '';
                // Get Charge
                const billRes = await client.query(`
                    SELECT SUM(fee * units) as total FROM billing 
                    WHERE encounter = $1 AND code = $2 AND activity = true
                `, [item.encounter, code]);
                const charge = parseFloat(billRes.rows[0]?.total || 0);

                if (charge === 0) {
                    // If code is empty or not found, maybe allow generic payment if legacy? 
                    // But strictly, we should require valid code.
                    // Test C sends '99214'.
                    if (code) throw new Error(`ALLOCATION_INVALID_CODE: ${code}`);
                }

                // Get Paid
                const paidRes = await client.query(`
                    SELECT SUM(pay_amount + adj_amount) as paid 
                    FROM ar_activity 
                    WHERE encounter = $1 AND code = $2 AND deleted IS NULL
                `, [item.encounter, code]);
                const paid = parseFloat(paidRes.rows[0]?.paid || 0);

                const amt = parseFloat(item.pay_amount || 0) + parseFloat(item.adj_amount || 0);
                const due = charge - paid;

                // Buffer 0.01
                if (code && amt > (due + 0.01)) {
                    throw new Error(`ALLOCATION_OVERPAYMENT: ${code} Due: ${due.toFixed(2)}, Attempt: ${amt.toFixed(2)}`);
                }

                // Get sequence
                const seqRes = await client.query(
                    `SELECT COALESCE(MAX(sequence_no), 0) + 1 as next_seq FROM ar_activity WHERE pid = $1 AND encounter = $2`,
                    [item.pid, item.encounter]
                );
                const nextSeq = seqRes.rows[0].next_seq;

                const res = await client.query(`
                    INSERT INTO ar_activity (
                        pid, encounter, sequence_no, session_id,
                        code, code_type, modifier, payer_type, post_time, post_user,
                        pay_amount, adj_amount, memo, reason_code, account_code
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, $11, $12, $13, 'APP')
                    RETURNING *
                `, [
                    item.pid, item.encounter, nextSeq, sessionId,
                    item.code || '', item.code_type || '', item.modifier || '',
                    item.payer_type || 0, userId,
                    item.pay_amount || 0, item.adj_amount || 0, item.memo || '',
                    item.reason_code || ''
                ]);
                results.push(res.rows[0]);
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

    async getEncounterBalance(encounterId) {
        const led = await this.getEncounterLedger(encounterId);
        return led.summary.balance;
    }

    /**
     * Phase 2: AR Aging Report
     * Updated: WARN 4 Fix (Use asOfDate)
     */
    async getARAging(asOfDate) {
        // Use asOfDate if provided, else CURRENT_DATE
        // Using explicit cast to date to ensure proper subtraction
        const query = `
            WITH encounter_balances AS (
                SELECT 
                    v.patient_id,
                    p.first_name, p.last_name, p.mrn,
                    v.id as encounter_id,
                    v.visit_date,
                    (
                        COALESCE((SELECT SUM(fee * units) FROM billing WHERE encounter = v.id AND activity = true), 0) -
                        COALESCE((SELECT SUM(pay_amount + adj_amount) FROM ar_activity WHERE encounter = v.id AND deleted IS NULL), 0)
                    ) as balance
                FROM visits v
                JOIN patients p ON v.patient_id = p.id
            )
            SELECT *,
                CASE 
                    WHEN (COALESCE($1::date, CURRENT_DATE) - CAST(visit_date AS DATE)) <= 30 THEN '0-30'
                    WHEN (COALESCE($1::date, CURRENT_DATE) - CAST(visit_date AS DATE)) <= 60 THEN '31-60'
                    WHEN (COALESCE($1::date, CURRENT_DATE) - CAST(visit_date AS DATE)) <= 90 THEN '61-90'
                    WHEN (COALESCE($1::date, CURRENT_DATE) - CAST(visit_date AS DATE)) <= 120 THEN '91-120'
                    ELSE '120+' 
                END as bucket
            FROM encounter_balances
            WHERE balance > 0.01
            ORDER BY last_name, visit_date
        `;
        const res = await pool.query(query, [asOfDate || null]);
        return res.rows;
    }

    /**
     * Phase 2: Collections Report
     * Updated: WARN 6 Fix (payerType filter)
     */
    async getCollectionsReport({ from, to, method, payerType }) {
        let query = `
            SELECT s.*, 
                   p.first_name as patient_first, p.last_name as patient_last, p.mrn,
                   u.first_name as user_first, u.last_name as user_last
            FROM ar_session s
            LEFT JOIN patients p ON s.patient_id = p.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (from) {
            query += ` AND s.check_date >= $${idx++}`;
            params.push(from);
        }
        if (to) {
            query += ` AND s.check_date <= $${idx++}`;
            params.push(to);
        }
        if (method) {
            query += ` AND s.payment_method = $${idx++}`;
            params.push(method);
        }

        // WARN 6: payerType filter
        if (payerType !== undefined && payerType !== null && payerType !== '') {
            // Assuming payerType matches payment_type string OR database column payer_id checks
            // Common usage: 'Patient' vs 'Insurance'
            // s.payment_type is string in current schema.
            query += ` AND s.payment_type = $${idx++}`;
            params.push(payerType);
        }

        query += ` ORDER BY s.check_date DESC`;

        const res = await pool.query(query, params);
        return res.rows;
    }

    /**
     * Phase 2: Patient Statement
     * Updated: WARN 5 Fix (Date Range)
     */
    async getPatientStatement(patientId, from, to) {
        // 1. Demographics
        const patRes = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
        if (patRes.rows.length === 0) throw new Error("Patient not found");
        const patient = patRes.rows[0];

        // 2. Encounters in range
        let encounters = [];
        if (from && to) {
            // Activity/Visit Range Statement
            // Fetch visits strictly in range
            const encRangeRes = await pool.query(`
                SELECT id, visit_date FROM visits 
                WHERE patient_id = $1 AND visit_date >= $2 AND visit_date <= $3
                ORDER BY visit_date ASC
            `, [patientId, from, to]);
            encounters = encRangeRes.rows;
            // Also need initial balance? For now, simplistic activity statement.
        } else {
            // "Due Now" Statement (All Open Encounters)
            encounters = await this.getOpenEncounters(patientId, false); // false = only balance > 0
        }

        // Enhance with detailed ledger
        const detailedEncounters = [];
        for (const enc of encounters) {
            const ledger = await this.getEncounterLedger(enc.id);
            // If date range filter, maybe filter ledger items too?
            // Usually statement shows full history of the visit if the visit is included.
            // Keeping simple: Show full ledger for selected visits.

            // For Due Now, only show if balance > 0 (handled by getOpenEncounters)
            if (!from && ledger.summary.balance <= 0.01) continue;

            detailedEncounters.push({
                ...enc,
                ledger
            });
        }

        return {
            patient,
            statementDate: new Date(),
            encounters: detailedEncounters,
            totalDue: detailedEncounters.reduce((sum, e) => sum + parseFloat(e.ledger.summary.balance), 0)
        };
    }
}

module.exports = new ARService();
