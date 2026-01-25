const pool = require('../db');

/**
 * Middleware to restrict access to EMR features based on clinic subscription/settings
 * @param {string} featureName - The name of the feature to check (e.g., 'efax', 'labs', 'telehealth')
 */
const featureGuard = (featureName) => {
    return async (req, res, next) => {
        try {
            // Get clinic ID from authenticated user context
            const clinicId = req.user?.clinic_id;

            if (!clinicId) {
                // If no clinic ID, check if this is an admin request with a clinic context
                // Fallback for some management routes if needed, but usually we want user context
                return res.status(403).json({ error: 'Clinic context required for this feature' });
            }

            // Query control database for clinic features
            const result = await pool.controlPool.query(
                'SELECT enabled_features, display_name FROM clinics WHERE id = $1',
                [clinicId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Clinic not found in platform registry' });
            }

            const clinic = result.rows[0];
            const features = clinic.enabled_features || {};

            // Check if feature is explicitly enabled
            if (features[featureName] !== true) {
                console.warn(`[FEATURE-GUARD] Access denied to ${featureName} for clinic: ${clinic.display_name} (${clinicId})`);
                return res.status(403).json({
                    error: `The '${featureName}' feature is not enabled for your clinic.`,
                    feature: featureName,
                    clinic: clinic.display_name,
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
