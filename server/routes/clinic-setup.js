/**
 * Clinic Setup & Onboarding Routes
 * Manages clinic setup checklist, fax numbers, and lab interfaces
 */

const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/clinic-setup/:tenantId
 * Get setup checklist and integration status for a clinic
 */
router.get('/:tenantId', requireRole('admin'), async (req, res) => {
    try {
        const { tenantId } = req.params;

        // Get or create checklist
        let checklist = await pool.query(
            'SELECT * FROM clinic_setup_checklist WHERE tenant_id = $1',
            [tenantId]
        );

        if (checklist.rows.length === 0) {
            // Create checklist if doesn't exist
            await pool.query(
                'INSERT INTO clinic_setup_checklist (tenant_id) VALUES ($1)',
                [tenantId]
            );
            checklist = await pool.query(
                'SELECT * FROM clinic_setup_checklist WHERE tenant_id = $1',
                [tenantId]
            );
        }

        // Get fax numbers
        const faxNumbers = await pool.query(
            'SELECT * FROM clinic_fax_numbers WHERE tenant_id = $1 ORDER BY created_at',
            [tenantId]
        );

        // Get lab interfaces
        const labInterfaces = await pool.query(
            'SELECT * FROM clinic_lab_interfaces WHERE tenant_id = $1 ORDER BY lab_name',
            [tenantId]
        );

        // Calculate completion percentage
        const cl = checklist.rows[0];
        const items = [
            cl.basic_info_complete,
            cl.users_created,
            cl.fax_configured,
            cl.quest_configured || cl.labcorp_configured, // At least one lab
            cl.patient_portal_enabled,
            cl.billing_configured
        ];
        const completedCount = items.filter(Boolean).length;
        const completionPercent = Math.round((completedCount / items.length) * 100);

        res.json({
            checklist: checklist.rows[0],
            faxNumbers: faxNumbers.rows,
            labInterfaces: labInterfaces.rows,
            completionPercent,
            isComplete: completionPercent === 100
        });
    } catch (error) {
        console.error('[CLINIC-SETUP] Error getting setup:', error);
        res.status(500).json({ error: 'Failed to get clinic setup' });
    }
});

/**
 * PUT /api/clinic-setup/:tenantId
 * Update checklist item
 */
router.put('/:tenantId', requireRole('admin'), async (req, res) => {
    try {
        const { tenantId } = req.params;
        const updates = req.body;

        // Build dynamic update query
        const allowedFields = [
            'basic_info_complete', 'users_created', 'fax_configured',
            'quest_configured', 'labcorp_configured', 'patient_portal_enabled',
            'billing_configured', 'eprescribe_configured', 'onboarding_complete'
        ];

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;

                // Also set the date if marking complete
                if (value === true) {
                    setClauses.push(`${key.replace('_complete', '_date').replace('_configured', '_date').replace('_enabled', '_date')} = CURRENT_TIMESTAMP`);
                }
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(tenantId);

        const result = await pool.query(
            `UPDATE clinic_setup_checklist 
             SET ${setClauses.join(', ')}
             WHERE tenant_id = $${paramIndex}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Checklist not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('[CLINIC-SETUP] Error updating checklist:', error);
        res.status(500).json({ error: 'Failed to update checklist' });
    }
});

// ============ FAX NUMBER MANAGEMENT ============

/**
 * POST /api/clinic-setup/:tenantId/fax
 * Add fax number to clinic
 */
router.post('/:tenantId/fax', requireRole('admin'), async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { phoneNumber, provider = 'telnyx', label } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'phoneNumber is required' });
        }

        // Normalize phone number (remove non-digits, ensure +1 prefix)
        let normalized = phoneNumber.replace(/\D/g, '');
        if (normalized.length === 10) normalized = '1' + normalized;
        if (!normalized.startsWith('+')) normalized = '+' + normalized;

        const result = await pool.query(
            `INSERT INTO clinic_fax_numbers (tenant_id, phone_number, provider, label)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [tenantId, normalized, provider, label]
        );

        // Update checklist
        await pool.query(
            `UPDATE clinic_setup_checklist 
             SET fax_configured = true, fax_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE tenant_id = $1`,
            [tenantId]
        );

        console.log('[CLINIC-SETUP] Added fax number:', { tenantId, phoneNumber: normalized });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'This fax number is already assigned to a clinic' });
        }
        console.error('[CLINIC-SETUP] Error adding fax:', error);
        res.status(500).json({ error: 'Failed to add fax number' });
    }
});

/**
 * DELETE /api/clinic-setup/:tenantId/fax/:faxId
 * Remove fax number from clinic
 */
