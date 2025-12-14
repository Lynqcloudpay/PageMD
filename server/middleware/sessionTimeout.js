/**
 * Session Timeout Middleware
 * 
 * HIPAA-compliant session management:
 * - 15 minute inactivity timeout
 * - 12 hour absolute timeout
 * - Server-side session invalidation
 */

const sessionService = require('../services/sessionService');
const { logAudit } = require('./auth');

/**
 * Session timeout middleware
 * Checks inactivity and absolute timeouts
 */
const sessionTimeout = async (req, res, next) => {
  // Skip if no session
  if (!req.sessionId && !req.headers['x-session-id']) {
    return next();
  }
  
  const sessionId = req.sessionId || req.headers['x-session-id'];
  const session = await sessionService.getSession(sessionId);
  
  if (!session) {
    // Session expired or invalid
    await logAudit(
      null,
      'session.expired',
      'session',
      sessionId,
      { path: req.path },
      req.ip,
      req.get('user-agent'),
      'failure'
    );
    
    return res.status(401).json({
      error: 'Session expired',
      message: 'Your session has expired due to inactivity. Please log in again.'
    });
  }
  
  // Update activity timestamp
  await sessionService.updateActivity(sessionId);
  
  // Attach session to request
  req.session = session;
  req.sessionId = sessionId;
  
  next();
};

/**
 * Require MFA verification for sensitive operations
 */
const requireMFA = async (req, res, next) => {
  if (!req.session || !req.sessionId) {
    return res.status(401).json({ error: 'Session required' });
  }
  
  if (!req.session.mfaVerified) {
    return res.status(403).json({
      error: 'MFA required',
      message: 'Multi-factor authentication is required for this operation'
    });
  }
  
  next();
};

module.exports = {
  sessionTimeout,
  requireMFA
};





