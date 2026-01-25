const pool = require('../db');

/**
 * Middleware to restrict access to EMR features based on clinic subscription/settings
 * @param {string} featureName - The name of the feature to check (e.g., 'efax', 'labs', 'telehealth')
 */
const featureGuard = (featureName) => {
    return async (req, res, next) => {
        try {
            // Get clinic context (attached by resolveTenant)
            const clinicId = req.clinic?.id || req.user?.clinic_id;

            if (!clinicId) {
                return res.status(403).json({ error: 'Clinic context required for this feature' });
            }

            // Check if we already have features in req.clinic (cached by resolveTenant)
            let features = req.clinic?.enabled_features;

            if (!features) {
                // Query control database for clinic features if not in request context
                const result = await pool.controlPool.query(
                    'SELECT enabled_features FROM clinics WHERE id = $1',
                    [clinicId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Clinic not found in platform registry' });
                }
                features = result.rows[0].enabled_features || {};
            }

            // Check if feature is explicitly enabled (strict whitelist)
            if (features[featureName] !== true) {
                console.warn(`[FEATURE-GUARD] Access denied to ${featureName} for clinic: ${clinicId}`);
                return res.status(403).json({
                    error: `The '${featureName}' feature is not enabled for your clinic.`,
                    feature: featureName,
                    contact_admin: true
                });
            }

            // Feature is enabled, proceed
            next();
        } catch (error) {
            console.error(`[FEATURE-GUARD] Error checking feature '${featureName}':`, error);
            res.status(500).json({ error: 'System error verifying feature availability' });
        }
    };
};

module.exports = featureGuard;
