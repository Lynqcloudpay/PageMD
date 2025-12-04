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
      const user = await userService.getUserById(req.user.id);
      if (user && (user.role_name === 'SuperAdmin' || user.role_name === 'Admin' || user.is_admin === true)) {
        return next();
      }

      // Check if user has the required privilege (deny-by-default)
      const hasPrivilege = await userService.hasPrivilege(req.user.id, privilegeName);
      
      if (!hasPrivilege) {
        // Log unauthorized access attempt
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


