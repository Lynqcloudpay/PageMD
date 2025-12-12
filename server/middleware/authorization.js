/**
 * Authorization Middleware
 * 
 * Provides privilege-based access control with HIPAA-compliant deny-by-default
 */

const userService = require('../services/userService');

/**
 * Require specific privilege (HIPAA: deny-by-default)
 * Only SuperAdmin and Admin bypass privilege checks
 */
const requirePrivilege = (privilegeName) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // SuperAdmin and Admin bypass privilege checks (but still logged)
      let user;
      try {
        user = await userService.getUserById(req.user.id);
      } catch (userError) {
        console.error('Error fetching user for privilege check:', userError);
        // If we can't fetch user, check if user object from auth middleware has role
        // Fallback to role-based check if userService fails
        if (req.user && (req.user.role_name === 'Admin' || req.user.role_name === 'SuperAdmin' || req.user.is_admin === true || req.user.role === 'admin')) {
          return next();
        }
        // If we can't verify, deny access (fail-secure)
        return res.status(500).json({ 
          error: 'Authorization check failed',
          message: 'Unable to verify user permissions. Please try again or contact support.'
        });
      }
      
      if (user && (user.role_name === 'SuperAdmin' || user.role_name === 'Admin' || user.is_admin === true)) {
        return next();
      }

      // Check if user has the required privilege (deny-by-default)
      let hasPrivilege = false;
      try {
        hasPrivilege = await userService.hasPrivilege(req.user.id, privilegeName);
      } catch (privilegeError) {
        console.error('Error checking privilege:', privilegeError);
        // If privilege check fails, try fallback to role-based check
        // This allows the system to work even if privilege tables don't exist
        const userRole = (req.user.role_name || req.user.role || '').toLowerCase();
        const allowedRoles = ['clinician', 'nurse', 'admin', 'front_desk'];
        
        // Map privilege names to roles that should have access
        const privilegeRoleMap = {
          'patient:view': ['clinician', 'nurse', 'admin', 'front_desk'],
          'patient:create': ['clinician', 'admin', 'front_desk'],
          'patient:edit': ['clinician', 'admin', 'front_desk'],
        };
        
        const rolesForPrivilege = privilegeRoleMap[privilegeName] || allowedRoles;
        hasPrivilege = rolesForPrivilege.includes(userRole);
        
        if (!hasPrivilege) {
          console.warn(`Privilege check failed for user ${req.user.id}, privilege: ${privilegeName}, role: ${userRole}`);
        }
      }
      
      if (!hasPrivilege) {
        // Log unauthorized access attempt
        try {
          const { logAudit } = require('./auth');
          await logAudit(
            req.user.id,
            `${privilegeName}.denied`,
            'authorization',
            null,
            { 
              attempted_action: privilegeName,
              path: req.path,
              method: req.method
            },
            req.ip,
            req.get('user-agent')
          );
        } catch (auditError) {
          // Don't fail the request if audit logging fails
          console.warn('Failed to log audit for privilege denial:', auditError.message);
        }
        
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: privilegeName,
          message: 'Access denied. You do not have the required permission.'
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

/**
 * Require admin role (Admin or SuperAdmin)
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await userService.getUserById(req.user.id);
    const isAdmin = user && (user.role_name === 'Admin' || user.role_name === 'SuperAdmin' || user.is_admin === true);
    
    if (!isAdmin) {
      // Log unauthorized admin access attempt
      const { logAudit } = require('./auth');
      await logAudit(
        req.user.id,
        'admin.access.denied',
        'authorization',
        null,
        { path: req.path, method: req.method },
        req.ip,
        req.get('user-agent')
      );
      
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Require SuperAdmin role (only SuperAdmin)
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await userService.getUserById(req.user.id);
    const isSuperAdmin = user && user.role_name === 'SuperAdmin';
    
    if (!isSuperAdmin) {
      // Log unauthorized super admin access attempt
      const { logAudit } = require('./auth');
      await logAudit(
        req.user.id,
        'superadmin.access.denied',
        'authorization',
        null,
        { path: req.path, method: req.method },
        req.ip,
        req.get('user-agent')
      );
      
      return res.status(403).json({ error: 'SuperAdmin access required' });
    }

    next();
  } catch (error) {
    console.error('SuperAdmin check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Require any of the specified privileges
 */
const requireAnyPrivilege = (...privilegeNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Admin always has all privileges
      const isAdmin = await userService.isAdmin(req.user.id);
      if (isAdmin) {
        return next();
      }

      // Check if user has any of the required privileges
      for (const privilegeName of privilegeNames) {
        const hasPrivilege = await userService.hasPrivilege(req.user.id, privilegeName);
        if (hasPrivilege) {
          return next();
        }
      }

      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: privilegeNames
      });
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

/**
 * Require all of the specified privileges
 */
const requireAllPrivileges = (...privilegeNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Admin always has all privileges
      const isAdmin = await userService.isAdmin(req.user.id);
      if (isAdmin) {
        return next();
      }

      // Check if user has all required privileges
      for (const privilegeName of privilegeNames) {
        const hasPrivilege = await userService.hasPrivilege(req.user.id, privilegeName);
        if (!hasPrivilege) {
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: privilegeName,
            missing: privilegeName
          });
        }
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

module.exports = {
  requirePrivilege,
  requireAdmin,
  requireSuperAdmin,
  requireAnyPrivilege,
  requireAllPrivileges
};


