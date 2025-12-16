/**
 * User Service
 * 
 * Handles all user-related business logic including:
 * - User CRUD operations
 * - Healthcare professional field validation
 * - Role assignment
 * - Status management
 */

const pool = require('../db');
const bcrypt = require('bcryptjs');
const passwordService = require('./passwordService');

class UserService {
  /**
   * Get user by ID with role and privileges
   */
  async getUserById(userId, includePrivileges = false) {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.status,
        u.date_created,
        u.last_login,
        u.professional_type,
        u.npi,
        u.license_number,
        u.license_state,
        u.dea_number,
        u.taxonomy_code,
        u.taxonomy_code,
        u.credentials,
<<<<<<< HEAD
        u.role,
=======
        CASE 
          WHEN r.name = 'Admin' OR r.name = 'admin' OR r.name = 'SuperAdmin' OR u.role = 'admin' THEN true 
          ELSE false 
        END as is_admin,
>>>>>>> 1a2a6913651ab98a78949d19fbc5bcd0d9f56954
        r.id as role_id,
        r.name as role_name,
        r.description as role_description
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    // Fallback for legacy roles
    if (!user.role_name && user.role) {
      user.role_name = user.role;
    }

    if (includePrivileges && user.role_id) {
      user.privileges = await this.getUserPrivileges(userId);
    }

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.password_hash,
        u.first_name,
        u.last_name,
        u.status,
        u.role_id,
<<<<<<< HEAD
=======
        CASE 
          WHEN r.name = 'Admin' OR r.name = 'admin' OR r.name = 'SuperAdmin' OR u.role = 'admin' THEN true 
          ELSE false 
        END as is_admin,
>>>>>>> 1a2a6913651ab98a78949d19fbc5bcd0d9f56954
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
    `;

    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(options = {}) {
    const {
      page = 1,
      limit = 50,
      status,
      roleId,
      search
    } = options;

    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.status,
        u.date_created,
        u.last_login,
        u.professional_type,
        u.npi,
        u.npi,
        u.credentials,
<<<<<<< HEAD
=======
        CASE 
          WHEN r.name = 'Admin' OR r.name = 'admin' OR r.name = 'SuperAdmin' OR u.role = 'admin' THEN true 
          ELSE false 
        END as is_admin,
>>>>>>> 1a2a6913651ab98a78949d19fbc5bcd0d9f56954
        r.id as role_id,
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND u.status = $${paramCount}`;
      params.push(status);
    }

    if (roleId) {
      paramCount++;
      query += ` AND u.role_id = $${paramCount}`;
      params.push(roleId);
    }

