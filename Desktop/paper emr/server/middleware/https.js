/**
 * HTTPS Enforcement Middleware
 * 
 * HIPAA requires HTTPS/TLS 1.2+ for all endpoints
 * Enforces HTTPS redirect and HSTS headers
 */

/**
 * Enforce HTTPS - redirect HTTP to HTTPS
 */
const enforceHTTPS = (req, res, next) => {
  // Skip HTTPS enforcement for localhost in development
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname === '::1';
  if (isLocalhost) {
    return next(); // Always allow localhost (development)
  }
  
  // Skip OPTIONS requests (CORS preflight) - let CORS handle them
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  // Enforce HTTPS in all non-localhost environments (staging, test, production)
  
  // Check if request is already HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }
  
  // Redirect to HTTPS
  const httpsUrl = `https://${req.headers.host}${req.url}`;
  return res.redirect(301, httpsUrl);
};

/**
 * Set HSTS (HTTP Strict Transport Security) header
 * Tells browsers to only use HTTPS for this domain
 */
const setHSTS = (req, res, next) => {
  // Only in production
  if (process.env.NODE_ENV === 'production') {
    // HSTS with includeSubDomains and max-age of 1 year
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  next();
};

/**
 * Security headers for HIPAA compliance
 */
const securityHeaders = (req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';"
  );
  
  // X-Frame-Options (prevent clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options (prevent MIME sniffing)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );
  
  next();
};

module.exports = {
  enforceHTTPS,
  setHSTS,
  securityHeaders
};

