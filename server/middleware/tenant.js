const jwt = require('jsonwebtoken');
const pool = require('../db');
const tenantManager = require('../services/tenantManager');

/**
 * Multi-Tenancy Middleware
 * Resolves the clinic (tenant) for the current request.
 * Sets up the AsyncLocalStorage context for database queries.
 */
const resolveTenant = async (req, res, next) => {
    // 0. Exempt public / tenant-agnostic routes from resolution
    if (req.path.includes('/auth/sandbox')) {
        return next();
    }
    // 1. Skip Tenant Context for Platform Admin
    if (req.path.startsWith('/super/') || req.path.startsWith('/platform-auth/') ||
        req.path.startsWith('/api/super/') || req.path.startsWith('/api/platform-auth/')) {
        return next();
    }

    // 2. Determine Clinic Slug / Schema
    let slug = req.headers['x-clinic-slug'];
    let lookupSchema = null;
    let decoded = null;

    // A. Recognition by JWT Token (for already authenticated users)
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (token) {
        try {
            decoded = jwt.decode(token); // Just peek, verification happens later in auth middleware
            if (decoded) {
                if (decoded.isSandbox) {
                    req.isSandbox = true;
                    req.sandboxId = decoded.sandboxId;
                    lookupSchema = `sandbox_${decoded.sandboxId}`;
                    slug = null; // Explicitly override any header/host slug for sandbox sessions
                    console.log(`[Tenant] Sandbox mode detected for ID: ${decoded.sandboxId}`);
                } else if (!slug && decoded.clinicSlug) {
                    slug = decoded.clinicSlug;
                }
            }
        } catch (e) {
            // Ignore decoding errors here
        }
    }

    // B. Recognition by Email (specifically for Login)
    // CRITICAL: For login, we MUST check the email lookup even if a slug was provided in headers (which might be stale/incorrect)
    const isLogin = req.path === '/auth/login' || req.path === '/api/auth/login';
    const isPortalLogin = req.path === '/portal/auth/login' || req.path === '/api/portal/auth/login';

    if (isLogin && req.body && req.body.email) {
        try {
            const lookup = await pool.controlPool.query(
                'SELECT schema_name FROM platform_user_lookup WHERE email = $1',
                [req.body.email]
            );
            if (lookup.rows.length > 0) {
                lookupSchema = lookup.rows[0].schema_name;
                // If we found a schema by email, it OVERRIDES any header-provided slug during login
                slug = null;
                console.log(`[Tenant] User ${req.body.email} mapped to schema ${lookupSchema} via login lookup`);
            }
        } catch (e) {
            console.error('[Tenant] Staff Lookup failed:', e);
        }
    }

    // Portal patient auth routes that need email-based tenant lookup
    const isPortalForgot = req.path === '/portal/auth/forgot' || req.path === '/api/portal/auth/forgot';
    const isPortalReset = req.path === '/portal/auth/reset' || req.path === '/api/portal/auth/reset';

    if ((isPortalLogin || isPortalForgot || isPortalReset) && req.body && req.body.email) {
        try {
            const lookup = await pool.controlPool.query(
                'SELECT schema_name FROM platform_patient_lookup WHERE email = $1',
                [req.body.email]
            );
            if (lookup.rows.length > 0) {
                lookupSchema = lookup.rows[0].schema_name;
                console.log(`[Tenant] Patient ${req.body.email} mapped to schema ${lookupSchema} via portal lookup`);
            }
        } catch (e) {
            console.error('[Tenant] Patient Lookup failed:', e);
        }
    }

    // D. Recognition by Portal Token (for Invitations/Registration/Guest Access)
    const isPortalInviteVerify = req.path.includes('/portal/auth/invite/');
    const isPortalRegister = req.path === '/portal/auth/register' || req.path === '/api/portal/auth/register';
    const isIntakePublic = req.path.includes('/intake/public/');
    const isGuestVisit = req.path.includes('/visit/guest');

    if (!slug && !lookupSchema && (isPortalInviteVerify || isPortalRegister || isIntakePublic || isGuestVisit)) {
        try {
            const crypto = require('crypto');
            let token = null;

            if (isPortalInviteVerify) {
                token = req.path.split('/').pop();
            } else if (isIntakePublic) {
                token = req.params.token || req.path.split('/').pop();
            } else if (isGuestVisit) {
                token = req.query.token;
            } else {
                token = req.body ? req.body.token : null;
            }

            if (token) {
                // Ensure token is clean (trim whitespace)
                token = token.trim();
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                // Search across all safe tenant schemas
                const schemas = await pool.controlPool.query('SELECT schema_name FROM clinics WHERE status = \'active\'');

                console.log(`[Tenant] DEBUG: Resolving public token. Hash: ${tokenHash.substring(0, 10)}... Schemas: ${schemas.rows.length}`);

                for (const row of schemas.rows) {
                    const schema = row.schema_name;
                    try {
                        // Search in appropriate table based on request type
                        let tableToCheck = 'patient_portal_invites';
                        let colToCheck = 'token_hash';

                        if (isIntakePublic) {
                            tableToCheck = 'intake_sessions';
                            colToCheck = 'resume_code_hash';
                        } else if (isGuestVisit) {
                            tableToCheck = 'guest_access_tokens';
                            colToCheck = 'token_hash';
                        }

                        // CRITICAL FIX: Do NOT check expiration here.
                        // If the token is valid but expired, we still need to resolve the tenant.
                        const check = await pool.controlPool.query(
                            `SELECT 1 FROM ${schema}.${tableToCheck} WHERE ${colToCheck} = $1`,
                            [tokenHash]
                        );

                        if (check.rows.length > 0) {
                            lookupSchema = schema;
                            console.log(`[Tenant] Found token in schema: ${schema} (Table: ${tableToCheck})`);
                            break;
                        }
                    } catch (schemaError) {
                        // Soft error - just log and continue to next schema
                        // This prevents one bad schema (missing table) from breaking global lookup
                        console.warn(`[Tenant] Warning: Failed to check schema ${schema}:`, schemaError.message);
                    }
                }

                if (!lookupSchema) {
                    console.log(`[Tenant] DEBUG: Token resolution failed. No schema found for hash: ${tokenHash.substring(0, 10)}... (Checked ${schemas.rows.length} schemas)`);
                }
            }
        } catch (e) {
            console.error('[Tenant] Public Token lookup failed:', e);
        }
    }

    // C. Subdomain / Host / Query Resolution
    if (!slug && !lookupSchema) {
        // 1. Check Query Params (for public links like Universal QR)
        if (req.query.clinic) {
            slug = req.query.clinic;
        }
        // 2. Check Hostname / Subdomain
        else if (req.headers.host) {
            const host = req.headers.host;
            if (host.includes('pagemdemr.com') || host.includes('localhost')) {
                const parts = host.split('.');
                if (parts.length > 2) {
                    slug = parts[0];
                }
            }
        }
    }

    // Default Fallback (Legacy Support)
    if (!slug && !lookupSchema) {
        // Public endpoints that don't need tenant schema can pass through
        if (req.path.includes('/verify-token') || req.path.includes('/sales/inquiry')) {
            return next();
        }

        if (process.env.NODE_ENV === 'production') {
            console.error(`[Tenant] SECURITY ERROR: No slug or schema found for path: ${req.path}. Denying access in production.`);
            return res.status(403).json({ error: 'Clinic access required.' });
        }
        slug = 'test';
        console.log(`[Tenant] No slug or schema found, falling back to 'test' for path: ${req.path}`);
    } else if (req.isSandbox) {
        console.log(`[Tenant] Bypassing clinic lookup for Sandbox ID: ${req.sandboxId}`);
    } else {
        console.log(`[Tenant] Resolving for slug: ${slug}, schema: ${lookupSchema}, path: ${req.path}`);
    }

    // 3. Lookup Tenant Schema
    let client = null;
    try {
        // We use controlPool directly to find the tenant wrapper info
        let tenantInfo = null;

        if (req.isSandbox) {
            tenantInfo = {
                id: decoded.leadUuid || '00000000-0000-0000-0000-000000000000',
                slug: 'demo',
                schema_name: lookupSchema,
                display_name: 'PageMD Sandbox Demo',
                status: 'active',
                is_read_only: false,
                billing_locked: false,
                prescribing_locked: false,
                enabled_features: { efax: true, labs: true, telehealth: true, eprescribe: true }
            };
        } else if (lookupSchema) {
            // We already found the schema by email
            const result = await pool.controlPool.query(
                'SELECT id, slug, schema_name, display_name, logo_url, address_line1, address_line2, city, state, zip, phone, status, is_read_only, billing_locked, prescribing_locked, enabled_features FROM clinics WHERE schema_name = $1 AND status = \'active\'',
                [lookupSchema]
            );
            tenantInfo = result.rows[0];
        } else {
            // Find by slug
            const result = await pool.controlPool.query(
                'SELECT id, slug, schema_name, display_name, logo_url, address_line1, address_line2, city, state, zip, phone, status, is_read_only, billing_locked, prescribing_locked, enabled_features FROM clinics WHERE slug = $1',
                [slug]
            );
            tenantInfo = result.rows[0];
        }

        if (!tenantInfo) {
            console.warn(`[Tenant] Clinic not found for slug: ${slug} or schema: ${lookupSchema}`);
            return res.status(404).json({ error: `Clinic access denied.` });
        }

        if (tenantInfo && tenantInfo.status !== 'active') {
            return res.status(403).json({ error: `Clinic is currently ${tenantInfo.status}. Access restricted.` });
        }

        // Enforcement: Read-Only Kill Switch
        const mutableMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (tenantInfo.is_read_only && mutableMethods.includes(req.method)) {
            // Allow login/logout even in read-only mode
            if (!req.path.includes('/auth/login') && !req.path.includes('/auth/logout')) {
                return res.status(423).json({
                    error: 'Clinic is in Read-Only mode. Modifications are currently disabled by platform administrators.',
                    code: 'TENANT_READ_ONLY'
                });
            }
        }

        const { id, schema_name, slug: resolvedSlug, is_read_only, billing_locked, prescribing_locked } = tenantInfo;
        const displaySlug = resolvedSlug || slug;

        // 4. Start Transaction Wrapper (Actually just a connection now)
        client = await pool.controlPool.connect();

        // Critical Security Step: Set Search Path
        await client.query(`SET search_path TO ${schema_name}, public`);

        // 5. Attach Unified Clinic Context
        req.clinic = {
            id: tenantInfo.id,
            slug: tenantInfo.slug,
            schema_name: tenantInfo.schema_name,
            name: tenantInfo.display_name,
            logo_url: tenantInfo.logo_url,
            address: [tenantInfo.address_line1, tenantInfo.address_line2, `${tenantInfo.city || ''} ${tenantInfo.state || ''} ${tenantInfo.zip || ''}`.trim()].filter(Boolean).join('\n'),
            phone: tenantInfo.phone,
            is_read_only: tenantInfo.is_read_only,
            billing_locked: tenantInfo.billing_locked,
            prescribing_locked: tenantInfo.prescribing_locked,
            enabled_features: tenantInfo.enabled_features || {}
        };

        // 5. Run Request within Context using the safer .run() method
        // This ensures the context is preserved across 모든 (all) async continuations 
        // triggered by the downstream middleware/routes.
        client.tenantSchema = schema_name;
        req.dbClient = client;

        const cleanup = async () => {
            try {
                client.release();
            } catch (e) {
                console.error('[Tenant] Cleanup error:', e);
            }
        };

        res.on('finish', cleanup);
        res.on('close', async () => {
            if (!res.writableEnded) await cleanup();
        });

        return pool.dbStorage.run(client, async () => {
            console.log(`[Tenant] Context active for ${schema_name} (slug: ${displaySlug})`);
            return next();
        });
    } catch (error) {
        console.error('[Tenant] Resolution failed:', error);
        if (client) {
            try { client.release(); } catch (e) { }
        }
        res.status(500).json({ error: 'System error resolving tenant.' });
    }
};

module.exports = { resolveTenant };
