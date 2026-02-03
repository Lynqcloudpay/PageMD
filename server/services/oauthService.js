/**
 * OAuth 2.1 Service
 * 
 * Implements OAuth 2.1 with:
 * - Authorization Code + PKCE (for user-facing apps)
 * - Client Credentials (for server-to-server)
 * - JWT access tokens with standard claims
 * - Refresh token rotation
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');

// Token expiration defaults
const ACCESS_TOKEN_EXPIRY = process.env.OAUTH_ACCESS_TOKEN_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.OAUTH_REFRESH_TOKEN_EXPIRY_DAYS || '30', 10);
const AUTH_CODE_EXPIRY_MINUTES = 10;

/**
 * Validate PKCE code_verifier against code_challenge
 */
function validatePKCE(codeVerifier, codeChallenge, method = 'S256') {
    if (method === 'S256') {
        const hash = crypto.createHash('sha256').update(codeVerifier).digest();
        const computed = hash.toString('base64url');
        return computed === codeChallenge;
    } else if (method === 'plain') {
        return codeVerifier === codeChallenge;
    }
    return false;
}

/**
 * Generate a cryptographically secure random string
 */
function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('base64url');
}

/**
 * Hash a token for storage
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a client_id
 */
function generateClientId() {
    return 'pmd_' + generateSecureToken(24);
}

/**
 * Generate a client_secret
 */
function generateClientSecret() {
    return 'pmds_' + generateSecureToken(32);
}

class OAuthService {
    /**
     * Register a new app for a partner
     */
    async createApp(partnerId, appData) {
        const clientId = generateClientId();
        const clientSecret = generateClientSecret();
        const clientSecretHash = await bcrypt.hash(clientSecret, 12);

        const { name, description, env = 'sandbox', redirectUris = [], allowedScopes = [], tenantId } = appData;

        // Determine rate limit policy based on environment
        const rateLimitPolicyId = env === 'production'
            ? '00000000-0000-0000-0000-000000000002'
            : '00000000-0000-0000-0000-000000000001';

        const result = await pool.query(
            `INSERT INTO apps (
        partner_id, name, description, env, client_id, client_secret_hash,
        redirect_uris, allowed_scopes, rate_limit_policy_id, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, client_id, name, env, status, allowed_scopes, created_at`,
            [partnerId, name, description, env, clientId, clientSecretHash,
                redirectUris, allowedScopes, rateLimitPolicyId, tenantId || null]
        );

        return {
            ...result.rows[0],
            client_secret: clientSecret // Only returned once at creation
        };
    }

    /**
     * Rotate client secret
     */
    async rotateClientSecret(appId) {
        const clientSecret = generateClientSecret();
        const clientSecretHash = await bcrypt.hash(clientSecret, 12);

        await pool.query(
            `UPDATE apps SET client_secret_hash = $1, updated_at = NOW() WHERE id = $2`,
            [clientSecretHash, appId]
        );

        return { client_secret: clientSecret };
    }

    /**
     * Validate client credentials
     */
    async validateClient(clientId, clientSecret) {
        const result = await pool.query(
            `SELECT id, partner_id, name, env, status, client_secret_hash, 
              allowed_scopes, redirect_uris, rate_limit_policy_id, tenant_id
       FROM apps WHERE client_id = $1`,
            [clientId]
        );

        if (result.rows.length === 0) {
            return { valid: false, error: 'invalid_client', error_description: 'Client not found' };
        }

        const app = result.rows[0];

        if (app.status !== 'active') {
            return { valid: false, error: 'invalid_client', error_description: 'Client is suspended or revoked' };
        }

        const secretValid = await bcrypt.compare(clientSecret, app.client_secret_hash);
        if (!secretValid) {
            return { valid: false, error: 'invalid_client', error_description: 'Invalid client credentials' };
        }

        return { valid: true, app };
    }

    /**
     * Create authorization code for PKCE flow
     */
    async createAuthorizationCode(appId, tenantId, userId, scopes, redirectUri, codeChallenge, codeChallengeMethod, state, nonce) {
        const code = generateSecureToken(48);
        const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MINUTES * 60 * 1000);

