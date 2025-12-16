const jwt = require('jsonwebtoken');
const pool = require('../db');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user with role information and admin privileges
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.status,
        u.role_id,
        r.name as role_name,
        r.description as role_description,
        CASE 
          WHEN r.name = 'Admin' OR r.name = 'admin' OR r.name = 'SuperAdmin' OR u.role = 'admin' THEN true 
          ELSE false 
        END as is_admin
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [decoded.userId]);
    
    console.log('[AUTH] User query result:', result.rows.length > 0 ? `Found user ${result.rows[0].email}` : 'No user found');

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = result.rows[0];

    // Check if user is active (allow null status for legacy users)
    if (user.status && user.status !== 'active') {
      return res.status(401).json({ error: 'Account is suspended or inactive' });
    }

    req.user = user;

    // Ensure role_name is populated (fallback to legacy role)
    if (!req.user.role_name && req.user.role) {
      req.user.role_name = req.user.role;
    }

    next();
  } catch (error) {
    console.error('[AUTH] Authentication error:', error.message);
    console.error('[AUTH] Error stack:', error.stack);
    // If it's a JWT error, provide more specific message
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has one of the required roles (case-insensitive)
    const userRole = (req.user.role_name || req.user.role || '').toLowerCase();
    const normalizedRoles = roles.map(r => r.toLowerCase());

    // Admin users always have access
    if (req.user.is_admin === true || userRole === 'admin') {
      return next();
    }

    if (!normalizedRoles.includes(userRole)) {
      // Log unauthorized access attempt
      logAudit(
        req.user.id,
        'role_access.denied',
        'authorization',
        null,
        {
          attempted_roles: roles,
          user_role: req.user.role_name || req.user.role,
          path: req.path,
          method: req.method
        },
        req.ip,
        req.get('user-agent'),
        'failure'
      );

      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role_name || req.user.role
      });
    }
    next();
  };
};

/**
 * HIPAA-compliant audit logging
 * Logs all PHI access with required metadata
 * Details are sanitized to remove PHI values
 */
const logAudit = async (
  userId,
  action,
  targetType,
  targetId,
  details = {},
  ipAddress = null,
  userAgent = null,
  outcome = 'success',
  requestId = null,
  sessionId = null
) => {
  try {
    // Sanitize details to remove PHI (keep only metadata)
    const sanitizedDetails = sanitizeAuditDetails(details);

    await pool.query(
      `INSERT INTO audit_logs (
        actor_user_id, action, target_type, target_id, 
        actor_ip, details, user_agent, outcome, request_id, session_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        action,
        targetType,
        targetId,
        ipAddress,
        JSON.stringify(sanitizedDetails),
        userAgent,
        outcome,
        requestId,
        sessionId
      ]
    );
  } catch (error) {
    // Silently fail audit logging - don't break the main request
    // But log to console for monitoring
    console.warn('Failed to log audit:', error.message);
    console.error('Failed to log audit:', error);
  }
};

/**
 * Sanitize audit details to remove PHI
 * Only keep metadata, not actual PHI values
 */
const sanitizeAuditDetails = (details) => {
  if (!details || typeof details !== 'object') {
    return {};
  }

  const sanitized = { ...details };

  // Remove known PHI fields
  const phiFields = [
    'ssn', 'mrn', 'dob', 'dateOfBirth', 'birthDate',
    'firstName', 'lastName', 'name', 'fullName',
    'address', 'addressLine1', 'addressLine2', 'city', 'state', 'zip',
    'phone', 'phoneNumber', 'email', 'emailAddress',
    'insuranceId', 'insuranceNumber',
    'note', 'notes', 'noteDraft', 'noteSigned',
    'diagnosis', 'assessment', 'plan',
    'medication', 'allergy', 'problem'
  ];

  for (const field of phiFields) {
    if (sanitized[field] !== undefined) {
      // Replace with indicator that field was present
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeAuditDetails(sanitized[key]);
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map(item =>
        typeof item === 'object' ? sanitizeAuditDetails(item) : item
      );
    }
  }

  return sanitized;
};

/**
 * Enhanced HIPAA-compliant audit logging middleware
 * Automatically logs all PHI-relevant actions
 */
const auditLog = (action, targetType) => {
  return async (req, res, next) => {
    // Generate request ID for correlation
    const requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
    req.requestId = requestId;

    // Get session ID if available
    const sessionId = req.session?.id || req.user?.sessionId || null;

    const originalSend = res.send;
    res.send = function (data) {
      // Determine outcome
      const outcome = res.statusCode < 400 ? 'success' : 'failure';

      // Log after response
      const targetId = req.params.id || req.body.id || null;

      // Only log PHI-relevant endpoints
      const isPHIEndpoint = isPHIRelevantEndpoint(req.path, req.method);

      if (isPHIEndpoint) {
        logAudit(
          req.user?.id || null,
          action || `${req.method.toLowerCase()}.${targetType}`,
          targetType,
          targetId,
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode
            // Note: body is NOT included here - it may contain PHI
            // Only include metadata
          },
          req.ip || req.connection.remoteAddress,
          req.get('user-agent'),
          outcome,
          requestId,
          sessionId
        );
      }

      return originalSend.call(this, data);
    };
    next();
  };
};

/**
 * Check if endpoint is PHI-relevant and should be audited
 */
const isPHIRelevantEndpoint = (path, method) => {
  const phiPaths = [
    '/patients', '/visits', '/encounters', '/notes',
    '/documents', '/medications', '/allergies', '/problems',
    '/orders', '/prescriptions', '/labs', '/billing'
  ];

  return phiPaths.some(phiPath => path.includes(phiPath)) &&
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
};

module.exports = {
  authenticate,
  requireRole,
  logAudit,
  auditLog,
  sanitizeAuditDetails,
  isPHIRelevantEndpoint
};



