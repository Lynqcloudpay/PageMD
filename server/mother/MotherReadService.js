const pool = require('../db');

/**
 * MotherReadService
 * Single canonical service for all patient-related reads.
 */
class MotherReadService {
    static async getPatientState(clinicId, patientId) {
        const vitals = await pool.query(
            'SELECT * FROM patient_state_vitals_latest WHERE clinic_id = $1 AND patient_id = $2',
            [clinicId, patientId]
        );

        const meds = await pool.query(
            "SELECT * FROM patient_state_medications WHERE clinic_id = $1 AND patient_id = $2 AND status = 'active' ORDER BY medication_name",
            [clinicId, patientId]
        );

        const problems = await pool.query(
            "SELECT * FROM patient_state_problems WHERE clinic_id = $1 AND patient_id = $2 AND status = 'active' ORDER BY problem_name",
            [clinicId, patientId]
        );

        const openOrders = await pool.query(
            "SELECT * FROM patient_state_orders_open WHERE clinic_id = $1 AND patient_id = $2 ORDER BY ordered_at DESC",
            [clinicId, patientId]
        );

        const allergies = await pool.query(
            "SELECT * FROM patient_state_allergies WHERE clinic_id = $1 AND patient_id = $2 AND status = 'active' ORDER BY allergen",
            [clinicId, patientId]
        );

        return {
            vitals: vitals.rows[0] || null,
            medications: meds.rows,
            problems: problems.rows,
            openOrders: openOrders.rows,
            allergies: allergies.rows
        };
    }

    static async getPatientTimeline(clinicId, patientId, limit = 50, offset = 0) {
        const result = await pool.query(
            `SELECT * FROM patient_event 
             WHERE clinic_id = $1 AND patient_id = $2 
             ORDER BY occurred_at DESC, created_at DESC 
             LIMIT $3 OFFSET $4`,
            [clinicId, patientId, limit, offset]
        );
        return result.rows;
    }

    static async getPatientSummary(clinicId, patientId) {
        const state = await this.getPatientState(clinicId, patientId);
        const timeline = await this.getPatientTimeline(clinicId, patientId, 10);

        // Fetch demographic info from existing patients table - ensure clinic scoping
        const patientRes = await pool.query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2', [patientId, clinicId]);

        return {
            demographics: patientRes.rows[0],
            state,
            recentEvents: timeline
        };
    }

    static async searchDocuments(clinicId, patientId, query) {
        const sql = `
            SELECT id, doc_type, title, status, created_at, author_user_id,
                   ts_headline('english', content_text, plainto_tsquery('english', $3)) as snippet
            FROM patient_document
            WHERE clinic_id = $1 AND patient_id = $2
              AND (search_vector @@ plainto_tsquery('english', $3) OR title ILIKE $4)
            ORDER BY created_at DESC`;

        const result = await pool.query(sql, [clinicId, patientId, query, `%${query}%`]);
        return result.rows;
    }
}

module.exports = MotherReadService;
