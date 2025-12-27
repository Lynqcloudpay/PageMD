/**
 * Settings Management Routes
 * 
 * Admin-only routes for managing practice settings, system configuration, etc.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, logAudit } = require('../middleware/auth');
const { requireAdmin, requirePrivilege } = require('../middleware/authorization');
const pool = require('../db');

const router = express.Router();

// Basic settings accessible to most authenticated users (with specific permissions)
router.get('/practice', authenticate, async (req, res) => {
  try {
    // If we have a clinic resolved in the context, pull branding from Control DB
    if (req.clinic) {
      const result = await pool.controlPool.query(
        'SELECT * FROM clinics WHERE id = $1',
        [req.clinic.id]
      );
      if (result.rows.length > 0) {
        const c = result.rows[0];
        // Merge with clinic_settings
        const settingsRes = await pool.controlPool.query(
          'SELECT * FROM clinic_settings WHERE clinic_id = $1',
          [req.clinic.id]
        );
        const s = settingsRes.rows[0] || {};

        return res.json({
          id: c.id,
          practice_name: c.display_name,
          legal_name: c.legal_name,
          practice_type: c.specialty,
          tax_id: c.tax_id,
          npi: c.npi,
          address_line1: c.address_line1,
          address_line2: c.address_line2,
          city: c.city,
          state: c.state,
          zip: c.zip,
          phone: c.phone,
          fax: c.fax,
          email: c.email,
          website: c.website,
          logo_url: c.logo_url,
          timezone: s.time_zone || 'America/New_York',
          date_format: s.date_format || 'MM/DD/YYYY',
          time_format: s.time_format || '12h'
        });
      }
    }

    // Fallback to local DB for backward compatibility or unit tests
    const result = await pool.query('SELECT * FROM practice_settings ORDER BY updated_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({
        practice_name: 'My Practice',
        timezone: 'America/New_York',
        date_format: 'MM/DD/YYYY',
        time_format: '12h'
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching practice settings:', error);
    res.status(500).json({ error: 'Failed to fetch practice settings' });
  }
});

/**
 * GET /api/settings/locations
 * Get all active locations
 */
