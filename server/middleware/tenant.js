const poolProxy = require('../db');
const tenantManager = require('../services/tenantManager');

/**
 * Multi-Tenancy Middleware
 * Resolves the clinic (tenant) for the current request.
 * Sets up the AsyncLocalStorage context for database queries.
 */
const resolveTenant = async (req, res, next) => {
    const host = req.headers.host || '';
    let slug = req.headers['x-clinic-slug'];

    // 1. Resolve slug from header or subdomain
    if (!slug && host.includes('.')) {
        const parts = host.split('.');
        if (parts.length >= 3) {
            slug = parts[0];
        }
    }

    // Fallback for development (e.g., localhost)
    if (!slug && process.env.NODE_ENV === 'development') {
        slug = process.env.DEFAULT_TENANT_SLUG || 'default';
    }

    if (!slug) {
        // If no slug, we continue with the default pool (or handle as error)
        return next();
    }

    try {
        const pool = await tenantManager.getTenantPool(slug);

        if (!pool) {
            return res.status(404).json({
                error: `Clinic '${slug}' not found or inactive.`,
                code: 'TENANT_NOT_FOUND'
            });
        }

        // Capture clinic info for other middleware/logging
        req.clinic = pool.clinicInfo;

        // 2. Wrap the execution in the DB storage context
        // This makes the tenant pool available globally via require('../db')
        poolProxy.dbStorage.run(pool, () => {
            next();
        });

    } catch (error) {
        console.error(`Tenant resolution failed for ${slug}:`, error);
        res.status(500).json({ error: 'Internal system error during tenant resolution.' });
    }
};

module.exports = { resolveTenant };
