/**
 * ProjectionEngine
 * Logic to derive current-state projections from events.
 */
class ProjectionEngine {
    /**
     * Applies an event to relevant projections.
     * @param {Object} dbClient - Transactional client
     * @param {Object} event - The event row from patient_event
     */
    static async apply(dbClient, event) {
        const { event_type, payload, clinic_id, patient_id, id: event_id } = event;

        switch (event_type) {
            case 'VITAL_RECORDED':
                await this.projectVitals(dbClient, clinic_id, patient_id, payload, event_id);
                break;
            case 'MED_ADDED':
            case 'MED_CHANGED':
            case 'MED_STOPPED':
                await this.projectMedication(dbClient, clinic_id, patient_id, payload, event_id);
                break;
            case 'DX_ADDED':
            case 'DX_RESOLVED':
                await this.projectProblem(dbClient, clinic_id, patient_id, payload, event_id);
                break;
            case 'ORDER_PLACED':
            case 'ORDER_RESULTED':
            case 'ORDER_CANCELED':
                await this.projectOrder(dbClient, clinic_id, patient_id, payload, event_id);
                break;
            case 'ALLERGY_ADDED':
            case 'ALLERGY_REMOVED':
            case 'ALLERGY_UPDATED':
                await this.projectAllergy(dbClient, clinic_id, patient_id, payload, event_id);
                break;
            case 'VISIT_SIGNED':
                await this.projectLastVisit(dbClient, clinic_id, patient_id, payload, event_id);
                break;
            // Add more as needed
        }
    }

    static async projectVitals(dbClient, clinicId, patientId, payload, eventId) {
        await dbClient.query(
            `INSERT INTO patient_state_vitals_latest (
                clinic_id, patient_id, bp_systolic, bp_diastolic, heart_rate, 
                respiration_rate, temperature, oxygen_saturation, weight, height, 
                bmi, pain_score, recorded_at, last_event_id, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
            ON CONFLICT (clinic_id, patient_id) DO UPDATE SET
                bp_systolic = EXCLUDED.bp_systolic,
                bp_diastolic = EXCLUDED.bp_diastolic,
                heart_rate = EXCLUDED.heart_rate,
                respiration_rate = EXCLUDED.respiration_rate,
                temperature = EXCLUDED.temperature,
                oxygen_saturation = EXCLUDED.oxygen_saturation,
                weight = EXCLUDED.weight,
                height = EXCLUDED.height,
                bmi = EXCLUDED.bmi,
                pain_score = EXCLUDED.pain_score,
                recorded_at = EXCLUDED.recorded_at,
                last_event_id = EXCLUDED.last_event_id,
                updated_at = now()`,
            [
                clinicId, patientId,
                payload.bp_systolic, payload.bp_diastolic, payload.heart_rate,
                payload.respiration_rate, payload.temperature, payload.oxygen_saturation,
                payload.weight, payload.height, payload.bmi, payload.pain_score,
                payload.recorded_at || new Date(),
                eventId
            ]
        );
    }

    static async projectMedication(dbClient, clinicId, patientId, payload, eventId) {
        // If event is MED_STOPPED, we might update status to 'inactive'
        // For simplicity in this v1, we use med_id or medication_name to match
        const medId = payload.med_id;

        if (payload.status === 'stopped' || payload.status === 'inactive') {
            await dbClient.query(
                `UPDATE patient_state_medications 
                 SET status = $3, end_date = $4, last_event_id = $5, updated_at = now()
                 WHERE clinic_id = $1 AND patient_id = $2 AND (id = $6 OR medication_name = $7)`,
                [clinicId, patientId, 'inactive', payload.end_date || new Date(), eventId, medId, payload.medication_name]
            );
        } else {
            await dbClient.query(
                `INSERT INTO patient_state_medications (
                    clinic_id, patient_id, medication_name, dosage, route, frequency, 
                    status, start_date, rxnorm_id, last_event_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    medication_name = EXCLUDED.medication_name,
                    dosage = EXCLUDED.dosage,
                    route = EXCLUDED.route,
                    frequency = EXCLUDED.frequency,
                    status = EXCLUDED.status,
                    start_date = EXCLUDED.start_date,
                    rxnorm_id = EXCLUDED.rxnorm_id,
                    last_event_id = EXCLUDED.last_event_id,
                    updated_at = now()`,
                [
                    clinicId, patientId, payload.medication_name, payload.dosage,
                    payload.route, payload.frequency, 'active', payload.start_date,
                    payload.rxnorm_id, eventId
                ]
            );
        }
    }

