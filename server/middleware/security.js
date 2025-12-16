const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');

// Rate limiting - OpenEMR style
const isDevelopment = process.env.NODE_ENV !== 'production';
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 100000 : 200, // Increased from 100 to 200 in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for certain endpoints in development
  skip: (req) => {
    if (isDevelopment) {
      // Skip rate limiting for all API endpoints in development
      const skipPaths = [
        '/api/auth/me',
        '/api/patients',
        '/api/appointments',
        '/api/visits',
        '/api/messages',
        '/api/auth/providers',
        '/api/users',
        '/api/roles'
      ];
      return skipPaths.some(path => req.path.startsWith(path));
    }
    return false;
  },
});

// More lenient rate limiting for development
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: isDevelopment ? 10000 : 10, // Increased from 5 to 10 in production to prevent legitimate lockouts
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for /me endpoint (called on every page load)
  skip: (req) => req.path === '/me' || req.path === '/api/auth/me',
});

// Input sanitization - OpenEMR style
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return validator.escape(validator.trim(obj));
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }
  next();
};

// HIPAA-compliant password policy validation
// Minimum 12 characters, uppercase, lowercase, digit, symbol
const validatePassword = (password) => {
  const errors = [];
  
  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\;',./]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password', 'password123', 'admin', '12345678', 'qwerty'];
  if (commonPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password is too common or weak');
  }
  
  return errors;
};

// Session timeout middleware
const sessionTimeout = (maxAge = 30 * 60 * 1000) => { // 30 minutes default
  return (req, res, next) => {
    if (req.user && req.user.lastActivity) {
      const now = Date.now();
      const lastActivity = new Date(req.user.lastActivity).getTime();
      
      if (now - lastActivity > maxAge) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }
    }
    next();
  };
};

module.exports = {
  apiLimiter,
  authLimiter,
  sanitizeInput,
  validatePassword,
  sessionTimeout,
  helmet,
};

