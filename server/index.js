const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { apiLimiter, authLimiter, sanitizeInput, helmet } = require('./middleware/security');
const { enforceHTTPS, setHSTS, securityHeaders } = require('./middleware/https');
const { sessionTimeout } = require('./middleware/sessionTimeout');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const visitRoutes = require('./routes/visits');
const orderRoutes = require('./routes/orders');
const documentRoutes = require('./routes/documents');
const referralRoutes = require('./routes/referrals');
const messageRoutes = require('./routes/messages');
const labRoutes = require('./routes/labs');
const fhirRoutes = require('./routes/fhir');
const ordersetRoutes = require('./routes/ordersets');
const icd10HierarchyRoutes = require('./routes/icd10-hierarchy');
const { resolveTenant } = require('./middleware/tenant');

const app = express();
// Enable trust proxy for Caddy (reverse proxy) to pass correct IP steps
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const patientPhotosDir = path.join(uploadDir, 'patient-photos');
if (!fs.existsSync(patientPhotosDir)) {
  fs.mkdirSync(patientPhotosDir, { recursive: true });
}

// CORS must come FIRST - before any redirects or security middleware
// This allows preflight OPTIONS requests to work properly
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://pagemdemr.com',
  'https://www.pagemdemr.com',
  'https://admin.pagemdemr.com',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Create flexible regex check for subdomains if needed, or strict for now
      // For now, strict check + logging failure
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Portal', 'X-Clinic-Slug'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));


// Health check - must be before HTTPS enforcement to allow internal health checks
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HIPAA Security Middleware
// NOTE: HTTPS is terminated at Caddy in production, so the API itself only needs to speak HTTP.
// We disable internal HTTPS redirects here to avoid proxy loops and 502/503 errors.

// Security headers (HSTS, CSP, etc.)
app.use(setHSTS);
app.use(securityHeaders);

// Helmet for additional security
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://pagemdemr.com", "http://localhost:3000", "http://localhost:5173", "blob:"],
    },
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput);

// PHI Redaction middleware (must come before routes)
const { redactRequestForLogging, validateURLParams } = require('./middleware/phiRedaction');
app.use(redactRequestForLogging);
app.use(validateURLParams);

// Serve uploaded files statically with CORS headers
// Mount under both /api/uploads and /uploads for backward compatibility
const staticMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

const staticFiles = express.static(uploadDir, {
  setHeaders: (res, path) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
});

app.use('/api/uploads', staticMiddleware, staticFiles);
app.use('/uploads', staticMiddleware, staticFiles);

// Feature Flags
const PATIENT_PORTAL_ENABLED = process.env.PATIENT_PORTAL_ENABLED === 'true';
console.log(`[System] Patient Portal: ${PATIENT_PORTAL_ENABLED ? 'ENABLED' : 'DISABLED'}`);

// Multi-tenancy resolver - resolves clinic specific database
app.use('/api', resolveTenant);

// Session timeout middleware (for authenticated routes)
app.use('/api', sessionTimeout);

// Rate limiting - exclude certain endpoints from general rate limiting
// Apply rate limiting only in production (and not in localhost/development)
const isProduction = process.env.NODE_ENV === 'production' && process.env.DB_HOST !== 'localhost' && !process.env.DISABLE_RATE_LIMIT;
if (isProduction) {
  app.use('/api', (req, res, next) => {
    // Skip rate limiting for /auth/me in production
    if (req.path === '/auth/me') {
      return next();
    }
    return apiLimiter(req, res, next);
  });
} else {
  // Skip rate limiting entirely in development/localhost
  console.log('⚠️  Rate limiting disabled (development/localhost mode)');
}

// Mount Auth Routes separately to apply specific auth limiting
if (isProduction) {
  app.use('/api/auth', (req, res, next) => {
    if (req.path === '/me') {
      return next();
    }
    return authLimiter(req, res, next);
  }, authRoutes);
} else {
  app.use('/api/auth', authRoutes);
}

// Mount Core API Routes
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/labs', labRoutes);

app.use('/api/icd10-hierarchy', icd10HierarchyRoutes);
app.use('/api/ordersets', ordersetRoutes);
app.use('/api/orders-catalog', require('./routes/orders_catalog'));
const icd10Routes = require('./routes/icd10');
app.use('/api/icd10', icd10Routes);

// FHIR R4 API endpoints - OpenEMR style
app.use('/fhir', fhirRoutes);

// Code lookup endpoints
const codesRoutes = require('./routes/codes');
app.use('/api/codes', codesRoutes);

// E-Prescribing endpoints
const prescriptionRoutes = require('./routes/prescriptions');
const pharmacyRoutes = require('./routes/pharmacies');
const medicationRoutes = require('./routes/medications');
const eprescribeRoutes = require('./routes/eprescribe');
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/eprescribe', eprescribeRoutes);
app.use('/api/medications', medicationRoutes);

// Billing endpoints
const billingRoutes = require('./routes/billing');
const feeSheetRoutes = require('./routes/fee-sheet');
app.use('/api/billing', billingRoutes);
app.use('/api/fee-sheet', feeSheetRoutes);
app.use('/api/billing-openemr', require('./routes/billing-openemr'));
app.use('/api/claim-submissions', require('./routes/claim-submissions'));
app.use('/api/era', require('./routes/era'));

// User management endpoints
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Role and privilege management endpoints
const roleRoutes = require('./routes/roles');
app.use('/api/roles', roleRoutes);

// Settings and configuration endpoints
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);

// Reports and analytics
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);

// Fee Sheet Categories (OpenEMR-style quick code selection)
app.use('/api/fee-sheet-categories', require('./routes/fee-sheet-categories'));

// Super Admin (Platform Management)
app.use('/api/platform-auth', require('./routes/platformAuth'));
app.use('/api/super', require('./routes/superAdmin'));

// HL7 endpoints
const hl7Routes = require('./routes/hl7');
app.use('/api/hl7', hl7Routes);

// Insurance management
const insuranceRoutes = require('./routes/insurance');
app.use('/api/insurance', insuranceRoutes);
app.use('/api/eligibility', require('./routes/eligibility'));

// Clinical alerts
const alertsRoutes = require('./routes/alerts');
app.use('/api/alerts', alertsRoutes);

// Inbox
// Uses commercial-grade inbasket implementation (server/routes/inbasket.js)
const inboxRoutes = require('./routes/inbasket');
app.use('/api/inbox', inboxRoutes);

// Appointments
const appointmentRoutes = require('./routes/appointments');

// Cancellation Follow-ups
const followupsRoutes = require('./routes/followups');
app.use('/api/appointments', appointmentRoutes);
app.use('/api/followups', followupsRoutes);

// Patient Portal
const portalRoutes = require('./routes/portal');
app.use('/api/portal', portalRoutes);

// Digital Intake
const intakeRoutes = require('./routes/intake');
app.use('/api/intake', intakeRoutes);

// Support
app.use('/api/support', require('./routes/support'));

// Sales inquiries (public - no auth required)
app.use('/api/sales', require('./routes/sales'));

// Root endpoint - redirect to frontend or show API info
app.get('/', (req, res) => {
  res.json({
    message: 'Medical Health Record API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      patients: '/api/patients',
      visits: '/api/visits',
      docs: 'See README.md for API documentation'
    },
    frontend: process.env.FRONTEND_URL || 'http://localhost:5173'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Use safe logger to prevent PHI leakage
  const { safeLogger } = require('./middleware/phiRedaction');
  safeLogger.error('Unhandled error', {
    message: err.message,
    status: err.status,
    path: req.urlForLogging || req.url,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;



