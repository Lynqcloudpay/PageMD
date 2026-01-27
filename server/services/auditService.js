const { AsyncLocalStorage } = require('async_hooks');
const pool = require('../db');

const auditStorage = new AsyncLocalStorage();

/**
 * Audit Events Service
 * Handles commercial-grade, immutable audit logging.
 */
class AuditService {
    /**
     * Legacy support for AuditService.log
     * Primarily used by Platform Admin / SuperAdmin routes
     * 
     * @param {Object} client - DB client (unused in new implementation, uses pool proxy)
     * @param {string} action - Action name
     * @param {string} entityId - Target entity ID
     * @param {Object} details - Metadata
     */
    static async log(client, action, entityId, details = {}) {
        // Map old parameters to new logEvent format
        return this.logEvent({
            action: action,
            entityType: 'Platform',
            entityId: entityId,
            details: details
        });
    }

    /**
     * Log a sensitive action to the audit_events table.
     * 
     * @param {Object} event - Event details
     * @param {string} event.action - e.g., 'NOTE_SIGNED', 'PATIENT_VIEWED'
     * @param {string} event.entityType - e.g., 'Note', 'Patient'
     * @param {string} [event.entityId] - ID of the entity
     * @param {string} [event.patientId] - Patient context
     * @param {string} [event.encounterId] - Visit context
     * @param {Object} [event.details] - Additional JSON metadata
     * @param {Object} [overrideContext] - Optional override for actor/metadata
     */
    static async logEvent(event, overrideContext = null) {
        try {
            const store = auditStorage.getStore() || {};
            const context = overrideContext || store;

            const {
                action,
                entityType = 'General',
                entityId,
                patientId,
                encounterId,
                details = {}
            } = event;

            const {
                userId,
                role,
                tenantId,
                ip,
                userAgent,
                requestId
            } = context;

            // Use the database proxy for execution
            await pool.query(
                `INSERT INTO audit_events (
                    action, entity_type, entity_id, patient_id, encounter_id, 
                    actor_user_id, actor_role, tenant_id, ip_address, user_agent, 
                    request_id, details
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    action.toUpperCase(),
                    entityType,
                    entityId,
                    patientId,
                    encounterId,
                    userId,
                    role,
                    tenantId,
                    ip,
                    userAgent,
                    requestId,
                    JSON.stringify(details)
                ]
            );
        } catch (error) {
            // Never break the main flow for auditing
            console.error('[AuditService] Failed to log audit event:', error.message);
        }
    }

    /**
     * Start an audit context for the current request/execution.
     */
    static runWithContext(context, fn) {
        return auditStorage.run(context, fn);
    }

    /**
     * Get the current audit context.
     */
    static getContext() {
        return auditStorage.getStore();
    }
}

module.exports = AuditService;
