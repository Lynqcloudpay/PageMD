const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const { validatePassword } = require('../middleware/security');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Register (admin only in production)
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('role').isIn(['clinician', 'nurse', 'front_desk', 'admin']),
], async (req, res) => {
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
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    await logAudit(user.id, 'user_registered', 'user', user.id, {}, req.ip);

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get providers (clinicians)
router.get('/providers', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, role 
       FROM users 
       WHERE role IN ('clinician', 'admin') AND active = true 
       ORDER BY last_name, first_name`
    );
    res.json(result.rows.map(u => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      role: u.role
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

    // Development mode: Allow login without database
    const DEV_MODE = process.env.DEV_MODE === 'true';
    
    if (DEV_MODE && (email === 'doctor@clinic.com' || email === 'test@test.com')) {
      // Mock login for development
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
      result = await pool.query(
        'SELECT id, email, password_hash, first_name, last_name, role, active FROM users WHERE email = $1',
        [email]
      );
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.error('Login failed: Password mismatch for', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

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
        role: user.role,
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
  res.json({
    id: req.user.id,
    email: req.user.email,
    firstName: req.user.first_name,
    lastName: req.user.last_name,
    role: req.user.role,
  });
});

module.exports = router;