router.get('/locations', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations WHERE active = true ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

/**
 * POST /api/settings/locations
 * Create a new location
 */
router.post('/locations', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, npi, pos_code, address_line1, address_line2, city, state, zip, phone, organization_id } = req.body;
    const result = await pool.query(`
      INSERT INTO locations (name, npi, pos_code, address_line1, address_line2, city, state, zip, phone, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [name, npi, pos_code, address_line1, address_line2, city, state, zip, phone, organization_id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Admin-only routes for modifications
const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin); // Apply authenticate and requireAdmin to all admin routes

/**
 * PUT /settings/practice
 * Update practice settings
 */
adminRouter.put('/practice', [
  body('practice_name').optional().notEmpty(),
  body('timezone').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      practice_name, tax_id, npi,
      address_line1, address_line2, city, state, zip,
      phone, fax, email, website, logo_url,
      timezone, date_format, time_format
    } = req.body;

    // Handle variation in field name
    const practice_type = req.body.practice_type || req.body.specialty;

    if (req.clinic) {
      // Update Control DB
      await pool.controlPool.query(`
        UPDATE clinics SET
          display_name = COALESCE($1, display_name),
          legal_name = COALESCE($2, legal_name),
          specialty = COALESCE($3, specialty),
          tax_id = COALESCE($4, tax_id),
          npi = COALESCE($5, npi),
          address_line1 = COALESCE($6, address_line1),
          address_line2 = COALESCE($7, address_line2),
          city = COALESCE($8, city),
          state = COALESCE($9, state),
          zip = COALESCE($10, zip),
          phone = COALESCE($11, phone),
          fax = COALESCE($12, fax),
          email = COALESCE($13, email),
          website = COALESCE($14, website),
          logo_url = COALESCE($15, logo_url)
        WHERE id = $16
      `, [
        practice_name, legal_name, practice_type, tax_id, npi,
        address_line1, address_line2, city, state, zip,
        phone, fax, email, website, logo_url,
        req.clinic.id
      ]);

      await pool.controlPool.query(`
        UPDATE clinic_settings SET
          time_zone = COALESCE($1, time_zone),
          date_format = COALESCE($2, date_format),
          time_format = COALESCE($3, time_format)
        WHERE clinic_id = $4
      `, [timezone, date_format, time_format, req.clinic.id]);

      return res.json({ message: 'Clinic settings updated successfully in Control DB' });
    }

    // Fallback/Legacy local update
    const existing = await pool.query('SELECT id FROM practice_settings LIMIT 1');

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(`
        UPDATE practice_settings SET
          practice_name = COALESCE($1, practice_name),
          practice_type = COALESCE($2, practice_type),
          tax_id = COALESCE($3, tax_id),
          npi = COALESCE($4, npi),
          address_line1 = COALESCE($5, address_line1),
          address_line2 = COALESCE($6, address_line2),
          city = COALESCE($7, city),
          state = COALESCE($8, state),
          zip = COALESCE($9, zip),
          phone = COALESCE($10, phone),
          fax = COALESCE($11, fax),
          email = COALESCE($12, email),
          website = COALESCE($13, website),
          logo_url = COALESCE($14, logo_url),
          timezone = COALESCE($15, timezone),
          date_format = COALESCE($16, date_format),
          time_format = COALESCE($17, time_format),
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $18
        WHERE id = $19
        RETURNING *
      `, [
        practice_name, practice_type, tax_id, npi,
        address_line1, address_line2, city, state, zip,
        phone, fax, email, website, logo_url,
        timezone, date_format, time_format,
        req.user.id, existing.rows[0].id
      ]);
    } else {
      // Create new
      result = await pool.query(`
        INSERT INTO practice_settings (
          practice_name, practice_type, tax_id, npi,
          address_line1, address_line2, city, state, zip,
          phone, fax, email, website, logo_url,
          timezone, date_format, time_format, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        practice_name || 'My Practice', practice_type, tax_id, npi,
        address_line1, address_line2, city, state, zip,
        phone, fax, email, website, logo_url,
        timezone || 'America/New_York', date_format || 'MM/DD/YYYY', time_format || '12h',
        req.user.id
      ]);
    }

    await logAudit(req.user.id, 'practice_settings_updated', 'settings', result.rows[0].id, {}, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating practice settings:', error);
    res.status(500).json({ error: 'Failed to update practice settings' });
  }
});

/**
 * GET /settings/security
 * Get security settings
 */
adminRouter.get('/security', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM security_settings ORDER BY updated_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({
        password_min_length: 8,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_number: true,
        password_require_special: true,
        session_timeout_minutes: 30,
        max_login_attempts: 5,
        lockout_duration_minutes: 15
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching security settings:', error);
    res.status(500).json({ error: 'Failed to fetch security settings' });
  }
});

/**
 * PUT /settings/security
 * Update security settings
 */
