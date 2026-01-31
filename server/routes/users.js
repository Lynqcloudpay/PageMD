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
 * GET /users/directory
 * Get simplified list of users for messaging/assignments (available to all)
 */
router.get('/directory', async (req, res) => {
  try {
    const result = await userService.getAllUsers({ limit: 1000, status: 'active' });
    const users = result.users || [];

    // Return simplified objects
    const simplified = users.map(u => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role_name || u.role, // Fallback
      email: u.email,
      professional_type: u.professional_type
    }));

    res.json(simplified);
  } catch (error) {
    console.error('Error fetching user directory:', error);
    res.status(500).json({ error: 'Failed to fetch directory' });
  }
});

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
  // Validation needs to be flexible or check the coalesced values later. 
  // For now, we'll relax these check here and rely on manual check or DB constraints 
  // to avoid complex conditional validation logic in express-validator
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      password,
      firstName, first_name,
      lastName, last_name,
      roleId, role_id,
      professionalType, professional_type,
      npi,
      licenseNumber, license_number,
      licenseState, license_state,
      deaNumber, dea_number,
      taxonomyCode, taxonomy_code,
      credentials,
      isAdmin, is_admin
    } = req.body;

    // Coalesce values (prefer snake_case from new frontend, fallback to camelCase)
    const firstNameFinal = first_name || firstName;
    const lastNameFinal = last_name || lastName;
    const roleIdFinal = role_id || roleId;

    if (!firstNameFinal || !lastNameFinal) {
      return res.status(400).json({ error: 'First name and Last name are required' });
    }
    if (!roleIdFinal) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

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
    const deaNumberFinal = dea_number || deaNumber;
    if (deaNumberFinal) {
      const deaValidation = userService.validateDEA(deaNumberFinal);
      if (!deaValidation.valid) {
        return res.status(400).json({ error: deaValidation.error });
      }
    }

    // Validate license if provided
    const licenseNumberFinal = license_number || licenseNumber;
    const licenseStateFinal = license_state || licenseState;

    if (licenseNumberFinal) {
      const licenseValidation = userService.validateLicense(licenseNumberFinal, licenseStateFinal);
      if (!licenseValidation.valid) {
        return res.status(400).json({ error: licenseValidation.error });
      }
    }

    // Verify role exists
    const role = await roleService.getRoleById(roleIdFinal);
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if trying to grant admin privileges (only existing admins can grant admin privileges)
    const isAdminFinal = is_admin || isAdmin;
    if (isAdminFinal === true || isAdminFinal === 'true') {
      const currentUserIsAdmin = await userService.isAdmin(req.user.id);
      if (!currentUserIsAdmin) {
        return res.status(403).json({ error: 'Only admins can grant admin privileges' });
      }
    }

    const user = await userService.createUser({
      email,
      password,
      firstName: firstNameFinal,
      lastName: lastNameFinal,
      roleId: roleIdFinal,
      professionalType: professional_type || professionalType,
      npi,
      licenseNumber: licenseNumberFinal,
      licenseState: licenseStateFinal,
      deaNumber: deaNumberFinal,
      taxonomyCode: taxonomy_code || taxonomyCode,
      credentials,
      isAdmin: isAdminFinal === true || isAdminFinal === 'true'
    });

    req.logAuditEvent({
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      details: { email: user.email, roleId: roleIdFinal }
    });

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

    req.logAuditEvent({
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      details: updates
    });

    if (updates.roleId) {
      req.logAuditEvent({
        action: 'ROLE_CHANGED',
        entityType: 'User',
        entityId: id,
        details: { newRoleId: updates.roleId }
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    console.error('Error details:', error.message, error.stack);
    console.error('Update payload:', JSON.stringify(req.body, null, 2));
    res.status(400).json({
      error: error.message || 'Failed to update user',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

    req.logAuditEvent({
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: id
    });

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

    req.logAuditEvent({
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: id,
      details: { status }
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(400).json({ error: error.message || 'Failed to update user status' });
  }
});

/**
 * DELETE /users/:id
 * Delete user permanently (hard delete - admin only)
 * 
 * HIPAA Note: Users with associated clinical records cannot be hard-deleted
 * to preserve audit trails. Use status update (deactivate) instead.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query; // Allow force deletion with reassignment

    // Prevent deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check for associated records that would prevent deletion
    const pool = require('../db');
    const associatedRecords = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM visits WHERE provider_id = $1) as visits_count,
        (SELECT COUNT(*) FROM visits WHERE note_signed_by = $1) as signed_notes_count,
        (SELECT COUNT(*) FROM messages WHERE from_user_id = $1 OR to_user_id = $1) as messages_count,
        (SELECT COUNT(*) FROM audit_logs WHERE user_id = $1) as audit_logs_count
    `, [id]);

    const counts = associatedRecords.rows[0];
    const hasAssociatedRecords =
      parseInt(counts.visits_count) > 0 ||
      parseInt(counts.signed_notes_count) > 0 ||
      parseInt(counts.messages_count) > 0;

    if (hasAssociatedRecords && !force) {
      return res.status(409).json({
        error: 'Cannot delete user with associated clinical records',
        details: {
          visits: parseInt(counts.visits_count),
          signedNotes: parseInt(counts.signed_notes_count),
          messages: parseInt(counts.messages_count),
          auditLogs: parseInt(counts.audit_logs_count)
        },
        suggestion: 'For HIPAA compliance, deactivate this user instead of deleting. ' +
          'Use PUT /users/:id/status with status="inactive" to preserve audit trails.'
      });
    }

    await userService.deleteUser(id);

    req.logAuditEvent({
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);

    // Check if it's a foreign key constraint error
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete user with associated records',
        suggestion: 'Deactivate this user instead to preserve audit trails.'
      });
    }

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

