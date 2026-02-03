/**
 * OAuth 2.1 Routes
 * 
 * Implements OAuth 2.1 authorization server endpoints:
 * - /oauth/authorize - Authorization endpoint
 * - /oauth/token - Token endpoint
 * - /oauth/revoke - Token revocation
 * - /oauth/introspect - Token introspection
 * - /.well-known/openid-configuration - Discovery
 */

const express = require('express');
const crypto = require('crypto');
const oauthService = require('../services/oauthService');
const pool = require('../db');

const router = express.Router();

/**
 * OpenID Connect Discovery
 * GET /.well-known/openid-configuration
 */
router.get('/.well-known/openid-configuration', (req, res) => {
    const issuer = process.env.OAUTH_ISSUER || 'https://api.pagemdemr.com';

    res.json({
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        revocation_endpoint: `${issuer}/oauth/revoke`,
        introspection_endpoint: `${issuer}/oauth/introspect`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
        code_challenge_methods_supported: ['S256', 'plain'],
        scopes_supported: [
            'patient.read', 'patient.write',
            'appointment.read', 'appointment.write',
            'encounter.read', 'encounter.write',
            'document.read', 'document.write',
            'medication.read', 'medication.write',
            'admin.apps.manage',
            'webhook.manage',
            'ai.use'
        ]
    });
});

/**
 * Authorization Endpoint
 * GET /oauth/authorize
 * 
 * For web apps: redirects to login page with auth context
 * This endpoint initiates the authorization code flow
 */