        await pool.query(
            `INSERT INTO oauth_authorization_codes (
        code, app_id, tenant_id, user_id, scopes, redirect_uri,
        code_challenge, code_challenge_method, state, nonce, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [code, appId, tenantId, userId, scopes, redirectUri,
                codeChallenge, codeChallengeMethod, state, nonce, expiresAt]
        );

        return code;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeAuthorizationCode(code, clientId, codeVerifier, redirectUri) {
        // Fetch the authorization code
        const result = await pool.query(
            `SELECT ac.*, a.allowed_scopes as app_allowed_scopes, a.tenant_id as app_tenant_id
       FROM oauth_authorization_codes ac
       JOIN apps a ON ac.app_id = a.id
       WHERE ac.code = $1 AND a.client_id = $2`,
            [code, clientId]
        );

        if (result.rows.length === 0) {
            return { error: 'invalid_grant', error_description: 'Authorization code not found' };
        }

        const authCode = result.rows[0];

        // Check if already used
        if (authCode.used_at) {
            // Potential replay attack - revoke all tokens for this code
            await this.revokeTokensByAuthCode(code);
            return { error: 'invalid_grant', error_description: 'Authorization code already used' };
        }

        // Check expiry
        if (new Date(authCode.expires_at) < new Date()) {
            return { error: 'invalid_grant', error_description: 'Authorization code expired' };
        }

        // Validate redirect URI
        if (authCode.redirect_uri !== redirectUri) {
            return { error: 'invalid_grant', error_description: 'Redirect URI mismatch' };
        }

        // Validate PKCE
        if (authCode.code_challenge) {
            if (!codeVerifier) {
                return { error: 'invalid_grant', error_description: 'Code verifier required' };
            }
            if (!validatePKCE(codeVerifier, authCode.code_challenge, authCode.code_challenge_method)) {
                return { error: 'invalid_grant', error_description: 'Invalid code verifier' };
            }
        }

        // Mark code as used
        await pool.query(
            `UPDATE oauth_authorization_codes SET used_at = NOW() WHERE code = $1`,
            [code]
        );

        // Generate tokens
        return this.generateTokens(authCode.app_id, authCode.tenant_id, authCode.user_id, authCode.scopes);
    }

    /**
     * Client credentials flow (server-to-server)
     */
    async clientCredentialsGrant(clientId, clientSecret, requestedScopes) {
        const validation = await this.validateClient(clientId, clientSecret);
        if (!validation.valid) {
            return validation;
        }

        const app = validation.app;

        // Filter requested scopes to only allowed scopes
        const allowedScopes = app.allowed_scopes || [];
        const grantedScopes = requestedScopes.filter(s => allowedScopes.includes(s));

        if (grantedScopes.length === 0) {
            return { error: 'invalid_scope', error_description: 'No valid scopes requested' };
        }

        // For client credentials, we use the app's bound tenant if set
        const tenantId = app.tenant_id;
        if (!tenantId) {
            return { error: 'invalid_grant', error_description: 'App must be bound to a tenant for client credentials flow' };
        }

        // Generate access token only (no refresh token for client credentials)
        const accessToken = await this.generateAccessToken(app.id, tenantId, null, grantedScopes);

        return {
            access_token: accessToken.token,
            token_type: 'Bearer',
            expires_in: accessToken.expiresIn,
            scope: grantedScopes.join(' ')
        };
    }

    /**
     * Generate access and refresh tokens
     */
    async generateTokens(appId, tenantId, userId, scopes) {
        const accessToken = await this.generateAccessToken(appId, tenantId, userId, scopes);
        const refreshToken = await this.createRefreshToken(appId, tenantId, userId, scopes);

        return {
            access_token: accessToken.token,
            token_type: 'Bearer',
            expires_in: accessToken.expiresIn,
            refresh_token: refreshToken.token,
            scope: scopes.join(' ')
        };
    }

    /**
     * Generate JWT access token
     */
    async generateAccessToken(appId, tenantId, userId, scopes, refreshTokenId = null) {
        const jti = generateSecureToken(16);
        const now = Math.floor(Date.now() / 1000);

        // Parse expiry
        let expiresIn = 3600; // 1 hour default
        const expiryMatch = ACCESS_TOKEN_EXPIRY.match(/^(\d+)([hmd])$/);
        if (expiryMatch) {
            const value = parseInt(expiryMatch[1], 10);
            const unit = expiryMatch[2];
            if (unit === 'h') expiresIn = value * 3600;
            else if (unit === 'm') expiresIn = value * 60;
            else if (unit === 'd') expiresIn = value * 86400;
        }

        // Get app and clinic info for token claims
        const appResult = await pool.query(
            `SELECT a.name as app_name, a.env, p.name as partner_name
       FROM apps a
       JOIN partners p ON a.partner_id = p.id
       WHERE a.id = $1`,
            [appId]
        );

        let clinicIds = [];
        let role = 'app';

        if (userId) {
            // Get user's clinic access and role
            const userResult = await pool.query(
                `SELECT r.name as role_name FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
                [userId]
            );
            if (userResult.rows.length > 0) {
                role = userResult.rows[0].role_name || 'user';
            }
            clinicIds = [tenantId]; // For now, single clinic
        }

        const payload = {
            iss: process.env.OAUTH_ISSUER || 'https://api.pagemdemr.com',
            sub: userId || `app:${appId}`,
            aud: process.env.OAUTH_AUDIENCE || 'https://api.pagemdemr.com',
            iat: now,
            exp: now + expiresIn,
            jti,
            tenant_id: tenantId,
            clinic_ids: clinicIds,
            role,
            scopes,
            app_id: appId,
            app_name: appResult.rows[0]?.app_name,
            env: appResult.rows[0]?.env
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });

        // Store token reference for revocation capability
        const expiresAt = new Date((now + expiresIn) * 1000);
        await pool.query(
            `INSERT INTO oauth_access_tokens (jti, app_id, tenant_id, user_id, scopes, refresh_token_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [jti, appId, tenantId, userId, scopes, refreshTokenId, expiresAt]
        );

        return { token, expiresIn, jti };
    }

    /**
     * Create refresh token
     */
    async createRefreshToken(appId, tenantId, userId, scopes, parentTokenId = null) {
        const token = generateSecureToken(48);
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        const result = await pool.query(
            `INSERT INTO oauth_refresh_tokens (token_hash, app_id, tenant_id, user_id, scopes, parent_token_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
            [tokenHash, appId, tenantId, userId, scopes, parentTokenId, expiresAt]
        );

        return { token, id: result.rows[0].id };
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken, clientId, clientSecret) {
        // Validate client
        const validation = await this.validateClient(clientId, clientSecret);
        if (!validation.valid) {
            return validation;
        }

        const tokenHash = hashToken(refreshToken);

        const result = await pool.query(
            `SELECT rt.*, a.id as app_id, a.allowed_scopes
       FROM oauth_refresh_tokens rt
       JOIN apps a ON rt.app_id = a.id
       WHERE rt.token_hash = $1 AND a.client_id = $2`,
            [tokenHash, clientId]
        );

        if (result.rows.length === 0) {
            return { error: 'invalid_grant', error_description: 'Invalid refresh token' };
        }

        const refreshTokenRecord = result.rows[0];

        // Check if revoked
        if (refreshTokenRecord.revoked_at) {
            return { error: 'invalid_grant', error_description: 'Refresh token has been revoked' };
        }

        // Check expiry
        if (new Date(refreshTokenRecord.expires_at) < new Date()) {
            return { error: 'invalid_grant', error_description: 'Refresh token expired' };
        }

        // Rotate refresh token (revoke old, issue new)
        await pool.query(
            `UPDATE oauth_refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
            [refreshTokenRecord.id]
        );

        // Generate new tokens
        const newRefreshToken = await this.createRefreshToken(
            refreshTokenRecord.app_id,
            refreshTokenRecord.tenant_id,
            refreshTokenRecord.user_id,
            refreshTokenRecord.scopes,
            refreshTokenRecord.id // parent token for audit trail
        );

        const accessToken = await this.generateAccessToken(
            refreshTokenRecord.app_id,
            refreshTokenRecord.tenant_id,
            refreshTokenRecord.user_id,
            refreshTokenRecord.scopes,
            newRefreshToken.id
        );

        return {
            access_token: accessToken.token,
            token_type: 'Bearer',
            expires_in: accessToken.expiresIn,
            refresh_token: newRefreshToken.token,
            scope: refreshTokenRecord.scopes.join(' ')
        };
    }

    /**
     * Revoke token
     */
    async revokeToken(token, tokenTypeHint = 'access_token') {
        const tokenHash = hashToken(token);

        if (tokenTypeHint === 'refresh_token') {
            await pool.query(
                `UPDATE oauth_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
                [tokenHash]
            );
        } else {
            // Try to decode as JWT and revoke by jti
            try {
                const decoded = jwt.decode(token);
                if (decoded?.jti) {
                    await pool.query(
                        `UPDATE oauth_access_tokens SET revoked_at = NOW() WHERE jti = $1`,
                        [decoded.jti]
                    );
                }
            } catch (e) {
                // Not a valid JWT, ignore
            }
        }

        return { success: true };
    }

    /**
     * Revoke all tokens associated with an auth code (for replay attack detection)
     */
    async revokeTokensByAuthCode(code) {
        // This would require tracking which tokens came from which auth code
        // For now, just log the potential attack
        console.warn(`[OAuthService] Potential replay attack detected for auth code: ${code.substring(0, 8)}...`);
    }

    /**
     * Introspect token
     */
    async introspectToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Check if revoked
            const result = await pool.query(
                `SELECT revoked_at FROM oauth_access_tokens WHERE jti = $1`,
                [decoded.jti]
            );

            if (result.rows.length > 0 && result.rows[0].revoked_at) {
                return { active: false };
            }

            return {
                active: true,
                scope: decoded.scopes.join(' '),
                client_id: decoded.app_id,
                username: decoded.sub,
                token_type: 'Bearer',
                exp: decoded.exp,
                iat: decoded.iat,
                sub: decoded.sub,
                aud: decoded.aud,
                iss: decoded.iss,
                tenant_id: decoded.tenant_id
            };
        } catch (e) {
            return { active: false };
        }
    }

    /**
     * Clean up expired tokens (call periodically)
     */
    async cleanupExpiredTokens() {
        const result = await pool.query(`
      DELETE FROM oauth_authorization_codes WHERE expires_at < NOW();
      DELETE FROM oauth_access_tokens WHERE expires_at < NOW();
      DELETE FROM oauth_refresh_tokens WHERE expires_at < NOW();
      DELETE FROM idempotency_records WHERE expires_at < NOW();
    `);
        return { cleaned: true };
    }
}

module.exports = new OAuthService();
