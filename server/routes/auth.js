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
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '24h' });

    await logAudit(user.id, 'user_registered', 'user', user.id, {}, req.ip);

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get providers (clinicians who can see patients) - only active physicians/NP/PA
// Patients can only be scheduled with physicians, PAs, or NPs - not administrators
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
         AND COALESCE(r.name, u.role) IN (
           'Physician', 
           'Nurse Practitioner', 
           'NP', 
           'Physician Assistant', 
           'PA', 
           'Clinician',
           'Doctor'
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
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[LOGIN] Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    console.log(`[LOGIN] Attempting login for: ${req.body.email}`);

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

      // In development, provide helpful error message
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({
          error: 'Database connection failed. PostgreSQL is not running.',
          hint: 'Set DEV_MODE=true in .env to use mock authentication, or start PostgreSQL',
          details: dbError.message
        });
      }

      return res.status(500).json({
        error: 'Database connection failed',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

    if (result.rows.length === 0) {
      console.log(`[LOGIN] User not found: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    console.log(`[LOGIN] User found: ${email}, status: ${user.status || 'active (null)'}`);

    // Allow NULL status as active (for backward compatibility)
    if (user.status && user.status !== 'active') {
      console.log(`[LOGIN] Account ${user.status} for ${email}`);
      return res.status(401).json({ error: `Account is ${user.status}. Please contact an administrator.` });
    }

    // Support both Argon2 (new users) and bcrypt (legacy/admin users) password hashes
    let valid = false;
    try {
      if (user.password_hash && user.password_hash.startsWith('$argon2')) {
        // Argon2 hash (users created via User Management)
        console.log(`[LOGIN] Verifying Argon2 password for ${email}`);
        valid = await passwordService.verifyPassword(user.password_hash, password);
        console.log(`[LOGIN] Argon2 verification result: ${valid}`);
      } else if (user.password_hash) {
        // bcrypt hash (legacy users or admin accounts)
        console.log(`[LOGIN] Verifying bcrypt password for ${email}`);
        valid = await bcrypt.compare(password, user.password_hash);
        console.log(`[LOGIN] bcrypt verification result: ${valid}`);
      } else {
        console.error(`[LOGIN] No password hash found for ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (verifyError) {
      console.error(`[LOGIN] Password verification error for ${email}:`, verifyError.message);
      return res.status(500).json({ error: 'Password verification failed. Please try again.' });
    }

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

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '24h' });

    try {
      await logAudit(user.id, 'user_login', 'user', user.id, {}, req.ip);
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError.message);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name,
        roleId: user.role_id,
        role_name: user.role_name, // Also include role_name for compatibility
        is_admin: user.is_admin || false, // Include is_admin flag for admin privileges
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

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role_name,
      roleId: user.role_id,
      role_name: user.role_name, // Also include role_name for compatibility
      status: user.status,
      is_admin: user.is_admin || false, // Include is_admin flag for admin privileges
      privileges: user.privileges || [],
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

module.exports = router;



