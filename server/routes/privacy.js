const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const privacyService = require('../services/privacyService');
const pool = require('../db');

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/privacy/patients/:id/break-glass
 * Breaking the glass to access a restricted chart
 */
router.post('/patients/:id/break-glass', async (req, res) => {
    try {
        const { id } = req.params;
        const { reasonCode, reasonComment } = req.body;
        const userId = req.user.id;
        const clinicId = req.user.clinic_id;

        if (!reasonCode) {
            return res.status(400).json({ error: 'Reason code is required' });
        }

        const sessionId = await privacyService.breakGlass(userId, id, clinicId, {
            reasonCode,
            reasonComment,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'Break-glass session established',
            sessionId
        });
    } catch (error) {
        console.error('[Privacy-Route] Break-glass error:', error);
        res.status(500).json({ error: 'Failed to establish break-glass session' });
    }
});

/**
 * PATCH /api/privacy/patients/:id/restriction
 * Enable/Disable chart restriction (Admin/Privacy Officer only)
 */
router.patch('/patients/:id/restriction', requirePermission('settings:edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { isRestricted, reason } = req.body;
        const userId = req.user.id;

        await pool.query(
            `UPDATE patients SET 
        is_restricted = $1, 
        restriction_reason = $2, 
        restricted_by_user_id = $3, 
        restricted_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
            [isRestricted, reason, userId, id]
        );

        // Alert for restriction change
        await privacyService.createPrivacyAlert(
            req.user.clinic_id,
            'low',
            isRestricted ? 'CHART_RESTRICTED' : 'CHART_UNRESTRICTED',
            userId,
            id,
            { reason }
        );

        res.json({ success: true, isRestricted });
    } catch (error) {
        console.error('[Privacy-Route] Restriction update error:', error);
        res.status(500).json({ error: 'Failed to update chart restriction' });
    }
});

/**
 * GET /api/privacy/settings
 * Get privacy-related clinic settings
 */
router.get('/settings', async (req, res) => {
    try {
        const resSettings = await pool.query(
            'SELECT break_glass_enabled, break_glass_session_ttl_minutes, restricted_reason_options, allow_front_desk_restricted_access FROM clinic_settings WHERE clinic_id = $1',
            [req.user.clinic_id]
        );
        res.json(resSettings.rows[0] || {});
    } catch (error) {
        console.error('[Privacy-Route] Settings error:', error);
        res.status(500).json({ error: 'Failed to fetch privacy settings' });
    }
});

module.exports = router;
