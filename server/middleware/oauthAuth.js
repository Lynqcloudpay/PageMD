/**
 * OAuth 2.1 Authentication Middleware
 * 
 * Authenticates requests using OAuth 2.1 JWT access tokens.
 * Works alongside existing JWT auth for internal users.
 */

const jwt = require('jsonwebtoken');
const pool = require('../db');

/**
 * Authenticate OAuth 2.1 access token
 * Extracts and validates JWT, populates req.app, req.scopes, req.oauthUser
 */
const authenticateOAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    code: 'missing_token',
                    message: 'Authorization header with Bearer token required',
                    request_id: req.requestId
                }
            });
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: {
                        code: 'token_expired',
                        message: 'Access token has expired',
                        request_id: req.requestId
                    }
                });
            }
            return res.status(401).json({
                error: {
                    code: 'invalid_token',
                    message: 'Invalid access token',
                    request_id: req.requestId
                }
            });
        }

        // Check if token has been revoked
        if (decoded.jti) {
            const revokeCheck = await pool.controlPool.query(
                `SELECT revoked_at FROM oauth_access_tokens WHERE jti = $1`,
                [decoded.jti]
            );
            if (revokeCheck.rows.length > 0 && revokeCheck.rows[0].revoked_at) {
                return res.status(401).json({
                    error: {
                        code: 'token_revoked',
                        message: 'Access token has been revoked',
                        request_id: req.requestId
                    }
                });
            }
        }

        // Verify app is still active
        const appResult = await pool.controlPool.query(
            `SELECT a.id, a.name, a.env, a.status, a.allowed_scopes, a.rate_limit_policy_id,
              p.id as partner_id, p.name as partner_name, p.status as partner_status,
              rlp.burst, rlp.sustained_per_min, rlp.per_hour, rlp.per_day
       FROM apps a
       JOIN partners p ON a.partner_id = p.id
       LEFT JOIN rate_limit_policies rlp ON a.rate_limit_policy_id = rlp.id
       WHERE a.id = $1`,
            [decoded.app_id]
        );

        if (appResult.rows.length === 0) {
            return res.status(401).json({
                error: {
                    code: 'invalid_client',
                    message: 'Application not found',
                    request_id: req.requestId
                }
            });
        }

        const app = appResult.rows[0];

        if (app.status !== 'active') {
            return res.status(403).json({
                error: {
                    code: 'client_suspended',
                    message: 'Application has been suspended',
                    request_id: req.requestId
                }
            });
        }

        if (app.partner_status !== 'active') {
            return res.status(403).json({
                error: {
                    code: 'partner_suspended',
                    message: 'Partner account has been suspended',
                    request_id: req.requestId
                }
            });
        }

        // Populate request with OAuth context
        req.oauth = {
            appId: decoded.app_id,
            appName: app.name,
            appEnv: app.env,
            partnerId: app.partner_id,
            partnerName: app.partner_name,
            tenantId: decoded.tenant_id,
            userId: decoded.sub?.startsWith('app:') ? null : decoded.sub,
            scopes: decoded.scopes || [],
            role: decoded.role,
            jti: decoded.jti,
            isAppToken: decoded.sub?.startsWith('app:'),
            rateLimit: {
                burst: app.burst,
                sustainedPerMin: app.sustained_per_min,
                perHour: app.per_hour,
                perDay: app.per_day
            }
        };

        // Also set req.app for compatibility
        req.app_context = app;

        // Set tenant context for database queries
        if (decoded.tenant_id) {
            // Resolve tenant schema
            const tenantResult = await pool.controlPool.query(
                `SELECT id, slug, schema_name, display_name, status FROM clinics WHERE id = $1`,
                [decoded.tenant_id]
            );

            if (tenantResult.rows.length === 0) {
                return res.status(403).json({
                    error: {
                        code: 'invalid_tenant',
                        message: 'Tenant not found or inactive',
                        request_id: req.requestId
                    }
                });
            }

            const tenant = tenantResult.rows[0];

            if (tenant.status !== 'active') {
                return res.status(403).json({
                    error: {
                        code: 'tenant_inactive',
                        message: 'Tenant is not active',
                        request_id: req.requestId
                    }
                });
            }

            req.clinic = {
                id: tenant.id,
                slug: tenant.slug,
                schema_name: tenant.schema_name,
                name: tenant.display_name
            };
        }

        // Update audit context
        if (req.auditContext) {
            req.auditContext.appId = decoded.app_id;
            req.auditContext.tenantId = decoded.tenant_id;
            req.auditContext.userId = req.oauth.userId;
        }

        next();
    } catch (error) {
        console.error('[OAuthAuth] Authentication error:', error);
        return res.status(500).json({
            error: {
                code: 'internal_error',
                message: 'Authentication failed',
                request_id: req.requestId
            }
        });
    }
};

/**
 * Require specific scopes for an endpoint
 * Usage: requireScopes('patient.read', 'patient.write')
 */
const requireScopes = (...requiredScopes) => {
    return (req, res, next) => {
        if (!req.oauth) {
            return res.status(401).json({
                error: {
                    code: 'unauthenticated',
                    message: 'OAuth authentication required',
                    request_id: req.requestId
                }
            });
        }

        const userScopes = req.oauth.scopes || [];

        // Check if user has at least one of the required scopes
        const hasScope = requiredScopes.some(scope => userScopes.includes(scope));

        if (!hasScope) {
            return res.status(403).json({
                error: {
                    code: 'insufficient_scope',
                    message: `Required scope(s): ${requiredScopes.join(' or ')}`,
                    required_scopes: requiredScopes,
                    granted_scopes: userScopes,
                    request_id: req.requestId
                }
            });
        }

        next();
    };
};

/**
 * Require ALL specified scopes (AND logic)
 */
const requireAllScopes = (...requiredScopes) => {
    return (req, res, next) => {
        if (!req.oauth) {
            return res.status(401).json({
                error: {
                    code: 'unauthenticated',
                    message: 'OAuth authentication required',
                    request_id: req.requestId
                }
            });
        }

        const userScopes = req.oauth.scopes || [];
        const missingScopes = requiredScopes.filter(scope => !userScopes.includes(scope));

        if (missingScopes.length > 0) {
            return res.status(403).json({
                error: {
                    code: 'insufficient_scope',
                    message: `Missing required scope(s): ${missingScopes.join(', ')}`,
                    required_scopes: requiredScopes,
                    missing_scopes: missingScopes,
                    granted_scopes: userScopes,
                    request_id: req.requestId
                }
            });
        }

        next();
    };
};

/**
 * Optional OAuth authentication
 * If token present, validates it. If not, continues without auth.
 */
const optionalOAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    // If token present, validate it
    return authenticateOAuth(req, res, next);
};

/**
 * Hybrid auth - accepts both internal JWT and OAuth tokens
 * Useful for endpoints that need to work with both
 */
const hybridAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: {
                code: 'missing_token',
                message: 'Authorization header with Bearer token required',
                request_id: req.requestId
            }
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.decode(token);

        // Check if this is an OAuth token (has app_id claim)
        if (decoded?.app_id) {
            return authenticateOAuth(req, res, next);
        } else {
            // Use existing internal auth
            const { authenticate } = require('./auth');
            return authenticate(req, res, next);
        }
    } catch (error) {
        return res.status(401).json({
            error: {
                code: 'invalid_token',
                message: 'Invalid token format',
                request_id: req.requestId
            }
        });
    }
};

module.exports = {
    authenticateOAuth,
    requireScopes,
    requireAllScopes,
    optionalOAuth,
    hybridAuth
};
