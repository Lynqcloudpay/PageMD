const pool = require('../db');

class SupportService {
    /**
     * Create a new support ticket with automated context
     * @param {Object} user - Authenticated user { clinicId, email, role, userAgent }
     * @param {Object} ticketData - { subject, description, priority, clientState }
     */
    static async createTicket(user, ticketData) {
        // 1. Fetch Audit Context (Last 20 actions for this clinic)
        // This provides "replay" capability for support engineers
        let auditContext = [];
        try {
            // Fetch recent logs for this clinic to understand system state
            const logsRes = await pool.controlPool.query(`
                SELECT action, created_at, details 
                FROM platform_audit_logs 
                WHERE target_clinic_id = $1 
                ORDER BY created_at DESC 
                LIMIT 20
            `, [user.clinicId]);
            auditContext = logsRes.rows;
        } catch (err) {
            console.error('Failed to fetch audit context for ticket:', err);
            // Don't fail the ticket creation just because context failed
            auditContext = [{ error: 'Failed to retrieve audit context' }];
        }

        // 2. Assemble Context Data
        const { subject, description, priority, clientState } = ticketData;
        const contextData = {
            clientState: clientState || {}, // Frontend route, Redux state, etc.
            auditTrail: auditContext,
            userAgent: user.userAgent
        };

        // 3. Insert Ticket
        const res = await pool.controlPool.query(`
            INSERT INTO platform_support_tickets 
            (clinic_id, user_email, user_role, subject, description, priority, context_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, status, created_at
        `, [
            user.clinicId,
            user.email,
            user.role,
            subject,
            description,
            priority || 'medium',
            JSON.stringify(contextData) // Ensure it's stringified for JSONB
        ]);

        return res.rows[0];
    }
}

module.exports = SupportService;
