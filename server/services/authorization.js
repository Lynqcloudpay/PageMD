/**
 * Commercial-Grade EMR Authorization Service
 * 
 * Handles permission-based access control with role and user-level permissions,
 * plus scope-based filtering (CLINIC, SELF, ASSIGNED)
 */

const pool = require('../db');

/**
 * Get user authorization context including permissions and scope
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User auth context with permissions and scope
 */
async function getUserAuthContext(userId) {
  try {
    // Get user basic info (clinic_id may not exist in all schemas)
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.role, 
              COALESCE(u.is_admin, false) as is_admin,
              r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (!userRes.rows.length) return null;
    
    const user = userRes.rows[0];
    const roleName = user.role_name || user.role || 'CLINICIAN';

    // Normalize role name to match permission system
    const normalizedRole = normalizeRoleName(roleName);

    // Determine if this user should be treated as an admin
    const isAdminUser = user.is_admin || normalizedRole === 'ADMIN';

    // Get base permissions from role
    const permsRes = await pool.query(
      `SELECT permission_key AS key
       FROM role_permissions
       WHERE role = $1`,
      [normalizedRole]
    );

    // Get user-specific permission overrides
    const overridesRes = await pool.query(
      `SELECT permission_key AS key, allowed
       FROM user_permissions
       WHERE user_id = $1`,
      [userId]
    );

    // Merge permissions with overrides
    const base = new Set(permsRes.rows.map(r => r.key));
    for (const o of overridesRes.rows) {
      if (o.allowed) {
        base.add(o.key);
      } else {
        base.delete(o.key);
      }
    }

    // Admin users get all permissions
    if (isAdminUser) {
      const allPermsRes = await pool.query('SELECT key FROM permissions');
      allPermsRes.rows.forEach(p => base.add(p.key));
    }

    // Get scope configuration
    const scopeRes = await pool.query(
      `SELECT schedule_scope, patient_scope 
       FROM role_scope 
       WHERE role = $1`,
      [normalizedRole]
    );

    const scope = scopeRes.rows[0] || { 
      schedule_scope: 'CLINIC', 
      patient_scope: 'CLINIC' 
    };

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: normalizedRole,
      roleId: user.role_id,
      // Expose a clear isAdmin flag that combines DB flag + role
      isAdmin: isAdminUser,
      clinicId: null, // clinic_id column may not exist in all schemas
      permissions: Array.from(base),
      scope: {
        scheduleScope: scope.schedule_scope,
        patientScope: scope.patient_scope
      }
    };
  } catch (error) {
    console.error('Error getting user auth context:', error);
    throw error;
  }
}

/**
 * Normalize role name to match permission system roles
 * Maps common role names to standard permission roles
 */
function normalizeRoleName(roleName) {
  if (!roleName) return 'CLINICIAN';
  
  const upper = roleName.toUpperCase();
  
  // Map common variations
  if (upper.includes('ADMIN') || upper === 'ADMIN') return 'ADMIN';
  if (upper.includes('PHYSICIAN') || upper.includes('CLINICIAN') || upper === 'DOCTOR') return 'CLINICIAN';
  if (upper.includes('NURSE') || upper.includes('MA') || upper === 'MEDICAL_ASSISTANT') return 'NURSE_MA';
  if (upper.includes('FRONT') || upper.includes('RECEPTION')) return 'FRONT_DESK';
  if (upper.includes('BILLING') || upper === 'BILLER') return 'BILLING';
  if (upper.includes('AUDITOR')) return 'AUDITOR_READONLY';
  
  // Default to CLINICIAN for unknown roles
  return 'CLINICIAN';
}

/**
 * Middleware to require a specific permission
 * @param {string} permissionKey - Permission key (e.g., 'patients:view_list')
 * @returns {Function} Express middleware
 */
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin users bypass specific permission checks
    if (req.user.isAdmin === true || req.user.is_admin === true) {
      return next();
    }

    if (!req.user.permissions || !Array.isArray(req.user.permissions)) {
      console.error('User permissions not loaded:', req.user);
      return res.status(500).json({ error: 'Authorization context not loaded' });
    }

    if (!req.user.permissions.includes(permissionKey)) {
      // Log the denied access attempt
      audit(req, 'permission_denied', 'authorization', null, false).catch(() => {});
      
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Insufficient permissions',
        missing: permissionKey,
        required: permissionKey
      });
    }

    next();
  };
}

/**
 * Check if user has a specific permission (helper function)
 * @param {Object} user - User object with permissions array
 * @param {string} permissionKey - Permission key to check
 * @returns {boolean}
 */
function hasPermission(user, permissionKey) {
  if (!user) return false;

  // Admin users always have all permissions
  if (user.isAdmin === true || user.is_admin === true) {
    return true;
  }

  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }
  return user.permissions.includes(permissionKey);
}

/**
 * Audit logging helper (HIPAA-style)
 * @param {Object} req - Express request object
 * @param {string} action - Action performed
 * @param {string} entityType - Type of entity (e.g., 'patient', 'appointment')
 * @param {string|null} entityId - Entity ID
 * @param {boolean} success - Whether action succeeded
 */
async function audit(req, action, entityType, entityId, success) {
  try {
    const userId = req.user?.id || null;
    const ip = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, success, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entityType, entityId || null, success, ip, userAgent]
    );
  } catch (error) {
    // Silently fail audit logging - don't break the main request
    console.warn('Failed to log audit:', error.message);
  }
}

module.exports = {
  getUserAuthContext,
  requirePermission,
  hasPermission,
  audit,
  normalizeRoleName
};

