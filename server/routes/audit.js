const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

/**
 * Audit Events API
 * Provides endpoints for compliance and activity tracking.
 */

/**
 * GET /api/audit/admin
 * Global audit log for compliance/admins.
 */
router.get('/admin', authenticate, requireRole('SuperAdmin', 'Compliance', 'HIM', 'admin'), async (req, res) => {
    try {
        const isCompliance = ['Compliance', 'HIM', 'SuperAdmin', 'admin'].includes(req.user.role_name) || req.user.is_admin;
        const {
            startDate,
            endDate,
            userId,
            patientId,
            action,
            entityType,
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT 
                ae.*,
                u.first_name || ' ' || u.last_name as actor_name,
                p.first_name || ' ' || p.last_name as patient_name,
                p.mrn as patient_mrn
            FROM audit_events ae
            LEFT JOIN users u ON ae.actor_user_id = u.id
            LEFT JOIN patients p ON ae.patient_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            params.push(startDate);
            query += ` AND ae.occurred_at >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            query += ` AND ae.occurred_at <= $${params.length}`;
        }
        if (userId) {
            params.push(userId);
            query += ` AND ae.actor_user_id = $${params.length}`;
        }
        if (patientId) {
            params.push(patientId);
            query += ` AND ae.patient_id = $${params.length}`;
        }
        if (action) {
            params.push(action.toUpperCase());
            query += ` AND ae.action = $${params.length}`;
        }
        if (entityType) {
            params.push(entityType);
            query += ` AND ae.entity_type = $${params.length}`;
        }

        // Multi-tenancy check (unless superadmin)
        if (!req.user.is_admin && !req.user.role_name.includes('Super')) {
            params.push(req.user.clinic_id);
            query += ` AND ae.tenant_id = $${params.length}`;
        }

        query += ` ORDER BY ae.occurred_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit || 50), parseInt(offset || 0));

        const result = await pool.query(query, params);

        // Data Minimization: Redact sensitive fields if not a high-level compliance user
        const sanitizedEvents = result.rows.map(event => {
            if (!isCompliance) {
                const { ip_address, user_agent, details, ...rest } = event;
                return {
                    ...rest,
                    ip_address: 'REDACTED',
                    user_agent: 'REDACTED',
                    details: { info: 'Restricted by RBAC' }
                };
            }
            return event;
        });

        res.json({
            events: sanitizedEvents,
            pagination: {
                limit: parseInt(limit || 50),
                offset: parseInt(offset || 0),
                hasMore: result.rows.length === parseInt(limit || 50)
            }
        });
    } catch (error) {
        console.error('[AuditAPI] Error fetching admin audit log:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/audit/patient/:patientId
 * Contextual audit events for a patient chart.
 */
router.get('/patient/:patientId', authenticate, async (req, res) => {
    try {
        const { patientId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        // RBAC Check: Clinicians can see activity, but maybe hide IP/Device info?
        const isCompliance = ['Compliance', 'HIM', 'SuperAdmin', 'admin'].includes(req.user.role_name) || req.user.is_admin;

        const query = `
            SELECT 
                ae.id, ae.occurred_at, ae.action, ae.entity_type, ae.entity_id,
                u.first_name || ' ' || u.last_name as actor_name,
                ae.actor_role,
                ${isCompliance ? 'ae.ip_address, ae.user_agent,' : ''}
                ae.details
            FROM audit_events ae
            LEFT JOIN users u ON ae.actor_user_id = u.id
            WHERE ae.patient_id = $1
            ORDER BY ae.occurred_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [patientId, limit, offset]);
        res.json(result.rows);
    } catch (error) {
        console.error('[AuditAPI] Error fetching patient audit log:', error);
        res.status(500).json({ error: 'Failed to fetch patient activity' });
    }
});

/**
 * GET /api/audit/note/:noteId
 * Note lifecycle history.
 */
router.get('/note/:noteId', authenticate, async (req, res) => {
    try {
        const { noteId } = req.params;
        const isCompliance = ['Compliance', 'HIM', 'SuperAdmin', 'admin'].includes(req.user.role_name) || req.user.is_admin;


        const result = await pool.query(`
            SELECT 
                ae.id, ae.occurred_at, ae.action, ae.entity_type, ae.entity_id,
                u.first_name || ' ' || u.last_name as actor_name,
                ae.actor_role,
                ${isCompliance ? 'ae.ip_address, ae.user_agent, ae.details' : 'NULL as ip_address, NULL as user_agent, NULL as details'}
            FROM audit_events ae
            LEFT JOIN users u ON ae.actor_user_id = u.id
            WHERE ae.entity_id = $1 AND ae.entity_type = 'Note'
            ORDER BY ae.occurred_at ASC
        `, [noteId]);

        res.json(result.rows);
    } catch (error) {
        console.error('[AuditAPI] Error fetching note history:', error);
        res.status(500).json({ error: 'Failed to fetch note history' });
    }
});

/**
 * GET /api/audit/admin/export
 * Export audit logs to CSV (Audited action)
 */
router.get('/admin/export', authenticate, requireRole('Compliance', 'HIM', 'SuperAdmin', 'admin'), async (req, res) => {
    try {
        const { startDate, endDate, action } = req.query;

        // Log the export action itself first
        req.logAuditEvent({
            action: 'EXPORT_CREATED',
            entityType: 'AuditLog',
            details: {
                format: 'CSV',
                filters: { startDate, endDate, action }
            }
        });

        // Fetch data for export
        let query = `
            SELECT 
                ae.occurred_at, ae.action, ae.entity_type, ae.entity_id,
                u.first_name || ' ' || u.last_name as actor_name,
                ae.actor_role, ae.ip_address, ae.user_agent, ae.details
            FROM audit_events ae
            LEFT JOIN users u ON ae.actor_user_id = u.id
            WHERE ae.tenant_id = $1
        `;
        const params = [req.user.clinic_id];

        if (startDate) {
            params.push(startDate);
            query += ` AND ae.occurred_at >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            query += ` AND ae.occurred_at <= $${params.length}`;
        }
        if (action) {
            params.push(action.toUpperCase());
            query += ` AND ae.action = $${params.length}`;
        }

        query += ` ORDER BY ae.occurred_at DESC LIMIT 5000`;

        const result = await pool.query(query, params);

        // Convert to CSV
        const headers = ['Timestamp', 'Action', 'Entity', 'Entity ID', 'Actor', 'Role', 'IP', 'User Agent', 'Details'];
        const csvRows = [headers.join(',')];

        for (const row of result.rows) {
            const values = [
                row.occurred_at.toISOString(),
                row.action,
                row.entity_type,
                row.entity_id || 'N/A',
                row.actor_name || 'System',
                row.actor_role || 'N/A',
                row.ip_address || 'N/A',
                `"${(row.user_agent || 'N/A').replace(/"/g, '""')}"`,
                `"${JSON.stringify(row.details).replace(/"/g, '""')}"`
            ];
            csvRows.push(values.join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit_export_${new Date().getTime()}.csv`);
        res.send(csvRows.join('\n'));

    } catch (error) {
        console.error('[AuditAPI] Export failed:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

module.exports = router;
