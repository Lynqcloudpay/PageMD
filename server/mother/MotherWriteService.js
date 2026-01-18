const TenantDb = require('./TenantDb');
const PatientEventStore = require('./PatientEventStore');
const ProjectionEngine = require('./ProjectionEngine');
const pool = require('../db');
const MIPSEventListener = require('../services/mipsEventListener');
const patientEncryptionService = require('../services/patientEncryptionService');

/**
 * MotherWriteService
 * Single canonical service for all patient-related writes.
 */
class MotherWriteService {
    /**
     * Executes a write operation within a transaction across Event Store and Projections.
     * @param {string} clinicId - UUID of the clinic
     * @param {object} eventData - The event to record
     * @param {function} fn - Optional callback for legacy database operations
     * @param {object} providedClient - Optional existing DB client to use (for nested transactions)
     */
    static async performWrite(clinicId, eventData, fn, providedClient = null) {
        const execute = async (client) => {
            const isInternalTransaction = !providedClient;
            if (isInternalTransaction) await client.query('BEGIN');

            try {
                // Perform the legacy write logic if provided (e.g. updating old tables)
                let legacyResult = null;
                if (fn) {
                    legacyResult = await fn(client);
                }

                // If patientId wasn't provided, try to extract it from the legacy result (for new patients)
                const actualPatientId = eventData.patientId || (legacyResult?.id);

                // Append Event
                const event = await PatientEventStore.appendEvent(client, {
                    ...eventData,
                    patientId: actualPatientId,
                    clinicId
                });

                // Apply Projections
                await ProjectionEngine.apply(client, event);

                // Reactive MIPS Computation (non-blocking)
                MIPSEventListener.handleEvent(event).catch(logErr => {
                    console.error('[Mother] MIPS Listener error:', logErr.message);
                });

                // Audit Log (simplified for now)
                await client.query(
                    `INSERT INTO mother_audit_log (clinic_id, patient_id, encounter_id, actor_user_id, action, event_ids)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [clinicId, actualPatientId, eventData.encounterId, eventData.actorUserId, 'WRITE', [event.id]]
                );

                if (isInternalTransaction) await client.query('COMMIT');
                return { event, legacyResult };
            } catch (err) {
                if (isInternalTransaction) await client.query('ROLLBACK');
                throw err;
            }
        };

        if (providedClient) {
            return await execute(providedClient);
        } else {
            return await TenantDb.withTenantDb(clinicId, execute);
        }
    }

    // High-level patient demographics methods
    static async createPatient(clinicId, patientData, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId: null,
            eventType: 'PATIENT_CREATED',
            payload: patientData,
            sourceModule: 'DEMOGRAPHICS',
            actorUserId
        }, async (client) => {
            const encrypted = await patientEncryptionService.preparePatientForStorage(patientData);
            const fields = Object.keys(encrypted).filter(k => k !== 'encryption_metadata');
            const values = fields.map(f => encrypted[f]);
            fields.push('encryption_metadata');
            values.push(JSON.stringify(encrypted.encryption_metadata));

            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            const res = await client.query(
                `INSERT INTO patients (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
                values
            );
            return res.rows[0];
        }, providedClient);
    }

    static async updatePatient(clinicId, patientId, updatePayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'PATIENT_UPDATED',
            payload: updatePayload,
            sourceModule: 'DEMOGRAPHICS',
            actorUserId
        }, async (client) => {
            const encrypted = await patientEncryptionService.preparePatientForStorage(updatePayload);
            const fields = Object.keys(encrypted).filter(k => k !== 'encryption_metadata');
            const values = fields.map(f => encrypted[f]);

            const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
            const metaIndex = fields.length + 1;
            const idIndex = fields.length + 2;
            const clinicIndex = fields.length + 3;

            values.push(JSON.stringify(encrypted.encryption_metadata));
            values.push(patientId);
            values.push(clinicId);

            const res = await client.query(
                `UPDATE patients SET ${setClause}, encryption_metadata = $${metaIndex}, updated_at = now() 
                 WHERE id = $${idIndex} AND clinic_id = $${clinicIndex} RETURNING *`,
                values
            );
            return res.rows[0];
        }, providedClient);
    }

    // High-level clinical methods
    static async recordVital(clinicId, patientId, encounterId, vitalsPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            encounterId,
            eventType: 'VITAL_RECORDED',
            payload: vitalsPayload,
            sourceModule: 'VITALS',
            actorUserId
        }, async (client) => {
            const { height, weight, bmi, bp_systolic, bp_diastolic, heart_rate, respiratory_rate, temperature, oxygen_saturation } = vitalsPayload;
            const res = await client.query(
                `INSERT INTO vitals (patient_id, encounter_id, height, weight, bmi, bp_systolic, bp_diastolic, heart_rate, respiratory_rate, temperature, oxygen_saturation)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                [patientId, encounterId, height, weight, bmi, bp_systolic, bp_diastolic, heart_rate, respiratory_rate, temperature, oxygen_saturation]
            );
            return res.rows[0];
        }, providedClient);
    }

    static async addMedication(clinicId, patientId, encounterId, medPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            encounterId,
            eventType: 'MED_ADDED',
            payload: medPayload,
            sourceModule: 'MEDICATIONS',
            actorUserId
        }, async (client) => {
            const { medication_name, dosage, frequency, status } = medPayload;
            const res = await client.query(
                `INSERT INTO medications (patient_id, medication_name, dosage, frequency, active)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [patientId, medication_name, dosage, frequency, status !== 'stopped']
            );
            return res.rows[0];
        }, providedClient);
    }

    static async updateMedication(clinicId, patientId, medicationId, medPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: medPayload.status === 'stopped' ? 'MED_STOPPED' : 'MED_CHANGED',
            payload: { medication_id: medicationId, ...medPayload },
            sourceModule: 'MEDICATIONS',
            actorUserId
        }, async (client) => {
            const updates = [];
            const values = [];
            let i = 1;
            const allowed = ['medication_name', 'dosage', 'frequency', 'route', 'status', 'active', 'start_date', 'end_date'];
            for (const [key, val] of Object.entries(medPayload)) {
                if (allowed.includes(key)) {
                    updates.push(`${key} = $${i++}`);
                    values.push(key === 'active' ? !!val : val);
                }
            }
            if (updates.length > 0) {
                values.push(medicationId);
                await client.query(`UPDATE medications SET ${updates.join(', ')}, updated_at = now() WHERE id = $${i}`, values);
            }
        }, providedClient);
    }

    static async deleteMedication(clinicId, patientId, medicationId, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'MED_REMOVED',
            payload: { medication_id: medicationId },
            sourceModule: 'MEDICATIONS',
            actorUserId
        }, async (client) => {
            await client.query('DELETE FROM medications WHERE id = $1', [medicationId]);
        }, providedClient);
    }

    static async addDiagnosis(clinicId, patientId, encounterId, dxPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            encounterId,
            eventType: 'DX_ADDED',
            payload: dxPayload,
            sourceModule: 'PHM',
            actorUserId
        }, async (client) => {
            const { problem_name, status = 'active', icd10_code = null } = dxPayload;
            const res = await client.query(
                `INSERT INTO problems (patient_id, problem_name, status, icd10_code)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [patientId, problem_name, status, icd10_code]
            );
            return res.rows[0];
        }, providedClient);
    }

    static async updateDiagnosis(clinicId, patientId, problemId, dxPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'DX_CHANGED',
            payload: { problem_id: problemId, ...dxPayload },
            sourceModule: 'PHM',
            actorUserId
        }, async (client) => {
            const updates = [];
            const values = [];
            let i = 1;
            const allowed = ['problem_name', 'status', 'icd10_code', 'on_set_date'];
            for (const [key, val] of Object.entries(dxPayload)) {
                const dbKey = key === 'problemName' ? 'problem_name' : (key === 'icd10Code' ? 'icd10_code' : (key === 'onsetDate' ? 'on_set_date' : key));
                if (allowed.includes(dbKey)) {
                    updates.push(`${dbKey} = $${i++}`);
                    values.push(val);
                }
            }
            if (updates.length > 0) {
                values.push(problemId);
                await client.query(`UPDATE problems SET ${updates.join(', ')}, updated_at = now() WHERE id = $${i}`, values);
            }
        }, providedClient);
    }

    static async deleteDiagnosis(clinicId, patientId, problemId, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'DX_REMOVED',
            payload: { problem_id: problemId },
            sourceModule: 'PHM',
            actorUserId
        }, async (client) => {
            await client.query('DELETE FROM problems WHERE id = $1', [problemId]);
        }, providedClient);
    }

    static async addAllergy(clinicId, patientId, allergyPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'ALLERGY_ADDED',
            payload: allergyPayload,
            sourceModule: 'ALLERGIES',
            actorUserId
        }, async (client) => {
            const { allergen, reaction, severity, status = 'active' } = allergyPayload;
            const res = await client.query(
                `INSERT INTO allergies (patient_id, allergen, reaction, severity, status)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [patientId, allergen, reaction, severity, status]
            );
            return res.rows[0];
        }, providedClient);
    }

    static async updateAllergy(clinicId, patientId, allergyId, allergyPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'ALLERGY_CHANGED',
            payload: { allergy_id: allergyId, ...allergyPayload },
            sourceModule: 'ALLERGIES',
            actorUserId
        }, async (client) => {
            const updates = [];
            const values = [];
            let i = 1;
            const allowed = ['allergen', 'reaction', 'severity', 'status', 'active', 'onset_date'];
            for (const [key, val] of Object.entries(allergyPayload)) {
                if (allowed.includes(key)) {
                    updates.push(`${key} = $${i++}`);
                    values.push(key === 'active' ? !!val : val);
                }
            }
            if (updates.length > 0) {
                values.push(allergyId);
                await client.query(`UPDATE allergies SET ${updates.join(', ')}, updated_at = now() WHERE id = $${i}`, values);
            }
        }, providedClient);
    }

    static async removeAllergy(clinicId, patientId, allergyId, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'ALLERGY_REMOVED',
            payload: { allergy_id: allergyId, status: 'removed' },
            sourceModule: 'ALLERGIES',
            actorUserId
        }, async (client) => {
            await client.query('DELETE FROM allergies WHERE id = $1', [allergyId]);
        }, providedClient);
    }

    static async addFamilyHistory(clinicId, patientId, fhData, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'FAMILY_HISTORY_ADDED',
            payload: fhData,
            sourceModule: 'INTAKE',
            actorUserId
        }, async (client) => {
            const { condition, relationship = 'Family', age_at_diagnosis, notes } = fhData;
            const res = await client.query(
                `INSERT INTO family_history (patient_id, condition, relationship, age_at_diagnosis, notes)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [patientId, condition, relationship, age_at_diagnosis, notes]
            );
            return res.rows[0];
        }, providedClient);
    }

    static async addSocialHistory(clinicId, patientId, shData, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'SOCIAL_HISTORY_ADDED',
            payload: shData,
            sourceModule: 'INTAKE',
            actorUserId
        }, async (client) => {
            const { smoking_status, alcohol_use, occupation, drug_use } = shData;
            const res = await client.query(
                `INSERT INTO social_history (patient_id, smoking_status, alcohol_use, occupation, drug_use)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [patientId, smoking_status, alcohol_use, occupation, drug_use]
            );
            return res.rows[0];
        }, providedClient);
    }

    static async updateSocialHistory(clinicId, patientId, shData, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'SOCIAL_HISTORY_UPDATED',
            payload: shData,
            sourceModule: 'INTAKE',
            actorUserId
        }, async (client) => {
            const { smoking_status, alcohol_use, occupation, drug_use } = shData;
            const res = await client.query(
                `UPDATE social_history SET
                    smoking_status = COALESCE($2, smoking_status),
                    alcohol_use = COALESCE($3, alcohol_use),
                    occupation = COALESCE($4, occupation),
                    drug_use = COALESCE($5, drug_use),
                    updated_at = now()
                WHERE patient_id = $1 RETURNING *`,
                [patientId, smoking_status, alcohol_use, occupation, drug_use]
            );
            return res.rows[0];
        }, providedClient);
    }

    static async placeOrder(clinicId, patientId, encounterId, orderPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            encounterId,
            eventType: 'ORDER_PLACED',
            payload: orderPayload,
            sourceModule: 'ORDERS',
            actorUserId
        }, async (client) => {
            // Shadow write to legacy orders table
            const res = await client.query(
                `INSERT INTO orders (patient_id, visit_id, order_type, ordered_by, order_payload)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [patientId, encounterId, orderPayload.ordered_by || actorUserId, orderPayload.order_type, orderPayload.order_payload || orderPayload]
            );
            return res.rows[0];
        }, providedClient);
    }

    static async updateOrder(clinicId, patientId, orderId, updates, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'ORDER_UPDATED',
            payload: { order_id: orderId, ...updates },
            sourceModule: 'ORDERS',
            actorUserId
        }, async (client) => {
            const setClause = [];
            const values = [];
            let i = 1;
            for (const [key, val] of Object.entries(updates)) {
                setClause.push(`${key} = $${i++}`);
                values.push(val);
            }
            if (setClause.length > 0) {
                values.push(orderId);
                await client.query(`UPDATE orders SET ${setClause.join(', ')}, updated_at = now() WHERE id = $${i}`, values);
            }
        }, providedClient);
    }

    static async deleteOrder(clinicId, patientId, orderId, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'ORDER_DELETED',
            payload: { order_id: orderId },
            sourceModule: 'ORDERS',
            actorUserId
        }, async (client) => {
            await client.query('DELETE FROM orders WHERE id = $1', [orderId]);
        }, providedClient);
    }
    static async signVisit(clinicId, patientId, visitId, summaryData, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            encounterId: visitId,
            eventType: 'VISIT_SIGNED',
            payload: {
                visit_id: visitId,
                ...summaryData
            },
            sourceModule: 'VISITS',
            actorUserId
        }, async (client) => {
            // Legacy update already handled in routes usually, but we could move it here.
            // For now, this is primarily for event emission.
            return { visit_id: visitId };
        }, providedClient);
    }
    static async scheduleAppointment(clinicId, patientId, apptPayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'APPOINTMENT_SCHEDULED',
            payload: apptPayload,
            sourceModule: 'SCHEDULING',
            actorUserId
        }, async (client) => {
            const { providerId, date, time, duration, type, notes } = apptPayload;
            const res = await client.query(
                `INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, appointment_type, notes, created_by, clinic_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [patientId, providerId, date, time, duration, type, notes, actorUserId, clinicId]
            );
            return res.rows[0];
        }, providedClient);
    }
    static async sendMessage(clinicId, patientId, messagePayload, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'MESSAGE_SENT',
            payload: messagePayload,
            sourceModule: 'MESSAGING',
            actorUserId
        }, async (client) => {
            const { toUserId, subject, body, messageType, priority } = messagePayload;
            const res = await client.query(
                `INSERT INTO messages (patient_id, from_user_id, to_user_id, subject, body, message_type, priority)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [patientId || null, actorUserId, toUserId || null, subject, body, messageType || 'message', priority || 'normal']
            );
            return res.rows[0];
        }, providedClient);
    }

    // ========== APPOINTMENT LIFECYCLE ==========

    static async updateAppointment(clinicId, patientId, appointmentId, updates, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'APPOINTMENT_UPDATED',
            payload: { appointment_id: appointmentId, updates },
            sourceModule: 'SCHEDULING',
            actorUserId
        }, async (client) => {
            const setClauses = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['status', 'appointment_date', 'appointment_time', 'duration', 'visit_type', 'reason', 'notes'];
            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClauses.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClauses.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(appointmentId);

            const res = await client.query(
                `UPDATE appointments SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
                values
            );
            return res.rows[0];
        }, providedClient);
    }

    static async cancelAppointment(clinicId, patientId, appointmentId, reason, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'APPOINTMENT_CANCELLED',
            payload: { appointment_id: appointmentId, reason },
            sourceModule: 'SCHEDULING',
            actorUserId
        }, async (client) => {
            const res = await client.query(
                `UPDATE appointments SET status = 'cancelled', cancel_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
                [reason, appointmentId]
            );
            return res.rows[0];
        }, providedClient);
    }

    // ========== REFERRALS ==========

    static async createReferral(clinicId, patientId, referralData, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'REFERRAL_CREATED',
            payload: referralData,
            sourceModule: 'REFERRALS',
            actorUserId
        }, async (client) => {
            const { visitId, recipientName, recipientSpecialty, recipientAddress, reason, referralLetter } = referralData;
            const res = await client.query(
                `INSERT INTO referrals (patient_id, visit_id, created_by, recipient_name, recipient_specialty, recipient_address, reason, referral_letter)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [patientId, visitId || null, actorUserId, recipientName || null, recipientSpecialty || null, recipientAddress || null, reason || 'Referral requested', referralLetter || null]
            );
            return res.rows[0];
        }, providedClient);
    }

    static async updateReferral(clinicId, patientId, referralId, status, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'REFERRAL_UPDATED',
            payload: { referral_id: referralId, status },
            sourceModule: 'REFERRALS',
            actorUserId
        }, async (client) => {
            const res = await client.query(
                `UPDATE referrals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
                [status, referralId]
            );
            return res.rows[0];
        }, providedClient);
    }

    // ========== MESSAGE UPDATES ==========

    static async updateMessage(clinicId, patientId, messageId, updates, actorUserId, providedClient = null) {
        return this.performWrite(clinicId, {
            patientId,
            eventType: 'MESSAGE_UPDATED',
            payload: { message_id: messageId, updates },
            sourceModule: 'MESSAGING',
            actorUserId
        }, async (client) => {
            const { readAt, taskStatus } = updates;
            if (readAt) {
                const res = await client.query(
                    `UPDATE messages SET read_at = $1 WHERE id = $2 RETURNING *`,
                    [readAt, messageId]
                );
                return res.rows[0];
            }
            if (taskStatus) {
                const res = await client.query(
                    `UPDATE messages SET task_status = $1 WHERE id = $2 RETURNING *`,
                    [taskStatus, messageId]
                );
                return res.rows[0];
            }
            throw new Error('No valid update fields provided');
        }, providedClient);
    }
}

module.exports = MotherWriteService;

