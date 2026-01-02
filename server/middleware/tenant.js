const jwt = require('jsonwebtoken');
const pool = require('../db');
const tenantManager = require('../services/tenantManager');

/**
 * Multi-Tenancy Middleware
 * Resolves the clinic (tenant) for the current request.
 * Sets up the AsyncLocalStorage context for database queries.
 */
const resolveTenant = async (req, res, next) => {
    // 1. Skip Tenant Context for Platform Admin / Public Routes
    if (req.path.startsWith('/super/') || req.path.startsWith('/platform-auth/') ||
        req.path.startsWith('/api/super/') || req.path.startsWith('/api/platform-auth/')) {
        return next();
    }

    // 2. Determine Clinic Slug / Schema
    let slug = req.headers['x-clinic-slug'];
    let lookupSchema = null;

    // A. Recognition by JWT Token (for already authenticated users)
    const authHeader = req.headers.authorization;
    if (!slug && authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.decode(token); // Just peek, verification happens later in auth middleware
            if (decoded && decoded.clinicSlug) {
                slug = decoded.clinicSlug;
            }
        } catch (e) {
            // Ignore decoding errors here
        }
    }

    // B. Recognition by Email (specifically for Login)
    // If it's a login attempt and we don't have a slug, try to find the clinic by email
    const isLogin = req.path === '/auth/login' || req.path === '/api/auth/login';
    const isPortalLogin = req.path === '/portal/auth/login' || req.path === '/api/portal/auth/login';

    if (!slug && isLogin && req.body && req.body.email) {
        try {
            const lookup = await pool.controlPool.query(
                'SELECT schema_name FROM platform_user_lookup WHERE email = $1',
                [req.body.email]
            );
            if (lookup.rows.length > 0) {
                lookupSchema = lookup.rows[0].schema_name;
            }
        } catch (e) {
            console.error('[Tenant] Staff Lookup failed:', e);
        }
    } else if (!slug && isPortalLogin && req.body && req.body.email) {
        try {
            const lookup = await pool.controlPool.query(
                'SELECT schema_name FROM platform_patient_lookup WHERE email = $1',
                [req.body.email]
            );
            if (lookup.rows.length > 0) {
                lookupSchema = lookup.rows[0].schema_name;
            }
        } catch (e) {
            console.error('[Tenant] Patient Lookup failed:', e);
        }
    }

    // C. Subdomain / Host Resolution
    if (!slug && !lookupSchema && req.headers.host) {
        const host = req.headers.host;
        // logic for subdomains: clinic.bemypcp.com
        if (host.includes('bemypcp.com') || host.includes('localhost')) {
            const parts = host.split('.');
            if (parts.length > 2) {
                slug = parts[0];
            }
        }
    }

    // Default Fallback (Legacy Support)
    if (!slug && !lookupSchema) slug = 'test';

    // 3. Lookup Tenant Schema
    let client = null;
    try {
        // We use controlPool directly to find the tenant wrapper info
        let tenantInfo = null;

        if (lookupSchema) {
            // We already found the schema by email
            const result = await pool.controlPool.query(
                'SELECT id, slug, schema_name, status, is_read_only, billing_locked, prescribing_locked FROM clinics WHERE schema_name = $1 AND status = \'active\'',
                [lookupSchema]
            );
            tenantInfo = result.rows[0];
        } else {
            // Find by slug
            const result = await pool.controlPool.query(
                'SELECT id, slug, schema_name, status, is_read_only, billing_locked, prescribing_locked FROM clinics WHERE slug = $1',
                [slug]
            );
            tenantInfo = result.rows[0];
        }

        if (!tenantInfo) {
            console.warn(`[Tenant] Clinic not found for slug: ${slug} or schema: ${lookupSchema}`);
            return res.status(404).json({ error: `Clinic access denied.` });
        }

        if (tenantInfo.status !== 'active') {
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

        // 4. Start Transaction Wrapper
        client = await pool.controlPool.connect();

        await client.query('BEGIN');

        // Critical Security Step: Set Search Path
        await client.query(`SET LOCAL search_path TO ${schema_name}, public`);

        // Attach clinic info
        req.clinic = {
            id,
            slug: resolvedSlug,
            schema_name,
            is_read_only,
            billing_locked,
            prescribing_locked
        };

        // 5. Run Request within Context using the safer .run() method
        // This ensures the context is preserved across 모든 (all) async continuations 
        // triggered by the downstream middleware/routes.
        client.tenantSchema = schema_name;
        req.dbClient = client;

        const cleanup = async () => {
            try {
                if (res.statusCode >= 400) {
                    await client.query('ROLLBACK');
                } else {
                    await client.query('COMMIT');
                }
            } catch (e) {
                console.error('[Tenant] Cleanup error:', e);
            } finally {
                client.release();
            }
        };

        res.on('finish', cleanup);
        res.on('close', async () => {
            if (!res.writableEnded) await cleanup();
        });

        return pool.dbStorage.run(client, async () => {
            const status = await client.query('SELECT current_schema() as sch, current_setting(\'search_path\') as path');
            console.log(`[Tenant] Context active for ${schema_name} (slug: ${slug}). Schema: ${status.rows[0].sch}`);
            return next();
        });
    } catch (error) {
        console.error('[Tenant] Resolution failed:', error);
        if (client) {
            try { await client.query('ROLLBACK'); client.release(); } catch (e) { }
        }
        res.status(500).json({ error: 'System error resolving tenant.' });
    }
};

module.exports = { resolveTenant };
