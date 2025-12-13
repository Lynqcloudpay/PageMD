/**
 * HTTPS Enforcement Middleware
 * 
 * HIPAA requires HTTPS/TLS 1.2+ for all endpoints
 * Enforces HTTPS redirect and HSTS headers
 */

/**
 * Enforce HTTPS - redirect HTTP to HTTPS
 * Works behind reverse proxy (Caddy/Nginx) using X-Forwarded-Proto header
 */
const enforceHTTPS = (req, res, next) => {
  // Skip HTTPS enforcement if FORCE_HTTPS is not enabled
  if (process.env.FORCE_HTTPS !== 'true') {
    return next();
  }

  // Skip HTTPS enforcement for health check endpoint (internal monitoring)
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }

  // Skip HTTPS enforcement for localhost in development
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname === '::1';
  if (isLocalhost && process.env.NODE_ENV !== 'production') {
    return next(); // Always allow localhost (development)
  }

  // Skip OPTIONS requests (CORS preflight) - let CORS handle them
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Check if request is already HTTPS
  // Works behind reverse proxy: check x-forwarded-proto header
  const isSecure = req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    req.headers['x-forwarded-proto'] === 'https,'; // Some proxies add comma

  if (isSecure) {
    return next();
  }

  // In production, redirect to HTTPS
  // Use X-Forwarded-Host if available (from reverse proxy), otherwise use Host
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const httpsUrl = `https://${host}${req.originalUrl || req.url}`;
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
  const connectSrc = ["'self'", process.env.FRONTEND_URL].filter(Boolean).join(' ');
  const imgSrc = ["'self'", "data:", "blob:", process.env.FRONTEND_URL].filter(Boolean).join(' ');

  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src ${imgSrc}; font-src 'self' data:; connect-src ${connectSrc};`
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

