const privacyService = require('../services/privacyService');

/**
 * Middleware to enforce chart restriction and break-glass rules.
 * This should be applied to routes that access patient clinical data.
 */
const enforcePrivacy = async (req, res, next) => {
    const patientId = req.params.id || req.query.patientId || req.body.patientId;
    const userId = req.user?.id;
    const clinicId = req.user?.clinic_id;

    if (!patientId || !userId) return next();

    try {
        const restriction = await privacyService.getChartRestriction(patientId);

        if (restriction && restriction.is_restricted) {
            // Check if user has an active break-glass session
            const hasSession = await privacyService.hasValidBreakGlassSession(userId, patientId);

            if (!hasSession) {
                // Access Denied - Break glass required
                return res.status(403).json({
                    error: 'RESTRICTED_CHART',
                    message: 'This patient chart is restricted. You must "Break the Glass" to access it.',
                    restrictionReason: restriction.restriction_reason || 'Sensitive Record'
                });
            }

            // Access allowed via break glass - log as restricted access
            await privacyService.logChartAccess(req, patientId, 'CHART_OPEN');
        } else {
            // Normal chart access
            await privacyService.logChartAccess(req, patientId, 'CHART_OPEN');
        }

        next();
    } catch (error) {
        console.error('[PrivacyMiddleware] Error:', error);
        res.status(500).json({ error: 'Internal privacy enforcement error' });
    }
};

/**
 * Variation for non-blocking audit logging (for actions that don't open the whole chart)
 */
const auditAccess = (accessType) => async (req, res, next) => {
    const patientId = req.params.id || req.query.patientId || req.body.patientId;
    if (patientId) {
        await privacyService.logChartAccess(req, patientId, accessType);
    }
    next();
};

module.exports = {
    enforcePrivacy,
    auditAccess
};
