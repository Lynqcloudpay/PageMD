/**
 * Role Management Routes
 * 
 * CRUD operations for roles and privileges
 * Requires admin privileges
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, logAudit } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorization');
const roleService = require('../services/roleService');
const AuditService = require('../services/auditService');

const router = express.Router();

// Authentication required for all routes
router.use(authenticate);
/**
 * GET /roles
 * Get all roles (accessible to any authenticated user)
 */
router.get('/', async (req, res) => {
  try {
    const roles = await roleService.getAllRoles();
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Admin-only routes below
router.use(requireAdmin);

/**
 * GET /roles/:id
 * Get role by ID with privileges
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const role = await roleService.getRoleById(id);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const privileges = await roleService.getRolePrivileges(id);
    res.json({ ...role, privileges });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

/**
 * POST /roles
 * Create new role
 */
router.post('/', [
  body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
  body('description').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    // Check if role exists
    const existing = await roleService.getRoleByName(name);
    if (existing) {
      return res.status(400).json({ error: 'Role with this name already exists' });
    }

    const role = await roleService.createRole(name, description, false);

    await logAudit(req.user.id, 'role_created', 'role', role.id, { name }, req.ip);

    res.status(201).json(role);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(400).json({ error: error.message || 'Failed to create role' });
  }
});

/**
 * PUT /roles/:id
 * Update role
 */
router.put('/:id', [
  body('name').optional().trim().notEmpty().isLength({ min: 2, max: 100 }),
  body('description').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // Check if role exists
    const role = await roleService.getRoleById(id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Previously restricted system roles, now allowing with intentional drift logging
    if (role.is_system_role) {
      console.log(`[GOVERNANCE] Intentional drift: System role '${role.name}' (ID: ${id}) metadata is being modified by user ${req.user.id}`);
      try {
        await AuditService.log(null, 'ROLE_GOVERNANCE_DRIFT', req.user.clinic_id || req.clinic?.id, {
          roleId: id,
          roleName: role.name,
          modifiedBy: req.user.id,
          action: 'update_role_metadata',
          updates
        });
      } catch (auditErr) {
        console.warn('Failed to log governance drift to platform audit:', auditErr.message);
      }
    }

    const updatedRole = await roleService.updateRole(id, updates);

    await logAudit(req.user.id, 'role_updated', 'role', id, updates, req.ip);

    res.json(updatedRole);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(400).json({ error: error.message || 'Failed to update role' });
  }
});

/**
 * DELETE /roles/:id
 * Delete role
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await roleService.deleteRole(id);

    await logAudit(req.user.id, 'role_deleted', 'role', id, {}, req.ip);

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(400).json({ error: error.message || 'Failed to delete role' });
  }
});

/**
 * GET /roles/:id/privileges
 * Get privileges for a role
 */
router.get('/:id/privileges', async (req, res) => {
  try {
    const { id } = req.params;
    const privileges = await roleService.getRolePrivileges(id);
    res.json(privileges);
  } catch (error) {
    console.error('Error fetching role privileges:', error);
    res.status(500).json({ error: 'Failed to fetch privileges' });
  }
});

/**
 * PUT /roles/:id/privileges
 * Update role privileges (replace all)
 */
router.put('/:id/privileges', [
  body('privilegeIds').isArray().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { privilegeIds } = req.body;

    // Check if role exists
    const role = await roleService.getRoleById(id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Previously restricted system roles, now allowing with intentional drift logging
    if (role.is_system_role) {
      console.log(`[GOVERNANCE] Intentional drift: System role '${role.name}' is being modified by user ${req.user.id}`);
    }

    await roleService.updateRolePrivileges(id, privilegeIds, req.user.id);

    // Document intentional drift in platform audit logs
    if (role.is_system_role) {
      try {
        await AuditService.log(null, 'ROLE_GOVERNANCE_DRIFT', req.user.clinic_id || req.clinic?.id, {
          roleId: id,
          roleName: role.name,
          modifiedBy: req.user.id,
          action: 'update_all_privileges',
          newPrivilegeCount: privilegeIds.length
        });
      } catch (auditErr) {
        console.warn('Failed to log governance drift to platform audit:', auditErr.message);
      }
    }

    await logAudit(req.user.id, 'role_privileges_updated', 'role', id, { privilegeIds }, req.ip);

    res.json({ message: 'Privileges updated successfully' });
  } catch (error) {
    console.error('Error updating role privileges:', error);
    res.status(400).json({ error: error.message || 'Failed to update privileges' });
  }
});

/**
 * POST /roles/:id/privileges
 * Assign privilege to role
 */
router.post('/:id/privileges', [
  body('privilegeId').isUUID(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { privilegeId } = req.body;

    await roleService.assignPrivilege(id, privilegeId, req.user.id);

    await logAudit(req.user.id, 'privilege_assigned', 'role', id, { privilegeId }, req.ip);

    res.json({ message: 'Privilege assigned successfully' });
  } catch (error) {
    console.error('Error assigning privilege:', error);
    res.status(400).json({ error: error.message || 'Failed to assign privilege' });
  }
});

/**
 * DELETE /roles/:id/privileges/:privilegeId
 * Remove privilege from role
 */
router.delete('/:id/privileges/:privilegeId', async (req, res) => {
  try {
    const { id, privilegeId } = req.params;

    await roleService.removePrivilege(id, privilegeId);

    await logAudit(req.user.id, 'privilege_removed', 'role', id, { privilegeId }, req.ip);

    res.json({ message: 'Privilege removed successfully' });
  } catch (error) {
    console.error('Error removing privilege:', error);
    res.status(400).json({ error: error.message || 'Failed to remove privilege' });
  }
});

/**
 * GET /privileges
 * Get all privileges
 */
router.get('/privileges/all', async (req, res) => {
  try {
    const privileges = await roleService.getAllPrivileges();
    res.json(privileges);
  } catch (error) {
    console.error('Error fetching privileges:', error);
    res.status(500).json({ error: 'Failed to fetch privileges' });
  }
});

module.exports = router;






