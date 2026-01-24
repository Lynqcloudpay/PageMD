const express = require('express');
const pool = require('../../db');
const { authenticatePortalPatient } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticatePortalPatient);

/**
 * Register a push notification token
 * POST /api/portal/push/register
 */
router.post('/register', async (req, res) => {
    try {
        const { token, platform } = req.body;
        const { portalAccountId } = req.user;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        // Upsert token
        await pool.query(`
            INSERT INTO patient_portal_push_tokens (account_id, token, platform, last_used_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (token) 
            DO UPDATE SET account_id = $1, last_used_at = CURRENT_TIMESTAMP
        `, [portalAccountId, token, platform || 'unknown']);

        res.json({ success: true });
    } catch (error) {
        console.error('[Portal Push] Register error:', error);
        res.status(500).json({ error: 'Failed to register push token' });
    }
});

/**
 * Unregister a push notification token
 * DELETE /api/portal/push/unregister
 */
router.delete('/unregister', async (req, res) => {
    try {
        const { portalAccountId } = req.user;

        // Unregister all tokens for this account (or could pass specific token if needed)
        // Ideally the client sends the specific token to delete, but for logout wiping all for this user is safer/easier for now
        // actually, usually logout only wipes the current device's token. 
        // But since we don't have the token in the DELETE body typically without extra work, 
        // we'll leave it as a "soft" unregister or if the client sends the token in query/body we use it.
        // For simplicity, let's just log it for now as the client handles the UI side. 
        // But to be correct, we should probably delete the token associated with this session if we tracked session-token mapping.

        // If the client sends the token, delete it.
        const token = req.query.token || req.body.token;

        if (token) {
            await pool.query('DELETE FROM patient_portal_push_tokens WHERE token = $1 AND account_id = $2', [token, portalAccountId]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Portal Push] Unregister error:', error);
        res.status(500).json({ error: 'Failed to unregister push token' });
    }
});

module.exports = router;