adminRouter.put('/security', async (req, res) => {
  try {
    const {
      password_min_length, password_require_uppercase, password_require_lowercase,
      password_require_number, password_require_special,
      session_timeout_minutes, max_login_attempts, lockout_duration_minutes,
      require_2fa, require_2fa_for_admin, inactivity_timeout_minutes,
      audit_log_retention_days, ip_whitelist
    } = req.body;

    const existing = await pool.query('SELECT id FROM security_settings LIMIT 1');

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(`
        UPDATE security_settings SET
          password_min_length = COALESCE($1, password_min_length),
          password_require_uppercase = COALESCE($2, password_require_uppercase),
          password_require_lowercase = COALESCE($3, password_require_lowercase),
          password_require_number = COALESCE($4, password_require_number),
          password_require_special = COALESCE($5, password_require_special),
          session_timeout_minutes = COALESCE($6, session_timeout_minutes),
          max_login_attempts = COALESCE($7, max_login_attempts),
          lockout_duration_minutes = COALESCE($8, lockout_duration_minutes),
          require_2fa = COALESCE($9, require_2fa),
          require_2fa_for_admin = COALESCE($10, require_2fa_for_admin),
          inactivity_timeout_minutes = COALESCE($11, inactivity_timeout_minutes),
          audit_log_retention_days = COALESCE($12, audit_log_retention_days),
          ip_whitelist = COALESCE($13, ip_whitelist),
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $14
        WHERE id = $15
        RETURNING *
      `, [
        password_min_length, password_require_uppercase, password_require_lowercase,
        password_require_number, password_require_special,
        session_timeout_minutes, max_login_attempts, lockout_duration_minutes,
        require_2fa, require_2fa_for_admin, inactivity_timeout_minutes,
        audit_log_retention_days, ip_whitelist,
        req.user.id, existing.rows[0].id
      ]);
    } else {
      result = await pool.query(`
        INSERT INTO security_settings (
          password_min_length, password_require_uppercase, password_require_lowercase,
          password_require_number, password_require_special,
          session_timeout_minutes, max_login_attempts, lockout_duration_minutes,
          require_2fa, require_2fa_for_admin, inactivity_timeout_minutes,
          audit_log_retention_days, ip_whitelist, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        password_min_length || 8, password_require_uppercase ?? true,
        password_require_lowercase ?? true, password_require_number ?? true,
        password_require_special ?? true, session_timeout_minutes || 30,
        max_login_attempts || 5, lockout_duration_minutes || 15,
        require_2fa ?? false, require_2fa_for_admin ?? false,
        inactivity_timeout_minutes || 15, audit_log_retention_days || 365,
        ip_whitelist, req.user.id
      ]);
    }

    await logAudit(req.user.id, 'security_settings_updated', 'settings', result.rows[0].id, {}, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
});

/**
 * GET /settings/clinical
 * Get clinical settings
 */
adminRouter.get('/clinical', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clinical_settings ORDER BY updated_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({
        require_dx_on_visit: true,
        require_vitals_on_visit: false,
        enable_clinical_alerts: true,
        enable_drug_interaction_check: true,
        enable_allergy_alerts: true,
        default_visit_duration_minutes: 15
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching clinical settings:', error);
    res.status(500).json({ error: 'Failed to fetch clinical settings' });
  }
});

/**
 * PUT /settings/clinical
 * Update clinical settings
 */
adminRouter.put('/clinical', async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM clinical_settings LIMIT 1');

    const updates = { ...req.body };
    const values = [];
    const setClauses = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    });

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    setClauses.push(`updated_by = $${paramIndex}`);
    values.push(req.user.id);
    paramIndex++;

    let result;
    if (existing.rows.length > 0) {
      setClauses.push(`WHERE id = $${paramIndex}`);
      values.push(existing.rows[0].id);

      result = await pool.query(`
        UPDATE clinical_settings SET ${setClauses.join(', ')} RETURNING *
      `, values);
    } else {
      // Insert new with all fields
      const allFields = Object.keys(updates);
      const fieldValues = allFields.map(() => `$${paramIndex++}`);
      fieldValues.push(`$${paramIndex++}`); // updated_by

      result = await pool.query(`
        INSERT INTO clinical_settings (${allFields.join(', ')}, updated_by)
        VALUES (${fieldValues.join(', ')})
        RETURNING *
      `, [...Object.values(updates), req.user.id]);
    }

    await logAudit(req.user.id, 'clinical_settings_updated', 'settings', result.rows[0].id, {}, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating clinical settings:', error);
    res.status(500).json({ error: 'Failed to update clinical settings' });
  }
});

/**
 * GET /settings/email
 * Get email settings
 */
adminRouter.get('/email', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_settings ORDER BY updated_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({ enabled: false });
    }
    // Don't return password
    const settings = { ...result.rows[0] };
    if (settings.smtp_password) {
      settings.smtp_password = '***hidden***';
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching email settings:', error);
    res.status(500).json({ error: 'Failed to fetch email settings' });
  }
});

/**
 * PUT /settings/email
 * Update email settings
 */
adminRouter.put('/email', async (req, res) => {
  try {
    const {
      smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password,
      from_name, from_email, reply_to_email, enabled, test_email
    } = req.body;

    const existing = await pool.query('SELECT id, smtp_password FROM email_settings LIMIT 1');

    let result;
    if (existing.rows.length > 0) {
      // Only update password if provided (don't overwrite with empty)
      const passwordValue = smtp_password === '***hidden***' || !smtp_password
        ? existing.rows[0].smtp_password
        : smtp_password;

      result = await pool.query(`
        UPDATE email_settings SET
          smtp_host = COALESCE($1, smtp_host),
          smtp_port = COALESCE($2, smtp_port),
          smtp_secure = COALESCE($3, smtp_secure),
          smtp_username = COALESCE($4, smtp_username),
          smtp_password = $5,
          from_name = COALESCE($6, from_name),
          from_email = COALESCE($7, from_email),
          reply_to_email = COALESCE($8, reply_to_email),
          enabled = COALESCE($9, enabled),
          test_email = COALESCE($10, test_email),
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $11
        WHERE id = $12
        RETURNING *
      `, [
        smtp_host, smtp_port, smtp_secure, smtp_username, passwordValue,
        from_name, from_email, reply_to_email, enabled, test_email,
        req.user.id, existing.rows[0].id
      ]);
    } else {
      result = await pool.query(`
        INSERT INTO email_settings (
          smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password,
          from_name, from_email, reply_to_email, enabled, test_email, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        smtp_host, smtp_port ?? 587, smtp_secure ?? true, smtp_username, smtp_password,
        from_name, from_email, reply_to_email, enabled ?? false, test_email,
        req.user.id
      ]);
    }

    // Don't return password
    const response = { ...result.rows[0] };
    if (response.smtp_password) {
      response.smtp_password = '***hidden***';
    }

    await logAudit(req.user.id, 'email_settings_updated', 'settings', result.rows[0].id, {}, req.ip);
    res.json(response);
  } catch (error) {
    console.error('Error updating email settings:', error);
    res.status(500).json({ error: 'Failed to update email settings' });
  }
});

