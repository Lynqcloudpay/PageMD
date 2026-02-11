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
const stripeService = require('./stripeService');

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
        u.is_admin,
        u.role,
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
        u.is_admin,
        u.role
      FROM users u
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
      // paramCount++;
      // query += ` AND u.role_id = $${paramCount}`;
      // params.push(roleId);
      // Deprecated: roleId search disabled until roles table is fully migrated
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

    // Handle isAdmin flag - set is_admin column directly (preserves role_id)
    // Admin privileges are secondary - users keep their primary role (Physician, Nurse, etc.)
    const isAdminValue = isAdmin === true || isAdmin === 'true' || false;

    // Strict Credential Enforcement for Providers
    if (this.isProfessionalRole(roleName)) {
      if (!npi) throw new Error(`NPI is mandatory for role: ${roleName}`);
      if (!licenseNumber || !licenseState) throw new Error(`License details are mandatory for role: ${roleName}`);

      const prescribingRoles = ['Physician', 'Nurse Practitioner', 'Physician Assistant'];
      if (prescribingRoles.includes(roleName) && !deaNumber) {
        throw new Error(`DEA number is mandatory for prescribing role: ${roleName}`);
      }
    }

    // Insert user (including old role column for backward compatibility and is_admin)
    const query = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, role_id, role, status,
        professional_type, npi, license_number, license_state,
        dea_number, taxonomy_code, credentials, is_admin, date_created
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      RETURNING id, email, first_name, last_name, status, role_id, is_admin, date_created
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
      credentials || null,
      isAdminValue // is_admin flag (secondary to role_id)
    ]);


    // Create platform lookup entry for multi-tenant login resolution
    try {
      const schemaRes = await pool.query('SELECT current_schema()');
      const currentSchema = schemaRes.rows[0].current_schema;

      if (currentSchema && currentSchema !== 'public') {
        await pool.controlPool.query(
          `INSERT INTO platform_user_lookup (email, schema_name) 
           VALUES ($1, $2) 
           ON CONFLICT (email) 
           DO UPDATE SET schema_name = $2`,
          [email, currentSchema]
        );

        // Sync Stripe Subscription quantity (async)
        const clinicRes = await pool.controlPool.query('SELECT id FROM clinics WHERE schema_name = $1', [currentSchema]);
        if (clinicRes.rows[0]) {
          stripeService.syncSubscriptionQuantity(clinicRes.rows[0].id).catch(err =>
            console.error('[UserService] Stripe Sync Failed:', err)
          );
        }
      }
    } catch (lookupError) {
      console.error('[UserService] Failed to update platform_user_lookup:', lookupError);
      // Non-critical, do not fail user creation
    }

    return result.rows[0];
  }

  /**
   * Update user
   */
  async updateUser(userId, updates) {
    const allowedFields = [
      'first_name', 'last_name', 'email', 'status', 'role_id',
      'professional_type', 'npi', 'license_number', 'license_state',
      'dea_number', 'taxonomy_code', 'credentials', 'is_admin'
    ];

    // Handle isAdmin flag by setting is_admin column directly (preserves role_id)
    // Admin privileges are secondary - users keep their primary role (Physician, Nurse, etc.)
    let isAdminValue = null;
    if (updates.isAdmin !== undefined) {
      isAdminValue = updates.isAdmin === true || updates.isAdmin === 'true';
      // Remove isAdmin from updates (will be handled separately)
      delete updates.isAdmin;
    }

    const updateFields = [];
    const params = [];
    let paramCount = 0;

    for (const [key, value] of Object.entries(updates)) {
      // Skip undefined, null, or empty string values (unless explicitly setting to null)
      if (value === undefined || (value === '' && key !== 'email')) {
        continue;
      }

      const dbKey = key === 'firstName' ? 'first_name' :
        key === 'lastName' ? 'last_name' :
          key === 'roleId' ? 'role_id' :
            key === 'professionalType' ? 'professional_type' :
              key === 'licenseNumber' ? 'license_number' :
                key === 'licenseState' ? 'license_state' :
                  key === 'deaNumber' ? 'dea_number' :
                    key === 'taxonomyCode' ? 'taxonomy_code' : key;

      if (allowedFields.includes(dbKey)) {
        paramCount++;
        updateFields.push(`${dbKey} = $${paramCount}`);
        params.push(value === '' ? null : value);
      }
    }

    // Add is_admin update if provided (preserves existing role_id)
    if (isAdminValue !== null) {
      paramCount++;
      updateFields.push(`is_admin = $${paramCount}`);
      params.push(isAdminValue);
    }

    if (updateFields.length === 0) {
      // Provide more helpful error message
      const providedFields = Object.keys(updates).join(', ');
      throw new Error(`No valid fields to update. Provided fields: ${providedFields || 'none'}. Allowed fields: ${allowedFields.join(', ')}`);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(userId);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, status, role_id, is_admin
    `;

    const result = await pool.query(query, params);

    // If status changed or role changed, sync Stripe (async)
    if (updates.status || updates.roleId) {
      try {
        const schemaRes = await pool.query('SELECT current_schema()');
        const currentSchema = schemaRes.rows[0].current_schema;
        const clinicRes = await pool.controlPool.query('SELECT id FROM clinics WHERE schema_name = $1', [currentSchema]);
        if (clinicRes.rows[0]) {
          stripeService.syncSubscriptionQuantity(clinicRes.rows[0].id).catch(err =>
            console.error('[UserService] Stripe Sync Failed (Update):', err)
          );
        }
      } catch (e) {
        // Non-critical
      }
    }

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
    if (user && (user.role_name === 'Admin' || user.is_admin === true)) {
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
    return user && (user.role_name === 'Admin' || user.is_admin === true);
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
   * Check if role is a clinical/professional role requiring credentials
   */
  isProfessionalRole(roleName) {
    const professionalRoles = ['Physician', 'Nurse Practitioner', 'Physician Assistant', 'Nurse'];
    return professionalRoles.includes(roleName);
  }

  /**
   * Validate NPI format (10 digits)
   */
  validateNPI(npi) {
    if (!npi) return { valid: false, error: 'NPI is required' };
    const npiRegex = /^\d{10}$/;

    // Luhn-like check for NPI (simplified check for 10 digits starting with 1 or 2)
    const validFormat = npiRegex.test(npi) && (npi.startsWith('1') || npi.startsWith('2'));

    return {
      valid: validFormat,
      error: validFormat ? null : 'NPI must be exactly 10 digits and start with 1 or 2'
    };
  }

  /**
   * Validate DEA format (2 letters + 7 digits)
   */
  validateDEA(dea) {
    if (!dea) return { valid: false, error: 'DEA number is required' };
    const deaRegex = /^[A-Z]{2}\d{7}$/;

    // Check digit verification (Simplified logic)
    const valid = deaRegex.test(dea);

    return {
      valid: valid,
      error: valid ? null : 'DEA must be 2 letters followed by 7 digits (e.g., AB1234567)'
    };
  }

  /**
   * Validate license number format
   */
  validateLicense(licenseNumber, state) {
    if (!licenseNumber) return { valid: false, error: 'License number is required' };
    if (!state || state.length !== 2) return { valid: false, error: 'Valid 2-letter state code is required' };

    const validLength = licenseNumber.length >= 5 && licenseNumber.length <= 25;

    return {
      valid: validLength,
      error: validLength ? null : 'License number must be between 5 and 25 characters'
    };
  }
}

module.exports = new UserService();

