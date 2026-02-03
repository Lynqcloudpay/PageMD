const { v4: uuidv4 } = require('uuid');
const AuditService = require('../services/auditService');

/**
 * Commercial-Grade Audit Middleware
 * Generates request ID and captures metadata.
 */
const auditMiddleware = (req, res, next) => {
    // 1. Generate / Capture Request ID
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;

    // 2. Initialize Context
    // User info starts as null; populated after authentication
    const context = {
        requestId,
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        userId: null,
        role: null,
        tenantId: null
    };

    // 3. Attach Helpers to Request
    // This allows manual logging or context updates in routes/other middleware
    req.auditContext = context;
    req.logAuditEvent = (event) => AuditService.logEvent(event, context);

    // 4. Trace completion
    res.on('finish', () => {
        // Update context with finalized info
        context.userId = req.user?.id || req.oauth?.userId || context.userId;
        context.tenantId = req.clinic?.id || req.oauth?.tenantId || context.tenantId;
        context.role = req.user?.role?.name || req.oauth?.role || context.role;

        const duration = Date.now() - (req._startTime || Date.now());

        AuditService.logEvent({
            type: 'request_completed',
            path: req.urlForLogging || req.originalUrl || req.url,
            method: req.method,
            status: res.statusCode,
            duration,
            requestId: req.requestId
        }, context);
    });

    req._startTime = Date.now();

    // 5. Run Downstream with Context
    return AuditService.runWithContext(context, next);
};

module.exports = auditMiddleware;
