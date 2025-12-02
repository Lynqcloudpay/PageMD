const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { apiLimiter, authLimiter, sanitizeInput, helmet } = require('./middleware/security');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const visitRoutes = require('./routes/visits');
const orderRoutes = require('./routes/orders');
const documentRoutes = require('./routes/documents');
const referralRoutes = require('./routes/referrals');
const messageRoutes = require('./routes/messages');
const labRoutes = require('./routes/labs');
const fhirRoutes = require('./routes/fhir');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - OpenEMR style
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:3000", "http://localhost:5173", "blob:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput);

// Rate limiting - exclude certain endpoints from general rate limiting
app.use('/api', (req, res, next) => {
  // Skip rate limiting for /auth/me and other common endpoints in development
  if (process.env.NODE_ENV !== 'production') {
    const skipPaths = ['/auth/me', '/patients', '/inbox'];
    if (skipPaths.some(path => req.path.includes(path))) {
      return next();
    }
  } else if (req.path === '/auth/me') {
    return next(); // Skip rate limiting for /auth/me in production too
  }
  return apiLimiter(req, res, next);
});

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

// Serve uploaded files statically with CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadDir, {
  setHeaders: (res, path) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Routes
// Apply rate limiting only to login/register, not to /me endpoint
app.use('/api/auth', (req, res, next) => {
  if (req.path === '/me') {
    return next(); // Skip rate limiting for /me endpoint
  }
  return authLimiter(req, res, next);
}, authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/labs', labRoutes);

// FHIR R4 API endpoints - OpenEMR style
app.use('/fhir', fhirRoutes);

// Code lookup endpoints
const codesRoutes = require('./routes/codes');
app.use('/api/codes', codesRoutes);

// Billing endpoints
const billingRoutes = require('./routes/billing');
app.use('/api/billing', billingRoutes);

// Reports and analytics
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);

// HL7 endpoints
const hl7Routes = require('./routes/hl7');
app.use('/api/hl7', hl7Routes);

// Insurance management
const insuranceRoutes = require('./routes/insurance');
app.use('/api/insurance', insuranceRoutes);

// Clinical alerts
const alertsRoutes = require('./routes/alerts');
app.use('/api/alerts', alertsRoutes);

// Inbox
const inboxRoutes = require('./routes/inbox');
app.use('/api/inbox', inboxRoutes);

// Appointments
const appointmentRoutes = require('./routes/appointments');
app.use('/api/appointments', appointmentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint - redirect to frontend or show API info
app.get('/', (req, res) => {
  res.json({ 
    message: 'PageMD API Server',
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
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});



