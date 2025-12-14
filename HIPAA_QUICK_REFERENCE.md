# HIPAA Security Quick Reference

Quick reference for developers working with HIPAA-compliant features.

## Authentication & Authorization

### Protect a Route

```javascript
const { authenticate } = require('../middleware/auth');
const { requirePrivilege } = require('../middleware/authorization');

router.get('/patients/:id', 
  authenticate,                    // Must be logged in
  requirePrivilege('patient:view'), // Must have permission
  async (req, res) => {
    // Handler
  }
);
```

### Check Permissions in Code

```javascript
const userService = require('../services/userService');

const hasPermission = await userService.hasPrivilege(userId, 'patient:edit');
if (!hasPermission) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

### Log Audit Events

```javascript
const { logAudit } = require('../middleware/auth');

await logAudit(
  req.user.id,           // Actor user ID
  'patient.viewed',      // Action
  'patient',             // Target type
  patientId,             // Target ID
  { /* metadata */ },     // Details (will be redacted)
  req.ip,                // IP address
  req.get('user-agent'), // User agent
  'success',             // Outcome
  req.requestId,         // Request ID
  req.sessionId          // Session ID
);
```

## Password & MFA

### Hash Password

```javascript
const passwordService = require('../services/passwordService');

const hash = await passwordService.hashPassword('SecurePass123!');
```

### Verify Password

```javascript
const isValid = await passwordService.verifyPassword(hash, password);
```

### Setup MFA

```javascript
const mfaService = require('../services/mfaService');

// Generate secret and QR code
const { secret, qrCode } = await mfaService.generateSecret(userId, email);

// Verify token
const isValid = await mfaService.verifyToken(userId, token);

// Enable MFA
await mfaService.enableMFA(userId);
```

## Encryption

### Encrypt Field

```javascript
const encryptionService = require('../services/encryptionService');

// Encrypt to base64 (for database storage)
const { ciphertext, metadata } = await encryptionService.encryptFieldToBase64(ssn);

// Store in database
await pool.query(
  'UPDATE patients SET ssn_encrypted = $1, encryption_metadata = $2 WHERE id = $3',
  [ciphertext, metadata, patientId]
);
```

### Decrypt Field

```javascript
// Retrieve from database
const result = await pool.query(
  'SELECT ssn_encrypted, encryption_metadata FROM patients WHERE id = $1',
  [patientId]
);

// Decrypt
const ssn = await encryptionService.decryptFieldFromBase64(
  result.rows[0].ssn_encrypted,
  result.rows[0].encryption_metadata
);
```

## Sessions

### Create Session

```javascript
const sessionService = require('../services/sessionService');

const { sessionId, expiresAt } = await sessionService.createSession(
  userId,
  req.ip,
  req.get('user-agent')
);
```

### Check Session

```javascript
const session = await sessionService.getSession(sessionId);
if (!session) {
  // Session expired
}
```

### Update Activity

```javascript
await sessionService.updateActivity(sessionId);
```

## PHI Redaction

### Redact PHI from Object

```javascript
const { redactPHI } = require('../middleware/phiRedaction');

const safeData = redactPHI(patientData);
// Use safeData for logging
```

### Use Safe Logger

```javascript
const { safeLogger } = require('../middleware/phiRedaction');

safeLogger.info('Patient accessed', patientData); // PHI automatically redacted
```

### Redact Request for Logging

```javascript
const { redactRequestForLogging } = require('../middleware/phiRedaction');

app.use(redactRequestForLogging);

// In handler, use redacted versions:
console.log(req.bodyForLogging);  // PHI redacted
console.log(req.queryForLogging); // PHI redacted
```

## Common Patterns

### Patient Route with Permissions

```javascript
router.get('/patients/:id', 
  authenticate,
  requirePrivilege('patient:view'),
  async (req, res) => {
    const patient = await getPatient(req.params.id);
    
    // Log access
    await logAudit(
      req.user.id,
      'patient.viewed',
      'patient',
      req.params.id,
      {},
      req.ip,
      req.get('user-agent'),
      'success',
      req.requestId,
      req.sessionId
    );
    
    res.json(patient);
  }
);
```

### Create with Encryption

```javascript
router.post('/patients',
  authenticate,
  requirePrivilege('patient:create'),
  async (req, res) => {
    const { ssn, mrn, ...otherData } = req.body;
    
    // Encrypt sensitive fields
    const ssnEncrypted = await encryptionService.encryptFieldToBase64(ssn);
    const mrnEncrypted = await encryptionService.encryptFieldToBase64(mrn);
    
    // Store
    const result = await pool.query(`
      INSERT INTO patients (..., ssn_encrypted, mrn_encrypted, encryption_metadata)
      VALUES (..., $1, $2, $3)
      RETURNING *
    `, [ssnEncrypted.ciphertext, mrnEncrypted.ciphertext, ssnEncrypted.metadata]);
    
    // Log
    await logAudit(req.user.id, 'patient.created', 'patient', result.rows[0].id, {}, req.ip);
    
    res.json(result.rows[0]);
  }
);
```

## Environment Variables

Required for HIPAA features:

```env
# Security
JWT_SECRET=...
NODE_ENV=production

# Redis
REDIS_URL=redis://localhost:6379

# KMS
KMS_PROVIDER=aws|gcp|azure|local
AWS_KMS_KEY_ID=...
# or GCP/Azure config

# Backup
BACKUP_DIR=./backups
BACKUP_ENCRYPTION_KEY=...
```

## Testing

### Test Permission Check

```javascript
const { requirePrivilege } = require('../middleware/authorization');

// Mock user without permission
req.user = { id: 'user-id' };
// Should return 403
```

### Test Audit Logging

```javascript
// Check audit log was created
const logs = await pool.query(
  'SELECT * FROM audit_logs WHERE actor_user_id = $1 AND action = $2',
  [userId, 'patient.viewed']
);
expect(logs.rows.length).toBe(1);
```

## Troubleshooting

### Session Expired Errors
- Check Redis is running
- Verify session timeout settings
- Check session ID is being sent in headers

### Permission Denied
- Verify user has role assigned
- Check role has privilege in `role_privileges` table
- Ensure `requirePrivilege` middleware is applied

### Encryption Errors
- Verify KMS is configured correctly
- Check encryption key exists in database
- Ensure KMS credentials are valid

### MFA Not Working
- Verify TOTP secret is stored correctly
- Check token is within time window
- Ensure MFA is enabled for user





