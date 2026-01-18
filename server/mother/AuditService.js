const pool = require('../db');

/**
 * AuditService
 * Specialized auditing for Mother Patient System.
 */
class AuditService {
    static async log(clinicId, patientId, encounterId, actorUserId, action, eventIds = [], details = {}) {
        await pool.query(
            `INSERT INTO mother_audit_log (clinic_id, patient_id, encounter_id, actor_user_id, action, event_ids, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [clinicId, patientId, encounterId, actorUserId, action, eventIds, details]
        );
    }
}

module.exports = AuditService;
