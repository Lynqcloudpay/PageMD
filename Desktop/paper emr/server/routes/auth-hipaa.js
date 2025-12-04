/**
 * HIPAA-Compliant Authentication Routes
 * 
 * Features:
 * - Argon2id password hashing
 * - 12+ character password policy
 * - MFA (TOTP) support
 * - Login rate limiting
 * - Session management
 * - Comprehensive audit logging
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const { validatePassword, authLimiter } = require('../middleware/security');
const { body, validationResult } = require('express-validator');
const passwordService = require('../services/passwordService');
const mfaService = require('../services/mfaService');
const sessionService = require('../services/sessionService');
const userService = require('../services/userService');
const { requirePrivilege } = require('../middleware/authorization');

const router = express.Router();

/**
 * Track login attempts for rate limiting
 */
const trackLoginAttempt = async (email, ipAddress, success, failureReason, userAgent) => {
  try {
    await pool.query(`
      INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `, [email, ipAddress, success, failureReason, userAgent]);
    
    // Clean up old attempts (older than 24 hours)
    await pool.query(`
      DELETE FROM login_attempts
      WHERE attempted_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);
  } catch (error) {
    console.error('Failed to track login attempt:', error);
  }
};

/**
 * Check if IP/email is rate limited
 */
const checkRateLimit = async (email, ipAddress) => {
  const windowMinutes = 15;
  const maxAttempts = 5;
  
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM login_attempts
    WHERE (
      (email = $1 OR ip_address = $2)
      AND success = false
      AND attempted_at > CURRENT_TIMESTAMP - INTERVAL '${windowMinutes} minutes'
    )
  `, [email, ipAddress]);
  
  const attemptCount = parseInt(result.rows[0]?.count || 0);
  return attemptCount < maxAttempts;
};

/**
 * POST /auth/login
 * HIPAA-compliant login with MFA support
 */
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('mfaToken').optional().isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, mfaToken } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // Check rate limiting
    const isAllowed = await checkRateLimit(email, ipAddress);
    if (!isAllowed) {
      await trackLoginAttempt(email, ipAddress, false, 'rate_limit_exceeded', userAgent);
      await logAudit(
        null,
        'login.rate_limit',
        'auth',
        null,
        { email },
        ipAddress,
        userAgent,
        'failure'
      );
      
      return res.status(429).json({
        error: 'Too many login attempts',
        message: 'Please try again in 15 minutes'
      });
    }

    // Get user
    const user = await userService.getUserByEmail(email);
    if (!user) {
      await trackLoginAttempt(email, ipAddress, false, 'user_not_found', userAgent);
      await logAudit(
        null,
        'login.failed',
        'auth',
        null,
        { email, reason: 'user_not_found' },
        ipAddress,
        userAgent,
        'failure'
      );
      
      // Don't reveal if user exists (security best practice)
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      await trackLoginAttempt(email, ipAddress, false, 'account_inactive', userAgent);
      await logAudit(
        user.id,
        'login.failed',
        'auth',
        user.id,
        { reason: 'account_inactive' },
        ipAddress,
        userAgent,
        'failure'
      );
      
      return res.status(401).json({ error: 'Account is inactive or suspended' });
    }

    // Verify password (support both Argon2id and bcrypt for migration)
    let passwordValid = false;
    if (user.password_hash.startsWith('$argon2id$')) {
      passwordValid = await passwordService.verifyPassword(user.password_hash, password);
      
      // Rehash if needed (upgrade from bcrypt)
      if (passwordValid && passwordService.needsRehash(user.password_hash)) {
        const newHash = await passwordService.hashPassword(password);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
      }
    } else {
      // Legacy bcrypt support (for migration)
      const bcrypt = require('bcryptjs');
      passwordValid = await bcrypt.compare(password, user.password_hash);
      
      // Upgrade to Argon2id on successful login
      if (passwordValid) {
        const newHash = await passwordService.hashPassword(password);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
      }
    }

    if (!passwordValid) {
      await trackLoginAttempt(email, ipAddress, false, 'invalid_password', userAgent);
      await logAudit(
        user.id,
        'login.failed',
        'auth',
        user.id,
        { reason: 'invalid_password' },
        ipAddress,
        userAgent,
        'failure'
      );
      
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if MFA is enabled
    const mfaEnabled = await mfaService.isMFAEnabled(user.id);
    
    if (mfaEnabled) {
      if (!mfaToken) {
        // MFA required but not provided
        await logAudit(
          user.id,
          'login.mfa_required',
          'auth',
          user.id,
          {},
          ipAddress,
          userAgent,
          'failure'
        );
        
        return res.status(200).json({
          mfaRequired: true,
          message: 'MFA token required'
        });
      }
      
      // Verify MFA token
      const mfaValid = await mfaService.verifyToken(user.id, mfaToken);
      if (!mfaValid) {
        await trackLoginAttempt(email, ipAddress, false, 'invalid_mfa_token', userAgent);
        await logAudit(
          user.id,
          'login.mfa_failed',
          'auth',
          user.id,
          {},
          ipAddress,
          userAgent,
          'failure'
        );
        
        return res.status(401).json({ error: 'Invalid MFA token' });
      }
    }

    // Create session
    const { sessionId, expiresAt } = await sessionService.createSession(
      user.id,
      ipAddress,
      userAgent
    );
    
    if (mfaEnabled) {
      await sessionService.markMFAVerified(sessionId);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        sessionId: sessionId
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Update last login
    await userService.updateLastLogin(user.id);

    // Track successful login
    await trackLoginAttempt(email, ipAddress, true, null, userAgent);
    
    // Log successful login
    await logAudit(
      user.id,
      'login.success',
      'auth',
      user.id,
      { mfaUsed: mfaEnabled },
      ipAddress,
      userAgent,
      'success',
      req.requestId || require('crypto').randomUUID(),
      sessionId
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name
      },
      token,
      sessionId,
      expiresAt,
      mfaEnabled
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /auth/register
 * Register new user (admin only in production)
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 12 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('roleId').isUUID().optional()
], authenticate, requirePrivilege('admin:manage_users'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, roleId } = req.body;

    // Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Password validation failed', 
        details: passwordErrors 
      });
    }

    // Check if user exists
    const existing = await userService.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user (service will hash password)
    const user = await userService.createUser({
      email,
      password, // Service will hash with Argon2id
      firstName,
      lastName,
      roleId: roleId || null
    });

    await logAudit(
      req.user.id,
      'user_registered',
      'user',
      user.id,
      { email, roleId },
      req.ip,
      req.get('user-agent'),
      'success'
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

/**
 * POST /auth/mfa/setup
 * Setup MFA for current user
 */
router.post('/mfa/setup', authenticate, async (req, res) => {
  try {
    const { secret, qrCode } = await mfaService.generateSecret(
      req.user.id,
      req.user.email
    );

    await logAudit(
      req.user.id,
      'mfa.setup_initiated',
      'user',
      req.user.id,
      {},
      req.ip,
      req.get('user-agent'),
      'success'
    );

    res.json({ secret, qrCode });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Failed to setup MFA' });
  }
});

/**
 * POST /auth/mfa/verify
 * Verify and enable MFA
 */
router.post('/mfa/verify', authenticate, [
  body('token').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;
    const isValid = await mfaService.verifyToken(req.user.id, token);

    if (!isValid) {
      await logAudit(
        req.user.id,
        'mfa.verify_failed',
        'user',
        req.user.id,
        {},
        req.ip,
        req.get('user-agent'),
        'failure'
      );
      
      return res.status(400).json({ error: 'Invalid MFA token' });
    }

    await mfaService.enableMFA(req.user.id);

    await logAudit(
      req.user.id,
      'mfa.enabled',
      'user',
      req.user.id,
      {},
      req.ip,
      req.get('user-agent'),
      'success'
    );

    res.json({ message: 'MFA enabled successfully' });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ error: 'Failed to verify MFA' });
  }
});

/**
 * POST /auth/mfa/disable
 * Disable MFA (requires MFA verification)
 */
router.post('/mfa/disable', authenticate, [
  body('token').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;
    const isValid = await mfaService.verifyToken(req.user.id, token);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid MFA token' });
    }

    await mfaService.disableMFA(req.user.id);

    await logAudit(
      req.user.id,
      'mfa.disabled',
      'user',
      req.user.id,
      {},
      req.ip,
      req.get('user-agent'),
      'success'
    );

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

/**
 * POST /auth/logout
 * Logout and invalidate session
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.sessionId;
    
    if (sessionId) {
      await sessionService.destroySession(sessionId);
    }

    await logAudit(
      req.user.id,
      'logout',
      'auth',
      req.user.id,
      {},
      req.ip,
      req.get('user-agent'),
      'success'
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;

