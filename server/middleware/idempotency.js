/**
 * Idempotency Middleware
 * 
 * Ensures POST/PATCH requests with Idempotency-Key header
 * return the same response for duplicate requests.
 */

const crypto = require('crypto');
const pool = require('../db');

/**
 * Hash the request body for comparison
 */
function hashRequestBody(body) {
    return crypto.createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
}

/**
 * Idempotency middleware
 * 
 * For POST and PATCH requests:
 * - If Idempotency-Key header is present, check for existing record
 * - If found with matching request hash, return cached response
 * - If found with different hash, return 422 (hash mismatch)
 * - Otherwise, process request and store response
 */
const idempotency = async (req, res, next) => {
    // Only apply to POST and PATCH
    if (!['POST', 'PATCH'].includes(req.method)) {
        return next();
    }

    const idempotencyKey = req.headers['idempotency-key'];

    // If no key provided, process normally
    if (!idempotencyKey) {
        return next();
    }

    // Validate key format (max 255 chars)
    if (idempotencyKey.length > 255) {
        return res.status(400).json({
            error: {
                code: 'invalid_idempotency_key',
                message: 'Idempotency-Key must be 255 characters or less',
                request_id: res.requestId
            }
        });
    }

    // Get tenant and app from OAuth context or user context
    const tenantId = req.oauth?.tenantId || req.clinic?.id;
    const appId = req.oauth?.appId || 'internal';

    if (!tenantId) {
        // No tenant context, skip idempotency
        return next();
    }

    const requestHash = hashRequestBody(req.body);
    const requestPath = req.path;
    const requestMethod = req.method;

    try {
        // Check for existing idempotency record
        const existingResult = await pool.controlPool.query(
            `SELECT * FROM idempotency_records 
       WHERE tenant_id = $1 AND app_id = $2 AND idempotency_key = $3
       AND expires_at > NOW()`,
            [tenantId, appId, idempotencyKey]
        );

        if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];

            // Check if request hash matches
            if (existing.request_hash !== requestHash) {
                return res.status(422).json({
                    error: {
                        code: 'idempotency_key_reused',
                        message: 'Idempotency-Key has already been used with a different request body',
                        request_id: res.requestId
                    }
                });
            }

            // Check if path and method match
            if (existing.request_path !== requestPath || existing.request_method !== requestMethod) {
                return res.status(422).json({
                    error: {
                        code: 'idempotency_key_reused',
                        message: 'Idempotency-Key has already been used with a different endpoint',
                        request_id: res.requestId
                    }
                });
            }

            // Return cached response
            res.set('Idempotent-Replayed', 'true');
            return res.status(existing.status_code).json(existing.response_blob);
        }

        // No existing record - capture the response
        const originalJson = res.json.bind(res);

        res.json = async function (body) {
            // Store the response for future requests
            try {
                await pool.controlPool.query(
                    `INSERT INTO idempotency_records 
           (tenant_id, app_id, idempotency_key, request_hash, request_path, request_method, response_blob, status_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (tenant_id, app_id, idempotency_key) DO NOTHING`,
                    [tenantId, appId, idempotencyKey, requestHash, requestPath, requestMethod, body, res.statusCode]
                );
            } catch (err) {
                console.error('[Idempotency] Failed to store response:', err.message);
            }

            return originalJson(body);
        };

        next();
    } catch (error) {
        console.error('[Idempotency] Error:', error);
        // On error, proceed without idempotency
        next();
    }
};

/**
 * Cleanup expired idempotency records (run periodically)
 */
async function cleanupExpiredRecords() {
    try {
        const result = await pool.controlPool.query(
            `DELETE FROM idempotency_records WHERE expires_at < NOW()`
        );
        if (result.rowCount > 0) {
            console.log(`[Idempotency] Cleaned up ${result.rowCount} expired records`);
        }
    } catch (error) {
        console.error('[Idempotency] Cleanup error:', error);
    }
}

module.exports = {
    idempotency,
    cleanupExpiredRecords
};
