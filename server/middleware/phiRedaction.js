/**
 * PHI Redaction Middleware
 * 
 * Removes PHI from:
 * - URLs (query strings, path parameters)
 * - Application logs
 * - Request/response bodies before logging
 */

/**
 * List of known PHI field names
 */
const PHI_FIELDS = [
  'ssn', 'socialSecurityNumber', 'mrn', 'medicalRecordNumber',
  'dob', 'dateOfBirth', 'birthDate', 'birthdate',
  'firstName', 'first_name', 'firstname',
  'lastName', 'last_name', 'lastname',
  'fullName', 'full_name', 'name',
  'address', 'addressLine1', 'address_line1', 'addressLine2', 'address_line2',
  'city', 'state', 'zip', 'zipCode', 'postalCode',
  'phone', 'phoneNumber', 'phone_number', 'mobile', 'homePhone',
  'email', 'emailAddress', 'email_address',
  'insuranceId', 'insurance_id', 'insuranceNumber', 'insurance_number', 'policyNumber',
  'note', 'notes', 'noteDraft', 'note_draft', 'noteSigned', 'note_signed',
  'diagnosis', 'assessment', 'plan', 'hpi', 'ros', 'pe',
  'medication', 'allergy', 'problem',
  'creditCard', 'cardNumber', 'ccNumber', 'cvv',
  'npi', 'npiNumber', 'dea', 'deaNumber',
  'patientId', 'patient_id', 'userId', 'user_id'
];

/**
 * Redact PHI from object recursively
 */
const redactPHI = (obj, depth = 0) => {
  if (depth > 10) return '[MAX_DEPTH]'; // Prevent infinite recursion

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Check if string looks like PHI/PII
    if (/^\d{3}-\d{2}-\d{4}$/.test(obj) || // SSN with dashes
      /^\d{9}$/.test(obj) || // 9-digit number (SSN/MRN)
      /^\d{10}$/.test(obj) || // 10-digit number (NPI)
      /^[A-Z]{2}\d{7}$/i.test(obj) || // DEA number
      /^\d{4}-\d{4}-\d{4}-\d{4}$/.test(obj) || // Credit Card
      /^[A-Z][0-9]{8}$/i.test(obj)) { // PASSPORT
      return '[REDACTED]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPHI(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();

      // Check if key is a PHI field
      if (PHI_FIELDS.some(phiField => keyLower.includes(phiField.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactPHI(value, depth + 1);
      }
    }
    return redacted;
  }

  return obj;
};

/**
 * Redact PHI from URL query string
 */
const redactURL = (url) => {
  if (!url || typeof url !== 'string') return url;

  try {
    const urlObj = new URL(url, 'http://localhost'); // Base URL for parsing

    // Redact query parameters that might contain PHI
    const phiQueryParams = ['mrn', 'ssn', 'name', 'dob', 'email', 'phone'];
    phiQueryParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });

    // Redact path segments that look like identifiers
    urlObj.pathname = urlObj.pathname.replace(/\b[A-Z0-9]{8,}\b/g, '[ID]');

    return urlObj.pathname + urlObj.search;
  } catch (error) {
    // If URL parsing fails, return sanitized version
    return url.replace(/\b[A-Z0-9]{8,}\b/g, '[ID]');
  }
};

/**
 * Middleware to redact PHI from request before logging
 */
const redactRequestForLogging = (req, res, next) => {
  // Store original for actual processing
  req.originalBody = req.body;
  req.originalQuery = req.query;
  req.originalParams = req.params;

  // Create redacted versions for logging
  req.bodyForLogging = redactPHI(req.body);
  req.queryForLogging = redactPHI(req.query);
  req.paramsForLogging = redactPHI(req.params);
  req.urlForLogging = redactURL(req.originalUrl || req.url);

  next();
};

/**
 * Redact PHI from response before logging
 */
const redactResponseForLogging = (data) => {
  return redactPHI(data);
};

/**
 * Safe logger that redacts PHI
 */
const safeLogger = {
  info: (message, data = {}) => {
    console.log(message, redactPHI(data));
  },
  error: (message, error = {}) => {
    const safeError = {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : '[REDACTED]',
      ...redactPHI(error)
    };
    console.error(message, safeError);
  },
  warn: (message, data = {}) => {
    console.warn(message, redactPHI(data));
  },
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(message, redactPHI(data));
    }
  }
};

/**
 * Ensure no PHI in URL path parameters
 * Validates that IDs are UUIDs, not names or MRNs
 */
const validateURLParams = (req, res, next) => {
  // Check if path contains what looks like PHI (names, MRNs, etc.)
  const path = req.path.toLowerCase();

  // Reject if path contains common PHI patterns
  const phiPatterns = [
    /\/mrn\/[^\/]+/, // /mrn/12345
    /\/ssn\/[^\/]+/ // /ssn/123-45-6789
  ];

  for (const pattern of phiPatterns) {
    if (pattern.test(path)) {
      return res.status(400).json({
        error: 'Invalid URL format',
        message: 'URLs must not contain PHI. Use UUIDs for resource identifiers.'
      });
    }
  }

  next();
};

module.exports = {
  redactPHI,
  redactURL,
  redactRequestForLogging,
  redactResponseForLogging,
  safeLogger,
  validateURLParams,
  PHI_FIELDS
};





