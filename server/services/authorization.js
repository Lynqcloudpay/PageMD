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
    // Get user basic info
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

    // Get permissions for this SPECIFIC role ID from the database
    let permsRes = { rows: [] };
    try {
      permsRes = await pool.query(
        `SELECT p.name AS key
         FROM role_privileges rp
         JOIN privileges p ON rp.privilege_id = p.id
         WHERE rp.role_id = $1`,
        [user.role_id]
      );
    } catch (err) {
      console.warn('Could not fetch role_privileges for roleId:', user.role_id, err.message);
    }

    const base = new Set();

    if (permsRes.rows.length > 0) {
      // Use DB permissions as the source of truth
      permsRes.rows.forEach(r => {
        if (r.key) base.add(r.key);
      });
    } else {
      // Fallback: Only use defaults if the database has no privileges defined for this role
      const defaultPerms = getDefaultPermissionsForRole(normalizedRole);
      defaultPerms.forEach(p => base.add(p));
    }

    // Admin users get all permissions (both from privileges table and our hardcoded list)
    if (isAdminUser) {
      try {
        const allPermsRes = await pool.query('SELECT name AS key FROM privileges');
        allPermsRes.rows.forEach(p => {
          if (p.key) base.add(p.key);
        });
      } catch (err) {
        console.warn('Could not fetch all privileges from DB:', err.message);
      }

      // Always add comprehensive admin permissions list (new format keys)
      const adminPerms = getAllAdminPermissions();
      adminPerms.forEach(p => base.add(p));
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: normalizedRole, // Normalized for permissions
      role_name: roleName, // Original role name for display (preserve "Physician" not "CLINICIAN")
      roleId: user.role_id,
      // Expose a clear isAdmin flag that combines DB flag + role
      isAdmin: isAdminUser,
      is_admin: user.is_admin, // Also include snake_case version
      permissions: Array.from(base),
      scope: {
        scheduleScope: normalizedRole === 'CLINICIAN' ? 'SELF' : 'CLINIC',
        patientScope: normalizedRole === 'CLINICIAN' ? 'ASSIGNED' : 'CLINIC'
      }
    };
  } catch (error) {
    console.error('Error getting user auth context:', error);
    throw error;
  }
}

/**
 * Get default permissions for a role when DB permissions are not configured
 */
function getDefaultPermissionsForRole(role) {
  const commonPerms = [
    'patients:view_list',
    'patients:view_chart',
    'patients:view_demographics',
    'schedule:view',
    'prescriptions:view'
  ];

  const clinicianPerms = [
    ...commonPerms,
    'patients:edit_demographics',
    'patients:create',
    'visits:create',
    'visits:edit',
    'visits:sign',
    'notes:create',
    'notes:edit',
    'notes:sign',
    'orders:create',
    'orders:edit',
    'prescriptions:create',
    'prescriptions:edit',
    'meds:prescribe',
    'referrals:create',
    'referrals:edit',
    'schedule:edit',
    'schedule:status_update',
    'billing:view',
    'billing:create',
    'billing:edit',
    'patient_flags:create',
    'patient_flags:resolve',
    'notes:view',
    'audit:view'
  ];

  const nursePerms = [
    ...commonPerms,
    'patients:edit_demographics',
    'visits:create',
    'visits:edit',
    'notes:view',
    'orders:view',
    'schedule:view',
    'schedule:status_update',
    'audit:view'
  ];

  switch (role) {
    case 'ADMIN':
      return getAllAdminPermissions();
    case 'CLINICIAN':
      return clinicianPerms;
    case 'RESIDENT':
      // Residents can sign, but the logic will handle 'preliminary' state
      return clinicianPerms;
    case 'STUDENT':
      // Students cannot sign or prescribe
      return clinicianPerms.filter(p => !['notes:sign', 'visits:sign', 'meds:prescribe'].includes(p));
    case 'NURSE_MA':
      return nursePerms;
    case 'FRONT_DESK':
      return [...commonPerms, 'schedule:edit', 'schedule:status_update', 'patients:create'];
    default:
      return commonPerms;
  }
}

/**
 * Get all permissions for admin users
 */
function getAllAdminPermissions() {
  return [
    'patients:view_list', 'patients:view_chart', 'patients:view_demographics',
    'patients:edit_demographics', 'patients:edit_insurance', 'patients:create', 'patients:delete',
    'notes:view', 'notes:create', 'notes:edit', 'notes:sign', 'notes:delete',
    'visits:create', 'visits:edit', 'visits:sign', 'visits:delete',
    'orders:create', 'orders:edit', 'orders:delete', 'orders:view',
    'prescriptions:create', 'prescriptions:edit', 'prescriptions:view', 'prescriptions:delete', 'meds:prescribe',
    'referrals:create', 'referrals:edit', 'referrals:view', 'referrals:delete',
    'schedule:view', 'schedule:edit', 'schedule:status_update', 'schedule:assign_provider', 'schedule:delete',
    'users:manage', 'roles:manage', 'permissions:manage',
    'billing:view', 'billing:create', 'billing:edit', 'claims:submit',
    'reports:view', 'settings:edit', 'admin:access', 'audit:view',
    'patient_flags:create', 'patient_flags:resolve', 'patient_flags:manage_types'
  ];
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
  if (upper.includes('PHYSICIAN') || upper.includes('CLINICIAN') || upper === 'DOCTOR' || upper.includes('PRACTITIONER') || upper === 'NP' || upper === 'PA') {
    if (upper.includes('RESIDENT')) return 'RESIDENT';
    return 'CLINICIAN';
  }
  if (upper.includes('RESIDENT')) return 'RESIDENT';
  if (upper.includes('STUDENT')) return 'STUDENT';
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
      console.error(`[AUTH-DEBUG] Permission denied. User: ${req.user.email}, Role: ${req.user.role}, Required: ${permissionKey}, Has: ${JSON.stringify(req.user.permissions)}`);
      audit(req, 'permission_denied', 'authorization', null, false).catch(() => { });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        missing: permissionKey,
        required: permissionKey
      });
    }

    console.log(`[AUTH-DEBUG] Permission granted. User: ${req.user.email}, Required: ${permissionKey}`);

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
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, outcome, actor_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entityType, entityId || null, success ? 'success' : 'failure', ip, userAgent]
    );
  } catch (error) {
    // Silently fail audit logging - don't break the main request
    console.warn('Failed to log audit in authorization service:', error.message);
  }
}

module.exports = {
  getUserAuthContext,
  requirePermission,
  hasPermission,
  audit,
  normalizeRoleName
};

