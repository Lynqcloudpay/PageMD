/**
 * User Management Routes
 * 
 * CRUD operations for user management
 * Requires admin privileges for most operations
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, logAudit } = require('../middleware/auth');
const { requireAdmin, requirePrivilege } = require('../middleware/authorization');
const userService = require('../services/userService');
const roleService = require('../services/roleService');
const { validatePassword } = require('../middleware/security');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /users
 * Get all users (admin only)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page, limit, status, roleId, search } = req.query;
    const result = await userService.getAllUsers({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      status,
      roleId,
      search
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /users/:id
 * Get user by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can only view their own profile unless admin
    const isAdmin = await userService.isAdmin(req.user.id);
    if (!isAdmin && req.user.id !== id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const user = await userService.getUserById(id, true);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * POST /users
 * Create new user (admin only)
 */
router.post('/', requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('roleId').isUUID(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      password,
      firstName,
      lastName,
      roleId,
      professionalType,
      npi,
      licenseNumber,
      licenseState,
      deaNumber,
      taxonomyCode,
      credentials
    } = req.body;

    // Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password validation failed', details: passwordErrors });
    }

    // Validate NPI if provided
    if (npi) {
      const npiValidation = userService.validateNPI(npi);
      if (!npiValidation.valid) {
        return res.status(400).json({ error: npiValidation.error });
      }
    }

    // Validate DEA if provided
    if (deaNumber) {
      const deaValidation = userService.validateDEA(deaNumber);
      if (!deaValidation.valid) {
        return res.status(400).json({ error: deaValidation.error });
      }
    }

    // Validate license if provided
    if (licenseNumber) {
      const licenseValidation = userService.validateLicense(licenseNumber, licenseState);
      if (!licenseValidation.valid) {
        return res.status(400).json({ error: licenseValidation.error });
      }
    }

    // Verify role exists
    const role = await roleService.getRoleById(roleId);
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if trying to create admin (only existing admins can create admins)
    if (role.name === 'Admin') {
      const isAdmin = await userService.isAdmin(req.user.id);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can create admin users' });
      }
    }

    const user = await userService.createUser({
      email,
      password,
      firstName,
      lastName,
      roleId,
      professionalType,
      npi,
      licenseNumber,
      licenseState,
      deaNumber,
      taxonomyCode,
      credentials
    });

    await logAudit(req.user.id, 'user_created', 'user', user.id, {
      email: user.email,
      roleId
    }, req.ip);

    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message || 'Failed to create user' });
  }
});

/**
 * PUT /users/:id
 * Update user (admin or self)
 */
router.put('/:id', [
  body('email').optional().isEmail().normalizeEmail(),
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const isAdmin = await userService.isAdmin(req.user.id);
    
    // Users can only update their own profile unless admin
    if (!isAdmin && req.user.id !== id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Only admins can change role or status
    const updates = { ...req.body };
    if (!isAdmin) {
      delete updates.roleId;
      delete updates.status;
    }

    // Validate NPI if provided
    if (updates.npi) {
      const npiValidation = userService.validateNPI(updates.npi);
      if (!npiValidation.valid) {
        return res.status(400).json({ error: npiValidation.error });
      }
    }

    // Validate DEA if provided
    if (updates.deaNumber) {
      const deaValidation = userService.validateDEA(updates.deaNumber);
      if (!deaValidation.valid) {
        return res.status(400).json({ error: deaValidation.error });
      }
    }

    // Check if trying to promote to admin
    if (updates.roleId) {
      const role = await roleService.getRoleById(updates.roleId);
      if (role && role.name === 'Admin' && !isAdmin) {
        return res.status(403).json({ error: 'Only admins can promote users to admin' });
      }
    }

    const user = await userService.updateUser(id, updates);

    await logAudit(req.user.id, 'user_updated', 'user', id, updates, req.ip);

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ error: error.message || 'Failed to update user' });
  }
});

/**
 * PUT /users/:id/password
 * Update password (admin or self)
 */
router.put('/:id/password', [
  body('password').isLength({ min: 8 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const isAdmin = await userService.isAdmin(req.user.id);
    
    // Users can only change their own password unless admin
    if (!isAdmin && req.user.id !== id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { password } = req.body;

    // Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password validation failed', details: passwordErrors });
    }

    await userService.updatePassword(id, password);

    await logAudit(req.user.id, 'password_changed', 'user', id, {}, req.ip);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(400).json({ error: 'Failed to update password' });
  }
});

/**
 * PUT /users/:id/status
 * Update user status (admin only)
 */
router.put('/:id/status', requireAdmin, [
  body('status').isIn(['active', 'suspended', 'inactive']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    // Prevent suspending/deactivating yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own status' });
    }

    const user = await userService.updateUser(id, { status });

    await logAudit(req.user.id, 'user_status_changed', 'user', id, { status }, req.ip);

    res.json(user);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(400).json({ error: error.message || 'Failed to update user status' });
  }
});

/**
 * DELETE /users/:id
 * Delete user (soft delete - admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await userService.deleteUser(id);

    await logAudit(req.user.id, 'user_deleted', 'user', id, {}, req.ip);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(400).json({ error: error.message || 'Failed to delete user' });
  }
});

/**
 * GET /users/:id/privileges
 * Get user privileges
 */
router.get('/:id/privileges', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let isAdmin = false;
    try {
      isAdmin = await userService.isAdmin(req.user.id);
    } catch (error) {
      console.error('Error checking admin status:', error);
      // Continue - will just check permissions normally
    }
    
    // Users can only view their own privileges unless admin
    if (!isAdmin && req.user.id !== id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Admin always has all privileges - return all privileges from database
    if (isAdmin) {
      try {
        const roleService = require('../services/roleService');
        const allPrivileges = await roleService.getAllPrivileges();
        return res.json(allPrivileges || []);
      } catch (error) {
        console.error('Error fetching all privileges for admin:', error);
        // Fall through to regular privilege fetch
      }
    }

    const privileges = await userService.getUserPrivileges(id);
    res.json(privileges || []);
  } catch (error) {
    console.error('Error fetching user privileges:', error);
    console.error('Error details:', error.message, error.stack);
    // Return empty array instead of 500 error - hook will handle gracefully
    res.status(200).json([]);
  }
});

module.exports = router;

