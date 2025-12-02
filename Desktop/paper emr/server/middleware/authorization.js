/**
 * Authorization Middleware
 * 
 * Provides privilege-based access control
 */

const userService = require('../services/userService');

/**
 * Require specific privilege
 */
const requirePrivilege = (privilegeName) => {
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

      // Check if user has the required privilege
      const hasPrivilege = await userService.hasPrivilege(req.user.id, privilegeName);
      
      if (!hasPrivilege) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: privilegeName
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
 * Require admin role
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdmin = await userService.isAdmin(req.user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
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
  requireAnyPrivilege,
  requireAllPrivileges
};