    if (search) {
      paramCount++;
      query += ` AND (
        u.first_name ILIKE $${paramCount} OR
        u.last_name ILIKE $${paramCount} OR
        u.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY u.last_name, u.first_name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.total || 0);

    return {
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Map new role name to old role format for backward compatibility
   */
  mapRoleToOldFormat(roleName) {
    if (!roleName) return 'admin'; // Default fallback

    const roleMap = {
      'Admin': 'admin',
      'Physician': 'clinician',
      'Nurse Practitioner': 'clinician',
      'Physician Assistant': 'clinician',
      'Nurse': 'nurse',
      'Medical Assistant': 'nurse',
      'Front Desk': 'front_desk',
      'Billing': 'front_desk'
    };

    return roleMap[roleName] || 'admin';
  }

  /**
   * Create new user
   */
  async createUser(userData) {
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
      credentials,
      isAdmin
    } = userData;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !roleId) {
      throw new Error('Missing required fields');
    }

    // Hash password with Argon2id (HIPAA-compliant)
    const passwordHash = await passwordService.hashPassword(password);

    // Check if email exists
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Get role name for the old role column
    const roleQuery = await pool.query('SELECT name FROM roles WHERE id = $1', [roleId]);
    const roleName = roleQuery.rows[0]?.name || 'Admin';
    const oldRoleFormat = this.mapRoleToOldFormat(roleName);

    // Insert user (including old role column for backward compatibility)
    const query = `
        email, password_hash, first_name, last_name, role_id, role, status,
        professional_type, npi, license_number, license_state,
        dea_number, taxonomy_code, credentials, date_created
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      RETURNING id, email, first_name, last_name, status, date_created
    `;

    const result = await pool.query(query, [
      email,
      passwordHash,
      firstName,
      lastName,
      roleId,
      oldRoleFormat, // Old role column
      'active',
      professionalType || null,
      npi || null,
      licenseNumber || null,
      licenseState || null,
      deaNumber || null,
      taxonomyCode || null,
      credentials || null
    ]);

    return result.rows[0];
  }

  /**
   * Update user
   */
  async updateUser(userId, updates) {
    const allowedFields = [
      'first_name', 'last_name', 'email', 'status', 'role_id',
      'professional_type', 'npi', 'license_number', 'license_state',
      'dea_number', 'taxonomy_code', 'credentials'
    ];

<<<<<<< HEAD
=======
    // Handle isAdmin flag by updating role_id to Admin role (is_admin column doesn't exist)
    if (updates.isAdmin !== undefined) {
      // Get Admin role ID
      const adminRoleQuery = await pool.query("SELECT id FROM roles WHERE name = 'Admin' LIMIT 1");
      const adminRoleId = adminRoleQuery.rows[0]?.id;
      
      if (updates.isAdmin === true || updates.isAdmin === 'true') {
        if (adminRoleId) {
          updates.roleId = adminRoleId;
        }
      }
      // Remove isAdmin from updates (handled via role_id)
      delete updates.isAdmin;
    }

>>>>>>> 1a2a6913651ab98a78949d19fbc5bcd0d9f56954
    const updateFields = [];
    const params = [];
    let paramCount = 0;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'firstName' ? 'first_name' :
        key === 'lastName' ? 'last_name' :
          key === 'roleId' ? 'role_id' :
            key === 'professionalType' ? 'professional_type' :
              key === 'licenseNumber' ? 'license_number' :
                key === 'licenseState' ? 'license_state' :
                  key === 'deaNumber' ? 'dea_number' :
                    key === 'taxonomyCode' ? 'taxonomy_code' : key;

      if (allowedFields.includes(dbKey) && value !== undefined) {
        paramCount++;
        updateFields.push(`${dbKey} = $${paramCount}`);
        params.push(value);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(userId);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, status, role_id
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Update password (HIPAA-compliant with Argon2id)
   */
  async updatePassword(userId, newPassword) {
    const passwordHash = await passwordService.hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, userId]
    );
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId) {
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }

  /**
   * Get user privileges
   */
  async getUserPrivileges(userId) {
    try {
      const query = `
        SELECT DISTINCT p.id, p.name, p.description, p.category
        FROM privileges p
        INNER JOIN role_privileges rp ON p.id = rp.privilege_id
        INNER JOIN users u ON rp.role_id = u.role_id
        WHERE u.id = $1
        ORDER BY p.category, p.name
      `;

      const result = await pool.query(query, [userId]);
      return result.rows || [];
    } catch (error) {
      console.error('Error in getUserPrivileges:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  /**
   * Check if user has privilege
   */
  async hasPrivilege(userId, privilegeName) {
    // Admin always has all privileges
    const user = await this.getUserById(userId);
    if (user && user.role_name === 'Admin') {
      return true;
    }

    const query = `
      SELECT COUNT(*) as count
      FROM privileges p
      INNER JOIN role_privileges rp ON p.id = rp.privilege_id
      INNER JOIN users u ON rp.role_id = u.role_id
      WHERE u.id = $1 AND p.name = $2
    `;

    const result = await pool.query(query, [userId, privilegeName]);
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Check if user is admin
   * User is admin if they have is_admin flag OR their role is Admin
   */
  async isAdmin(userId) {
    const user = await this.getUserById(userId);
    return user && (user.role_name === 'Admin');
  }

  /**
   * Delete user (hard delete - actually remove from database)
   * Note: This will fail if there are foreign key constraints
   * You may need to handle cascading deletes or reassign references first
   */
  async deleteUser(userId) {
    // First, set all foreign key references to NULL or a default admin user
    // This is a hard delete, so we need to handle foreign keys

    // Delete user (CASCADE should handle related records if foreign keys are set up properly)
    const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
  }

  /**
   * Validate NPI format (10 digits)
   */
  validateNPI(npi) {
    if (!npi) return { valid: true };
    const npiRegex = /^\d{10}$/;
    return {
      valid: npiRegex.test(npi),
      error: npiRegex.test(npi) ? null : 'NPI must be exactly 10 digits'
    };
  }

  /**
   * Validate DEA format (2 letters + 7 digits + 1 check digit)
   */
  validateDEA(dea) {
    if (!dea) return { valid: true };
    const deaRegex = /^[A-Z]{2}\d{7}$/;
    return {
      valid: deaRegex.test(dea),
      error: deaRegex.test(dea) ? null : 'DEA must be in format: 2 letters + 7 digits (e.g., AB1234567)'
    };
  }

  /**
   * Validate license number format
   */
  validateLicense(licenseNumber, state) {
    if (!licenseNumber) return { valid: true };
    // Basic validation - can be enhanced with state-specific rules
    return {
      valid: licenseNumber.length >= 3 && licenseNumber.length <= 20,
      error: licenseNumber.length < 3 || licenseNumber.length > 20
        ? 'License number must be between 3 and 20 characters'
        : null
    };
  }
}

module.exports = new UserService();

