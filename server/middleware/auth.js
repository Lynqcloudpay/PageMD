const jwt = require('jsonwebtoken');
const pool = require('../db');
const { getUserAuthContext } = require('../services/authorization');

const authenticate = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(' ')[1];

    // Fallback to query parameter token (for direct file downloads/views)
    if (!token && req.query.token) {
      token = req.query.token;
    }

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
        COALESCE(u.is_admin, false) as is_admin
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

    // Load authorization context (permissions and scope)
    try {
      const authContext = await getUserAuthContext(user.id);
      if (!authContext) {
        return res.status(401).json({ error: 'Failed to load authorization context' });
      }

      // Merge auth context with user data
      // CRITICAL: Preserve is_admin from database query (it's the source of truth)
      // authContext might normalize it or not include it, so we always use the DB value
      const dbIsAdmin = user.is_admin === true || user.is_admin === 'true' || String(user.is_admin) === 'true';

      req.user = {
        ...user,
        ...authContext,
        // Force is_admin to use database value (highest priority)
        is_admin: dbIsAdmin,
        isAdmin: dbIsAdmin,   // Also set camelCase version
        role_name: user.role_name || authContext?.role_name || user.role || 'User', // Preserve original role name
        role: user.role_name || authContext?.role_name || user.role || 'User' // Also set role for compatibility
      };

      // Debug log in development
      if (process.env.DEBUG_AUTH === 'true') {
        console.log('[AUTH] User merged:', {
          email: req.user.email,
          role_name: req.user.role_name,
          is_admin_db: user.is_admin,
          is_admin_final: req.user.is_admin,
          isAdmin_final: req.user.isAdmin
        });
      }
    } catch (authError) {
      // If permissions system isn't set up yet, fall back to basic user info
      console.warn('[AUTH] Failed to load auth context, using basic user info:', authError.message);
      req.user = user;
      req.user.permissions = [];
      req.user.scope = { scheduleScope: 'CLINIC', patientScope: 'CLINIC' };
      req.user.isAdmin = user.is_admin; // Ensure camelCase version exists
    }

    // Ensure role_name is populated (fallback to legacy role)
    if (!req.user.role_name && req.user.role) {
      req.user.role_name = req.user.role;
    }

    // Ensure role_name and role are always strings (never undefined/null)
    if (!req.user.role_name && !req.user.role) {
      req.user.role_name = 'User';
      req.user.role = 'User';
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

    // Safely get user role with proper null/undefined handling
    const roleName = req.user.role_name || req.user.role;
    const userRole = (roleName && typeof roleName === 'string' ? roleName : '').toLowerCase();
    const normalizedRoles = roles.map(r => (r && typeof r === 'string' ? r : '').toLowerCase());

    // Admin users always have access (check both is_admin flag and role)
    // Check multiple possible admin flags - be very explicit about boolean checks
    // Convert to boolean explicitly to handle 't', 'true', true, etc.
    const checkAdminFlag = (flag) => {
      if (flag === true || flag === 'true' || flag === 't' || String(flag).toLowerCase() === 'true') {
        return true;
      }
      return false;
    };

    const isAdmin = checkAdminFlag(req.user.is_admin) ||
      checkAdminFlag(req.user.isAdmin) ||
      userRole === 'admin' ||
      userRole === 'superadmin';

    // Debug logging
    console.log('[requireRole]', {
      path: req.path,
      email: req.user.email,
      userRole,
      role_name: req.user.role_name,
      is_admin_raw: req.user.is_admin,
      is_admin_type: typeof req.user.is_admin,
      isAdmin_raw: req.user.isAdmin,
      isAdminCheck: isAdmin,
      requiredRoles: roles
    });

    if (isAdmin) {
      console.log('[requireRole] Admin access granted for', req.user.email);
      return next();
    }

    // Map role aliases (physician = clinician, doctor = clinician, etc.)
    const roleAliases = {
      'physician': 'clinician',
      'doctor': 'clinician',
      'md': 'clinician',
      'nurse practitioner': 'clinician',
      'np': 'clinician',
      'pa': 'clinician',
      'physician assistant': 'clinician'
    };

    const mappedUserRole = roleAliases[userRole] || userRole;

    // Check if user role matches (either directly or via alias)
    const hasAccess = normalizedRoles.includes(mappedUserRole) || normalizedRoles.includes(userRole);

    if (!hasAccess) {
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
        current: req.user.role_name || req.user.role,
        message: `Missing: ${roles.join(',')}`
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



