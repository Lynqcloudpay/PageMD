const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorization');
const { validatePassword } = require('../middleware/security');
const { body, validationResult } = require('express-validator');
const passwordService = require('../services/passwordService');

const router = express.Router();

// Register (admin only in production)
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('role').isIn(['clinician', 'nurse', 'front_desk', 'admin']),
], process.env.NODE_ENV === 'production' ? requireAdmin : (req, res, next) => next(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, role } = req.body;

    // Validate password strength - OpenEMR style
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password validation failed', details: passwordErrors });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Enhanced password hashing - OpenEMR style (higher rounds for security)
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName, role]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, clinicSlug: req.clinic?.slug || 'default' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit(user.id, 'user_registered', 'user', user.id, {}, req.ip);

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get providers (clinicians who can see patients) - only active physicians/NP/PA
router.get('/providers', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, 
              COALESCE(r.name, u.role) as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE (u.status IS NULL OR u.status = 'active')
         AND (u.status IS DISTINCT FROM 'suspended')
         AND (u.active IS NULL OR u.active = true)
         AND UPPER(COALESCE(r.name, u.role)) IN (
           'PHYSICIAN', 
           'NURSE PRACTITIONER', 
           'NP', 
           'PHYSICIAN ASSISTANT', 
           'PA', 
           'CLINICIAN',
           'DOCTOR',
           'PROVIDER'
         )
       ORDER BY u.last_name, u.first_name`
    );
    res.json(result.rows.map(u => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      role: u.role_name
    })));
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Development mode: Allow login without database (DISABLED FOR PRODUCTION)
    // Set DEV_MODE=true in .env ONLY for local development
    // Explicitly prevent DEV_MODE in production
    if (process.env.NODE_ENV === 'production' && process.env.DEV_MODE === 'true') {
      throw new Error('DEV_MODE is not allowed in production. This is a security violation.');
    }

    const DEV_MODE = process.env.DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';

    if (DEV_MODE && (email === 'doctor@clinic.com' || email === 'test@test.com')) {
      // Mock login for development (only in non-production environments)
      const mockUser = {
        id: 1,
        email: email,
        firstName: 'Dr.',
        lastName: 'Rodriguez',
        role: 'clinician'
      };

      const token = jwt.sign({ userId: mockUser.id }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '24h' });

      console.log('⚠️  DEV MODE: Mock login successful (no database required)');

      return res.json({
        user: mockUser,
        token,
      });
    }

    console.log('[Auth] Login request for:', email);
    let result;
    try {
      result = await pool.query(`
        SELECT 
          u.id, u.email, u.password_hash, u.first_name, u.last_name, 
          u.status, u.role_id,
          r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.email = $1
      `, [email]);
    } catch (dbError) {
      console.error('Database query error:', dbError);
      throw dbError; // throw to catch block at end
    }

    if (result.rows.length === 0) {
      console.log('[Auth] User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    console.log('[Auth] User found:', user.email, 'Hash start:', user.password_hash.substring(0, 10));

    if (user.status && user.status !== 'active') {
      return res.status(401).json({ error: `Account is ${user.status}` });
    }

    // Support both Argon2 (new users) and bcrypt (legacy/admin users) password hashes
    let valid = false;
    try {
      if (user.password_hash.startsWith('$argon2')) {
        // Argon2 hash (users created via User Management)
        console.log('[Auth] Verifying Argon2 hash');
        valid = await passwordService.verifyPassword(user.password_hash, password);
      } else {
        // bcrypt hash (legacy users or admin accounts)
        console.log('[Auth] Verifying bcrypt hash');
        valid = await bcrypt.compare(password, user.password_hash);
      }
    } catch (verifyError) {
      console.error('[Auth] Verification threw:', verifyError);
      throw verifyError;
    }

    console.log('[Auth] Password valid:', valid);

    if (!valid) {
      console.error('Login failed: Password mismatch for', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    try {
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    } catch (updateError) {
      console.warn('Failed to update last login:', updateError.message);
    }

    const token = jwt.sign(
      { userId: user.id, clinicSlug: req.clinic?.slug || 'default' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    try {
      await logAudit(user.id, 'user_login', 'user', user.id, {}, req.ip);
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError.message);
    }

    // Get is_admin flag directly from the user query result
    const isAdmin = user.is_admin === true || user.is_admin === 'true' || String(user.is_admin) === 'true';

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name,
        role_name: user.role_name, // Include both for consistency
        roleId: user.role_id,
        isAdmin: isAdmin,
        is_admin: isAdmin, // Include both formats
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const userService = require('../services/userService');
    const user = await userService.getUserById(req.user.id, true);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user with permissions and scope from auth context
    // Prioritize fresh database role_name over cached JWT role
    const displayRole = user.role_name || req.user.role_name || req.user.role || 'User';
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: displayRole, // Original role name for display
      role_name: displayRole, // Also include role_name for consistency
      roleId: user.role_id,
      status: user.status,
      privileges: user.privileges || [],
      // Add permissions and scope from auth context
      permissions: req.user.permissions || [],
      scope: req.user.scope || { scheduleScope: 'CLINIC', patientScope: 'CLINIC' },
      isAdmin: user.is_admin || req.user.isAdmin || req.user.is_admin || false,
      is_admin: user.is_admin || req.user.is_admin || false // Include both formats
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

// Platform Admin Impersonation ("Break Glass")
router.get('/impersonate', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Impersonation token required' });
  }

  try {
    // 1. Validate token against Control DB
    const tokenRes = await pool.controlPool.query(`
      SELECT pit.*, c.slug, c.schema_name
      FROM platform_impersonation_tokens pit
      JOIN clinics c ON pit.target_clinic_id = c.id
      WHERE pit.token = $1 AND pit.expires_at > NOW()
    `, [token]);

    if (tokenRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired impersonation token' });
    }

    const { target_user_id, schema_name, target_clinic_id } = tokenRes.rows[0];

    // 2. Fetch user data from the target clinic schema
    // Note: We use pool.controlPool.query with schema prefix for safety
    const userRes = await pool.controlPool.query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role_id,
        r.name as role_name
      FROM ${schema_name}.users u
      LEFT JOIN ${schema_name}.roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [target_user_id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Target user not found in clinic' });
    }

    const user = userRes.rows[0];

    // 3. Generate JWT
    const jwtToken = jwt.sign(
      {
        userId: user.id,
        clinicSlug: tokenRes.rows[0].slug,
        isImpersonation: true,
        impersonatorAdminId: tokenRes.rows[0].admin_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Shorter duration for impersonation sessions
    );

    // 4. Log the access in tenant audit log
    await logAudit(user.id, 'admin_impersonation_login', 'user', user.id, {
      impersonator: tokenRes.rows[0].admin_id,
      reason: tokenRes.rows[0].reason
    }, req.ip);

    // 5. Delete the one-time token
    await pool.controlPool.query('DELETE FROM platform_impersonation_tokens WHERE id = $1', [tokenRes.rows[0].id]);

    // 6. Return standard login payload
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name,
        isImpersonation: true
      },
      token: jwtToken,
      redirectUrl: '/dashboard'
    });
  } catch (error) {
    console.error('Impersonation failed:', error);
    res.status(500).json({ error: 'Internal server error during impersonation' });
  }
});

module.exports = router;