/**
 * GET /settings/features
 * Get feature flags
 */
router.get('/features', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM feature_flags ORDER BY category, feature_key');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

/**
 * PUT /settings/features/:key
 * Update a feature flag
 */
adminRouter.put('/features/:key', [
  body('enabled').isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { key } = req.params;
    const { enabled, config_data } = req.body;

    const result = await pool.query(`
      UPDATE feature_flags 
      SET enabled = $1, 
          config_data = COALESCE($2, config_data),
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $3
      WHERE feature_key = $4
      RETURNING *
    `, [enabled, config_data ? JSON.stringify(config_data) : null, req.user.id, key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    await logAudit(req.user.id, 'feature_flag_updated', 'settings', key, { enabled }, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

/**
 * GET /settings/all
 * Get all settings at once
 */
router.get('/all', async (req, res) => {
  try {
    const [practice, security, clinical, email, features] = await Promise.all([
      pool.query('SELECT * FROM practice_settings ORDER BY updated_at DESC LIMIT 1'),
      pool.query('SELECT * FROM security_settings ORDER BY updated_at DESC LIMIT 1'),
      pool.query('SELECT * FROM clinical_settings ORDER BY updated_at DESC LIMIT 1'),
      pool.query('SELECT * FROM email_settings ORDER BY updated_at DESC LIMIT 1'),
      pool.query('SELECT * FROM feature_flags ORDER BY category, feature_key')
    ]);

    // Hide passwords
    const emailSettings = email.rows[0] ? { ...email.rows[0] } : null;
    if (emailSettings && emailSettings.smtp_password) {
      emailSettings.smtp_password = '***hidden***';
    }

    res.json({
      practice: practice.rows[0] || null,
      security: security.rows[0] || null,
      clinical: clinical.rows[0] || null,
      email: emailSettings,
      features: features.rows
    });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.use('/', adminRouter);

module.exports = router;






