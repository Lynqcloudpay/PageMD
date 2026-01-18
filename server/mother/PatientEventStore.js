const pool = require('../db');

/**
 * Event payload schemas for validation
 */
const EVENT_SCHEMAS = {
    VITAL_RECORDED: (p) => {
        if (!p || typeof p !== 'object') return 'Payload required';
        // Must have at least one vital sign
        const hasVitals = p.bp || p.hr || p.temp || p.rr || p.spo2 || p.weight ||
            p.systolic || p.diastolic || p.blood_pressure;
        if (!hasVitals) return 'At least one vital sign required';
        return null;
    },
    MED_ADDED: (p) => {
        if (!p?.medication_name) return 'medication_name required';
        return null;
    },
    MED_CHANGED: (p) => {
        if (!p?.med_id && !p?.medication_name) return 'med_id or medication_name required';
        return null;
    },
    MED_STOPPED: (p) => {
        if (!p?.med_id && !p?.medication_name) return 'med_id or medication_name required';
        return null;
    },
    DX_ADDED: (p) => {
        if (!p?.problem_name && !p?.icd10_code) return 'problem_name or icd10_code required';
        return null;
    },
    DX_RESOLVED: (p) => {
        if (!p?.problem_id && !p?.problem_name) return 'problem_id or problem_name required';
        return null;
    },
    ORDER_PLACED: (p) => {
        if (!p?.order_type) return 'order_type required';
        return null;
    },
    ORDER_UPDATED: (p) => {
        if (!p?.order_id) return 'order_id required';
        return null;
    },
    DOCUMENT_CREATED: (p) => {
        if (!p?.doc_type && !p?.document_id) return 'doc_type or document_id required';
        return null;
    },
    VISIT_SIGNED: (p) => {
        if (!p?.visit_id) return 'visit_id required';
        return null;
    },
    ALLERGY_ADDED: (p) => {
        if (!p?.allergen) return 'allergen required';
        return null;
    },
    PATIENT_CREATED: (p) => {
        if (!p?.first_name || !p?.last_name) return 'first_name and last_name required';
        return null;
    },
    PATIENT_UPDATED: (p) => {
        if (!p || Object.keys(p).length === 0) return 'update payload required';
        return null;
    }
};

/**
 * PatientEventStore
 * Low-level interface to the immutable event ledger.
 */
class PatientEventStore {
    /**
     * Validates event payload against schema
     */
    static validatePayload(eventType, payload) {
        const validator = EVENT_SCHEMAS[eventType];
        if (!validator) return null; // No schema = no validation (permissive for unknown types)
        return validator(payload);
    }

    /**
     * Appends an event to the ledger.
     * @param {Object} dbClient - Transactional client
     * @param {Object} eventData - { clinicId, patientId, encounterId, eventType, payload, refs, sourceModule, actorUserId, occurredAt }
     */
    static async appendEvent(dbClient, eventData) {
        const {
            clinicId,
            patientId,
            encounterId,
            eventType,
            payload = {},
            refs = {},
            sourceModule,
            actorUserId,
            occurredAt = new Date()
        } = eventData;

        // Validate payload
        const validationError = this.validatePayload(eventType, payload);
        if (validationError) {
            throw new Error(`Event validation failed for ${eventType}: ${validationError}`);
        }

        const result = await dbClient.query(
            `INSERT INTO patient_event (
                clinic_id, patient_id, encounter_id, event_type, payload, refs, source_module, actor_user_id, occurred_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [clinicId, patientId, encounterId, eventType, payload, refs, sourceModule, actorUserId, occurredAt]
        );

        return result.rows[0];
    }

    /**
     * Retrieves events for a patient in chronological order (by occurred_at).
     */
    static async getEvents(clinicId, patientId, filters = {}) {
        let query = `SELECT * FROM patient_event WHERE clinic_id = $1 AND patient_id = $2`;
        const params = [clinicId, patientId];
        let paramIndex = 3;

        if (filters.eventType) {
            query += ` AND event_type = $${paramIndex++}`;
            params.push(filters.eventType);
        }

        if (filters.startDate) {
            query += ` AND occurred_at >= $${paramIndex++}`;
            params.push(filters.startDate);
        }

        query += ` ORDER BY occurred_at ASC, created_at ASC`;

        const result = await pool.query(query, params);
        return result.rows;
    }
}

module.exports = PatientEventStore;

