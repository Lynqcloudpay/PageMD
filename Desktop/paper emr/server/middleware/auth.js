const jwt = require('jsonwebtoken');
const pool = require('../db');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].active) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // For now, allow all authenticated users (all roles have all privileges)
    // TODO: Implement proper role-based access control later
    // if (!roles.includes(req.user.role)) {
    //   return res.status(403).json({ error: 'Insufficient permissions' });
    // }
    next();
  };
};

const logAudit = async (userId, action, targetType, targetId, details = {}, ipAddress = null, userAgent = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, ip_address, details, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, targetType, targetId, ipAddress, JSON.stringify(details), userAgent]
    );
  } catch (error) {
    // Silently fail audit logging - don't break the main request
    console.warn('Failed to log audit:', error.message);
    console.error('Failed to log audit:', error);
  }
};

// Enhanced audit logging middleware
const auditLog = (action, targetType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
      // Log after response
      const targetId = req.params.id || req.body.id || null;
      logAudit(
        req.user?.id,
        action,
        targetType,
        targetId,
        { method: req.method, path: req.path, body: req.body },
        req.ip,
        req.get('user-agent')
      );
      return originalSend.call(this, data);
    };
    next();
  };
};

module.exports = { authenticate, requireRole, logAudit, auditLog };