router.delete('/:tenantId/fax/:faxId', requireRole('admin'), async (req, res) => {
    try {
        const { tenantId, faxId } = req.params;

        const result = await pool.query(
            'DELETE FROM clinic_fax_numbers WHERE id = $1 AND tenant_id = $2 RETURNING *',
            [faxId, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Fax number not found' });
        }

        // Check if any fax numbers remain
        const remaining = await pool.query(
            'SELECT COUNT(*) FROM clinic_fax_numbers WHERE tenant_id = $1',
            [tenantId]
        );

        if (parseInt(remaining.rows[0].count) === 0) {
            await pool.query(
                `UPDATE clinic_setup_checklist 
                 SET fax_configured = false, updated_at = CURRENT_TIMESTAMP
                 WHERE tenant_id = $1`,
                [tenantId]
            );
        }

        res.json({ success: true, deleted: result.rows[0] });
    } catch (error) {
        console.error('[CLINIC-SETUP] Error removing fax:', error);
        res.status(500).json({ error: 'Failed to remove fax number' });
    }
});

// ============ LAB INTERFACE MANAGEMENT ============

/**
 * POST /api/clinic-setup/:tenantId/lab
 * Add lab interface configuration
 */
router.post('/:tenantId/lab', requireRole('admin'), async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { labName, facilityId, accountNumber, npi, contactName, contactPhone, notes } = req.body;

        if (!labName) {
            return res.status(400).json({ error: 'labName is required' });
        }

        const result = await pool.query(
            `INSERT INTO clinic_lab_interfaces 
             (tenant_id, lab_name, facility_id, account_number, npi, contact_name, contact_phone, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [tenantId, labName, facilityId, accountNumber, npi, contactName, contactPhone, notes]
        );

        // Update checklist based on lab name
        const checklistField = labName.toLowerCase().includes('quest') ? 'quest_configured' :
            labName.toLowerCase().includes('labcorp') ? 'labcorp_configured' : null;

        if (checklistField) {
            await pool.query(
                `UPDATE clinic_setup_checklist 
                 SET ${checklistField} = true, ${checklistField.replace('_configured', '_date')} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE tenant_id = $1`,
                [tenantId]
            );
        }

        console.log('[CLINIC-SETUP] Added lab interface:', { tenantId, labName });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('[CLINIC-SETUP] Error adding lab:', error);
        res.status(500).json({ error: 'Failed to add lab interface' });
    }
});

/**
 * PUT /api/clinic-setup/:tenantId/lab/:labId
 * Update lab interface
 */
router.put('/:tenantId/lab/:labId', requireRole('admin'), async (req, res) => {
    try {
        const { tenantId, labId } = req.params;
        const { facilityId, accountNumber, npi, contactName, contactPhone, status, notes } = req.body;

        const result = await pool.query(
            `UPDATE clinic_lab_interfaces 
             SET facility_id = COALESCE($1, facility_id),
                 account_number = COALESCE($2, account_number),
                 npi = COALESCE($3, npi),
                 contact_name = COALESCE($4, contact_name),
                 contact_phone = COALESCE($5, contact_phone),
                 status = COALESCE($6, status),
                 notes = COALESCE($7, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 AND tenant_id = $9
             RETURNING *`,
            [facilityId, accountNumber, npi, contactName, contactPhone, status, notes, labId, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lab interface not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('[CLINIC-SETUP] Error updating lab:', error);
        res.status(500).json({ error: 'Failed to update lab interface' });
    }
});

/**
 * DELETE /api/clinic-setup/:tenantId/lab/:labId
 * Remove lab interface
 */
router.delete('/:tenantId/lab/:labId', requireRole('admin'), async (req, res) => {
    try {
        const { tenantId, labId } = req.params;

        const result = await pool.query(
            'DELETE FROM clinic_lab_interfaces WHERE id = $1 AND tenant_id = $2 RETURNING *',
            [labId, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lab interface not found' });
        }

        res.json({ success: true, deleted: result.rows[0] });
    } catch (error) {
        console.error('[CLINIC-SETUP] Error removing lab:', error);
        res.status(500).json({ error: 'Failed to remove lab interface' });
    }
});

// ============ LOOKUP HELPERS (for eFax/HL7 routing) ============

/**
 * Lookup tenant by fax number (used by efax webhook)
 */
async function getTenantByFaxNumber(phoneNumber) {
    // Normalize
    let normalized = phoneNumber.replace(/\D/g, '');
    if (normalized.length === 10) normalized = '1' + normalized;
    if (!normalized.startsWith('+')) normalized = '+' + normalized;

    const result = await pool.query(
        'SELECT tenant_id FROM clinic_fax_numbers WHERE phone_number = $1 AND active = true',
        [normalized]
    );

    return result.rows[0]?.tenant_id || null;
}

/**
 * Lookup tenant by lab facility ID (used by HL7 receiver)
 */
async function getTenantByLabFacility(facilityId) {
    const result = await pool.query(
        'SELECT tenant_id FROM clinic_lab_interfaces WHERE facility_id = $1 AND status = $2',
        [facilityId, 'active']
    );

    return result.rows[0]?.tenant_id || null;
}

module.exports = router;
module.exports.getTenantByFaxNumber = getTenantByFaxNumber;
module.exports.getTenantByLabFacility = getTenantByLabFacility;
