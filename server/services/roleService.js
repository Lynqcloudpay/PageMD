/**
 * Role Service
 * 
 * Handles role and privilege management
 */

const pool = require('../db');

class RoleService {
  /**
   * Get all roles
   */
  async getAllRoles() {
    const result = await pool.query(`
      SELECT id, name, description, is_system_role, created_at
      FROM roles
      ORDER BY name
    `);
    return result.rows;
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId) {
    const result = await pool.query(`
      SELECT id, name, description, is_system_role, created_at
      FROM roles
      WHERE id = $1
    `, [roleId]);
    return result.rows[0] || null;
  }

  /**
   * Get role by name
   */
  async getRoleByName(name) {
    const result = await pool.query(`
      SELECT id, name, description, is_system_role
      FROM roles
      WHERE name = $1
    `, [name]);
    return result.rows[0] || null;
  }

  /**
   * Create role
   */
  async createRole(name, description, isSystemRole = false) {
    const result = await pool.query(`
      INSERT INTO roles (name, description, is_system_role)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, is_system_role
    `, [name, description, isSystemRole]);
    return result.rows[0];
  }

  /**
   * Update role
   */
  async updateRole(roleId, updates) {
    const { name, description } = updates;
    const fields = [];
    const params = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      fields.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (description !== undefined) {
      paramCount++;
      fields.push(`description = $${paramCount}`);
      params.push(description);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    paramCount++;
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(roleId);

    const result = await pool.query(`
      UPDATE roles
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, description, is_system_role
    `, params);

    return result.rows[0];
  }

  /**
   * Delete role (only if not system role and no users assigned)
   */
  async deleteRole(roleId) {
    // Check if system role
    const role = await this.getRoleById(roleId);
    if (role && role.is_system_role) {
      throw new Error('Cannot delete system role');
    }

    // Check if users assigned
    const userCount = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
      [roleId]
    );

    if (parseInt(userCount.rows[0].count) > 0) {
      throw new Error('Cannot delete role with assigned users');
    }

    await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
  }

  /**
   * Get all privileges
   */
  async getAllPrivileges() {
    const result = await pool.query(`
      SELECT id, name, description, category
      FROM privileges
      ORDER BY category, name
    `);
    return result.rows;
  }

  /**
   * Get privileges for a role
   */
  async getRolePrivileges(roleId) {
    const result = await pool.query(`
      SELECT p.id, p.name, p.description, p.category
      FROM privileges p
      INNER JOIN role_privileges rp ON p.id = rp.privilege_id
      WHERE rp.role_id = $1
      ORDER BY p.category, p.name
    `, [roleId]);
    return result.rows;
  }

  /**
   * Assign privilege to role
   */
  async assignPrivilege(roleId, privilegeId, grantedBy = null) {
    await pool.query(`
      INSERT INTO role_privileges (role_id, privilege_id, granted_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (role_id, privilege_id) DO NOTHING
    `, [roleId, privilegeId, grantedBy]);
  }

  /**
   * Remove privilege from role
   */
  async removePrivilege(roleId, privilegeId) {
    await pool.query(`
      DELETE FROM role_privileges
      WHERE role_id = $1 AND privilege_id = $2
    `, [roleId, privilegeId]);
  }

  /**
   * Update role privileges (replace all)
   */
  async updateRolePrivileges(roleId, privilegeIds, grantedBy = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing privileges
      await client.query('DELETE FROM role_privileges WHERE role_id = $1', [roleId]);

      // Insert new privileges
      for (const privId of privilegeIds) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id, granted_by)
          VALUES ($1, $2, $3)
        `, [roleId, privId, grantedBy]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get privilege by name
   */
  async getPrivilegeByName(name) {
    const result = await pool.query(`
      SELECT id, name, description, category
      FROM privileges
      WHERE name = $1
    `, [name]);
    return result.rows[0] || null;
  }
}

module.exports = new RoleService();






