    static async projectProblem(dbClient, clinicId, patientId, payload, eventId) {
        if (payload.status === 'resolved' || payload.status === 'inactive') {
            await dbClient.query(
                `UPDATE patient_state_problems 
                 SET status = $3, resolution_date = $4, last_event_id = $5, updated_at = now()
                 WHERE clinic_id = $1 AND patient_id = $2 AND (id = $6 OR problem_name = $7)`,
                [clinicId, patientId, payload.status, payload.resolution_date || new Date(), eventId, payload.problem_id, payload.problem_name]
            );
        } else {
            await dbClient.query(
                `INSERT INTO patient_state_problems (
                    clinic_id, patient_id, problem_name, icd10_code, status, onset_date, last_event_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                    problem_name = EXCLUDED.problem_name,
                    icd10_code = EXCLUDED.icd10_code,
                    status = EXCLUDED.status,
                    onset_date = EXCLUDED.onset_date,
                    last_event_id = EXCLUDED.last_event_id,
                    updated_at = now()`,
                [
                    clinicId, patientId, payload.problem_name, payload.icd10_code,
                    'active', payload.onset_date, eventId
                ]
            );
        }
    }

    static async projectOrder(dbClient, clinicId, patientId, payload, eventId) {
        await dbClient.query(
            `INSERT INTO patient_state_orders_open (
                id, clinic_id, patient_id, order_type, order_description, status, ordered_at, last_event_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                last_event_id = EXCLUDED.last_event_id,
                updated_at = now()`,
            [
                payload.order_id, clinicId, patientId, payload.order_type,
                payload.order_description, payload.status, payload.ordered_at, eventId
            ]
        );

        // Remove from open orders if status is completed or cancelled
        if (['completed', 'cancelled'].includes(payload.status)) {
            await dbClient.query(
                `DELETE FROM patient_state_orders_open WHERE id = $1 AND clinic_id = $2`,
                [payload.order_id, clinicId]
            );
        }
    }

    static async projectAllergy(dbClient, clinicId, patientId, payload, eventId) {
        if (payload.status === 'removed' || payload.status === 'inactive') {
            await dbClient.query(
                `UPDATE patient_state_allergies 
                 SET status = $3, last_event_id = $4, updated_at = now()
                 WHERE clinic_id = $1 AND patient_id = $2 AND allergy_id = $5`,
                [clinicId, patientId, payload.status, eventId, payload.allergy_id]
            );
        } else {
            await dbClient.query(
                `INSERT INTO patient_state_allergies (
                    clinic_id, patient_id, allergy_id, allergen, reaction, severity, status, onset_date, last_event_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (clinic_id, patient_id, allergy_id) DO UPDATE SET
                    allergen = EXCLUDED.allergen,
                    reaction = EXCLUDED.reaction,
                    severity = EXCLUDED.severity,
                    status = EXCLUDED.status,
                    onset_date = EXCLUDED.onset_date,
                    last_event_id = EXCLUDED.last_event_id,
                    updated_at = now()`,
                [
                    clinicId, patientId, payload.allergy_id, payload.allergen,
                    payload.reaction, payload.severity, payload.status || 'active', payload.onset_date, eventId
                ]
            );
        }
    }
    static async projectLastVisit(dbClient, clinicId, patientId, payload, eventId) {
        await dbClient.query(
            `INSERT INTO patient_state_last_visit (
                clinic_id, patient_id, visit_id, visit_date, visit_type, provider_id, summary, last_event_id, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
            ON CONFLICT (clinic_id, patient_id) DO UPDATE SET
                visit_id = EXCLUDED.visit_id,
                visit_date = EXCLUDED.visit_date,
                visit_type = EXCLUDED.visit_type,
                provider_id = EXCLUDED.provider_id,
                summary = EXCLUDED.summary,
                last_event_id = EXCLUDED.last_event_id,
                updated_at = now()`,
            [
                clinicId, patientId, payload.visit_id, payload.visit_date,
                payload.visit_type, payload.provider_id, payload.summary || {}, eventId
            ]
        );
    }
}

module.exports = ProjectionEngine;
