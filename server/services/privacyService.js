const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Commercial-Grade Privacy & Audit Service
 * Handles restricted charts, break-the-glass scoping, and anomaly detection.
 */

/**
 * Check if a patient chart is currently restricted
 */
async function getChartRestriction(patientId) {
    try {
        const res = await pool.query(
            'SELECT is_restricted, restriction_reason, restricted_by_user_id, restricted_at FROM patients WHERE id = $1',
            [patientId]
        );
        return res.rows[0] || null;
    } catch (error) {
        console.error('[PrivacyService] Error checking restriction:', error);
        return null;
    }
}

/**
 * Check if a user has an active break-glass session for a patient
 */
async function hasValidBreakGlassSession(userId, patientId) {
    try {
        const res = await pool.query(
            `SELECT id FROM break_glass_sessions 
       WHERE user_id = $1 AND patient_id = $2 
       AND expires_at > CURRENT_TIMESTAMP
       ORDER BY expires_at DESC LIMIT 1`,
            [userId, patientId]
        );
        return res.rows.length > 0;
    } catch (error) {
        console.error('[PrivacyService] Error checking BTG session:', error);
        return false;
    }
}

/**
 * Create a new break-glass session
 */
async function breakGlass(userId, patientId, clinicId, data) {
    const { reasonCode, reasonComment, ip, userAgent } = data;

    try {
        // Get TTL from clinic settings
        const settingsRes = await pool.query(
            'SELECT break_glass_session_ttl_minutes FROM clinic_settings WHERE clinic_id = $1',
            [clinicId]
        );
        const ttlMinutes = settingsRes.rows[0]?.break_glass_session_ttl_minutes || 60;

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

        const res = await pool.query(
            `INSERT INTO break_glass_sessions 
       (clinic_id, patient_id, user_id, expires_at, reason_code, reason_comment, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
            [clinicId, patientId, userId, expiresAt, reasonCode, reasonComment, ip, userAgent]
        );

        // Create privacy alert for break-glass event
        await createPrivacyAlert(clinicId, 'medium', 'BREAK_GLASS_USED', userId, patientId, {
            reason_code: reasonCode,
            reason_comment: reasonComment
        });

        // Check for high-frequency alerts (Phase 2 requirement)
        await checkAnomalyThresholds(clinicId, userId);

        return res.rows[0].id;
    } catch (error) {
        console.error('[PrivacyService] Error creating BTG session:', error);
        throw error;
    }
}

/**
 * Log chart access with noise reduction (once per session/patient)
 */
async function logChartAccess(req, patientId, accessType = 'CHART_OPEN') {
    const clinicId = req.user?.clinic_id;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const ip = req.ip;
    const userAgent = req.get('user-agent');
    const sessionId = req.sessionId || 'legacy-session';

    if (!userId || !clinicId) return;

    try {
        // Phase 2: Log CHART_OPEN once per user/patient/session to reduce clutter
        if (accessType === 'CHART_OPEN') {
            const recentLog = await pool.query(
                `SELECT id FROM chart_access_logs 
         WHERE clinic_id = $1 AND user_id = $2 AND patient_id = $3 
         AND access_type = 'CHART_OPEN' 
         AND created_at > (CURRENT_TIMESTAMP - INTERVAL '1 hour')
         LIMIT 1`,
                [clinicId, userId, patientId]
            );
            if (recentLog.rows.length > 0) return; // Skip logging if opened in last hour
        }

        // Get restriction status for the log
        const restriction = await getChartRestriction(patientId);
        const isRestricted = restriction?.is_restricted || false;

        // Check if break glass was used (active session)
        const hasBTG = await hasValidBreakGlassSession(userId, patientId);

        await pool.query(
            `INSERT INTO chart_access_logs 
       (clinic_id, patient_id, user_id, user_role, access_type, is_restricted, break_glass_used, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [clinicId, patientId, userId, userRole, accessType, isRestricted, hasBTG, ip, userAgent]
        );

        // High volume access detection (Phase 2)
        if (accessType === 'CHART_OPEN') {
            await checkHighVolumeAccess(clinicId, userId);
        }
    } catch (error) {
        console.error('[PrivacyService] Error logging access:', error);
    }
}

/**
 * Anomaly Detection: High volume chart access
 */
async function checkHighVolumeAccess(clinicId, userId) {
    try {
        const settings = await pool.query(
            'SELECT alert_threshold_chart_opens_per_10min FROM clinic_settings WHERE clinic_id = $1',
            [clinicId]
        );
        const threshold = settings.rows[0]?.alert_threshold_chart_opens_per_10min || 30;

        const res = await pool.query(
            `SELECT count(*) FROM chart_access_logs 
       WHERE clinic_id = $1 AND user_id = $2 AND access_type = 'CHART_OPEN'
       AND created_at > (CURRENT_TIMESTAMP - INTERVAL '10 minutes')`,
            [clinicId, userId]
        );

        if (parseInt(res.rows[0].count) > threshold) {
            await createPrivacyAlert(clinicId, 'high', 'HIGH_VOLUME_ACCESS', userId, null, {
                count: res.rows[0].count,
                threshold,
                period: '10 minutes'
            });
        }
    } catch (e) {
        console.error('[PrivacyService] Anomaly detection error:', e);
    }
}

/**
 * Anomaly Detection: Repeat Break-Glass
 */
async function checkAnomalyThresholds(clinicId, userId) {
    try {
        const settings = await pool.query(
            'SELECT alert_threshold_break_glass_per_24h FROM clinic_settings WHERE clinic_id = $1',
            [clinicId]
        );
        const threshold = settings.rows[0]?.alert_threshold_break_glass_per_24h || 5;

        const res = await pool.query(
            `SELECT count(*) FROM break_glass_sessions 
       WHERE clinic_id = $1 AND user_id = $2 
       AND created_at > (CURRENT_TIMESTAMP - INTERVAL '24 hours')`,
            [clinicId, userId]
        );

        if (parseInt(res.rows[0].count) > threshold) {
            await createPrivacyAlert(clinicId, 'high', 'EXCESSIVE_BREAK_GLASS', userId, null, {
                count: res.rows[0].count,
                threshold,
                period: '24 hours'
            });
        }

        // After hours check
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
        const config = (await pool.query(
            'SELECT after_hours_start, after_hours_end FROM clinic_settings WHERE clinic_id = $1',
            [clinicId]
        )).rows[0];

        if (config) {
            if (currentTime > config.after_hours_start || currentTime < config.after_hours_end) {
                await createPrivacyAlert(clinicId, 'high', 'AFTER_HOURS_ACCESS', userId, null, {
                    time: currentTime,
                    window: `${config.after_hours_start} - ${config.after_hours_end}`
                });
            }
        }
    } catch (e) {
        console.error('[PrivacyService] Threshold check error:', e);
    }
}

/**
 * Create a privacy alert
 */
async function createPrivacyAlert(clinicId, severity, alertType, userId, patientId, details) {
    try {
        await pool.query(
            `INSERT INTO privacy_alerts (clinic_id, severity, alert_type, user_id, patient_id, details_json)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [clinicId, severity, alertType, userId, patientId, details]
        );
    } catch (error) {
        console.error('[PrivacyService] Error creating privacy alert:', error);
    }
}

module.exports = {
    getChartRestriction,
    hasValidBreakGlassSession,
    breakGlass,
    logChartAccess,
    createPrivacyAlert
};
