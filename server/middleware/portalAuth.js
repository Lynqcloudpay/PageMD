const jwt = require('jsonwebtoken');
const pool = require('../db');

/**
 * Patient Portal Authentication Middleware
 * Ensures the request is from a valid patient portal session.
 */
const authenticatePortal = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Portal authentication required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure this is a portal token, not a staff token
        if (!decoded.isPortal || !decoded.portalAccountId || !decoded.patientId) {
            return res.status(403).json({ error: 'Invalid portal session' });
        }

        // Verify the account still exists and is active in the current tenant
        // req.clinic should already be set by resolveTenant
        const result = await pool.query(`
            SELECT id, status FROM patient_portal_accounts 
            WHERE id = $1 AND patient_id = $2
        `, [decoded.portalAccountId, decoded.patientId]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Portal account not found' });
        }

        if (result.rows[0].status === 'locked') {
            return res.status(403).json({ error: 'Account is locked' });
        }

        // Attach portal user info to request
        req.portalAccount = {
            id: decoded.portalAccountId,
            patient_id: decoded.patientId
        };

        // For convenience, also set req.user if any generic middleware expects it
        // but prefix it or be careful not to mix with staff user IDs
        req.user = {
            id: decoded.portalAccountId,
            isPortal: true,
            patient_id: decoded.patientId
        };

        next();
    } catch (error) {
        console.error('[Portal Auth Middleware] Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid or expired portal session' });
    }
};

/**
 * Patient Portal Permission Middleware
 * Checks if the portal account has specific privileges enabled by the clinic staff.
 */
const requirePortalPermission = (permissionField) => {
    return async (req, res, next) => {
        try {
            const { id } = req.portalAccount;
            const result = await pool.query(
                `SELECT ${permissionField} FROM patient_portal_permissions WHERE account_id = $1`,
                [id]
            );

            if (result.rows.length === 0 || !result.rows[0][permissionField]) {
                return res.status(403).json({ error: 'Access denied. This feature is not enabled for your account.' });
            }

            next();
        } catch (error) {
            console.error('[Portal Permission Middleware] Check failed:', error.message);
            res.status(500).json({ error: 'Authorization check failed' });
        }
    };
};

module.exports = { authenticatePortal, requirePortalPermission };