router.get('/authorize', async (req, res) => {
    try {
        const {
            client_id,
            redirect_uri,
            response_type,
            scope,
            state,
            code_challenge,
            code_challenge_method = 'S256',
            nonce
        } = req.query;

        // Validate required parameters
        if (!client_id) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'client_id is required' });
        }
        if (response_type !== 'code') {
            return res.status(400).json({ error: 'unsupported_response_type', error_description: 'Only code response type is supported' });
        }
        if (!redirect_uri) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is required' });
        }

        // PKCE is required for authorization code flow in OAuth 2.1
        if (!code_challenge) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'code_challenge is required (PKCE)' });
        }

        // Validate client and redirect_uri
        const appResult = await pool.controlPool.query(
            `SELECT a.*, p.status as partner_status 
       FROM apps a 
       JOIN partners p ON a.partner_id = p.id 
       WHERE a.client_id = $1`,
            [client_id]
        );

        if (appResult.rows.length === 0) {
            return res.status(400).json({ error: 'invalid_client', error_description: 'Client not found' });
        }

        const app = appResult.rows[0];

        if (app.status !== 'active' || app.partner_status !== 'active') {
            return res.status(400).json({ error: 'invalid_client', error_description: 'Client is not active' });
        }

        // Validate redirect_uri is registered
        const registeredUris = app.redirect_uris || [];
        if (!registeredUris.includes(redirect_uri)) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is not registered' });
        }

        // Parse and validate scopes
        const requestedScopes = scope ? scope.split(' ') : [];
        const allowedScopes = app.allowed_scopes || [];
        const grantedScopes = requestedScopes.filter(s => allowedScopes.includes(s));

        if (grantedScopes.length === 0) {
            return redirectWithError(res, redirect_uri, 'invalid_scope', 'No valid scopes requested', state);
        }

        // Store authorization request in session/temp storage
        // In production, this would redirect to a login/consent page
        // For now, we'll store in a temporary table or return the form

        // Generate a secure session token for the authorization flow
        const authSessionId = crypto.randomBytes(32).toString('base64url');

        // Store authorization session (in production, use Redis or similar)
        await pool.controlPool.query(
            `INSERT INTO oauth_authorization_codes (
        code, app_id, tenant_id, user_id, scopes, redirect_uri,
        code_challenge, code_challenge_method, state, nonce, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                authSessionId,
                app.id,
                app.tenant_id || '00000000-0000-0000-0000-000000000000', // Placeholder
                null, // No user yet
                grantedScopes,
                redirect_uri,
                code_challenge,
                code_challenge_method,
                state,
                nonce,
                new Date(Date.now() + 10 * 60 * 1000) // 10 min expiry
            ]
        );

        // In a real implementation, redirect to login page
        // For API-first approach, return authorization info
        // The frontend handles the login and consent flow
        res.json({
            authorization_session: authSessionId,
            client: {
                name: app.name,
                env: app.env
            },
            requested_scopes: grantedScopes,
            redirect_uri,
            state,
            message: 'Complete authorization by calling POST /oauth/authorize with user credentials'
        });

    } catch (error) {
        console.error('[OAuth] Authorization error:', error);
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
    }
});

/**
 * Complete Authorization (after user login/consent)
 * POST /oauth/authorize
 */
router.post('/authorize', async (req, res) => {
    try {
        const { authorization_session, tenant_id, user_id, approved } = req.body;

        if (!authorization_session) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'authorization_session is required' });
        }

        // Fetch the pending authorization
        const sessionResult = await pool.controlPool.query(
            `SELECT * FROM oauth_authorization_codes 
       WHERE code = $1 AND expires_at > NOW() AND used_at IS NULL`,
            [authorization_session]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid or expired authorization session' });
        }

        const session = sessionResult.rows[0];

        if (!approved) {
            // User denied
            return redirectWithError(res, session.redirect_uri, 'access_denied', 'User denied the request', session.state);
        }

        if (!tenant_id || !user_id) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'tenant_id and user_id are required' });
        }

        // Generate the actual authorization code
        const code = crypto.randomBytes(48).toString('base64url');

        // Update the session with the actual code and user info
        await pool.controlPool.query(
            `UPDATE oauth_authorization_codes 
       SET code = $1, tenant_id = $2, user_id = $3, expires_at = NOW() + INTERVAL '10 minutes'
       WHERE code = $4`,
            [code, tenant_id, user_id, authorization_session]
        );

        // Redirect with code
        const redirectUrl = new URL(session.redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (session.state) {
            redirectUrl.searchParams.set('state', session.state);
        }

        res.json({ redirect_url: redirectUrl.toString(), code });

    } catch (error) {
        console.error('[OAuth] Authorization completion error:', error);
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
    }
});

/**
 * Token Endpoint
 * POST /oauth/token
 */
router.post('/token', async (req, res) => {
    try {
        const { grant_type, code, redirect_uri, code_verifier, scope, refresh_token } = req.body;

        // Extract client credentials (Basic auth or POST body)
        let clientId, clientSecret;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Basic ')) {
            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
            [clientId, clientSecret] = credentials.split(':');
        } else {
            clientId = req.body.client_id;
            clientSecret = req.body.client_secret;
        }

        if (!clientId || !clientSecret) {
            return res.status(401).json({ error: 'invalid_client', error_description: 'Client credentials required' });
        }

        // Validate client
        const validation = await oauthService.validateClient(clientId, clientSecret);
        if (!validation.valid) {
            return res.status(401).json({ error: validation.error, error_description: validation.error_description });
        }

        let result;

        switch (grant_type) {
            case 'authorization_code':
                if (!code) {
                    return res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
                }
                result = await oauthService.exchangeAuthorizationCode(code, clientId, code_verifier, redirect_uri);
                break;

            case 'client_credentials':
                const requestedScopes = scope ? scope.split(' ') : validation.app.allowed_scopes || [];
                result = await oauthService.clientCredentialsGrant(clientId, clientSecret, requestedScopes);
                break;

            case 'refresh_token':
                if (!refresh_token) {
                    return res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token is required' });
                }
                result = await oauthService.refreshAccessToken(refresh_token, clientId, clientSecret);
                break;

            default:
                return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Unsupported grant type' });
        }

        if (result.error) {
            return res.status(400).json({ error: result.error, error_description: result.error_description });
        }

        res.json(result);

    } catch (error) {
        console.error('[OAuth] Token error:', error);
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
    }
});

/**
 * Token Revocation
 * POST /oauth/revoke
 */
router.post('/revoke', async (req, res) => {
    try {
        const { token, token_type_hint } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'token is required' });
        }

        await oauthService.revokeToken(token, token_type_hint);

        // Always return 200 OK per RFC 7009
        res.status(200).end();

    } catch (error) {
        console.error('[OAuth] Revocation error:', error);
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
    }
});

/**
 * Token Introspection
 * POST /oauth/introspect
 */
router.post('/introspect', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'token is required' });
        }

        // TODO: Require client authentication for introspection
        const result = await oauthService.introspectToken(token);
        res.json(result);

    } catch (error) {
        console.error('[OAuth] Introspection error:', error);
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
    }
});

/**
 * Helper to redirect with error
 */
function redirectWithError(res, redirectUri, error, description, state) {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', description);
    if (state) {
        url.searchParams.set('state', state);
    }
    return res.redirect(302, url.toString());
}

module.exports = router;
