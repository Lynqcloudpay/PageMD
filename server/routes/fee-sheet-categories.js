const express = require('express');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// FEE SHEET CATEGORIES API
// OpenEMR-inspired quick-access code groups
// ============================================

/**
 * GET /api/fee-sheet-categories
 * Get all active fee sheet categories with their codes
 */
router.get('/', requirePermission('billing:view'), async (req, res) => {
    try {
        const categoriesResult = await pool.query(`
            SELECT 
                c.id, c.name, c.description, c.display_order, c.is_active,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', cc.id,
                            'code_type', cc.code_type,
                            'code', cc.code,
                            'description', cc.description,
                            'default_modifier', cc.default_modifier,
                            'default_units', cc.default_units,
                            'default_fee', cc.default_fee,
                            'display_order', cc.display_order
                        ) ORDER BY cc.display_order
                    ) FILTER (WHERE cc.id IS NOT NULL AND cc.is_active = true),
                    '[]'
                ) as codes
            FROM fee_sheet_categories c
            LEFT JOIN fee_sheet_category_codes cc ON c.id = cc.category_id
            WHERE c.is_active = true
            GROUP BY c.id
            ORDER BY c.display_order, c.name
        `);

        res.json(categoriesResult.rows);
    } catch (error) {
        console.error('Error fetching fee sheet categories:', error);
        res.status(500).json({ error: 'Failed to fetch fee sheet categories' });
    }
});

/**
 * GET /api/fee-sheet-categories/:id
 * Get a single category with its codes
 */
router.get('/:id', requirePermission('billing:view'), async (req, res) => {
    try {
        const { id } = req.params;

        const categoryResult = await pool.query(`
            SELECT id, name, description, display_order, is_active
            FROM fee_sheet_categories
            WHERE id = $1
        `, [id]);

        if (categoryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const codesResult = await pool.query(`
            SELECT id, code_type, code, description, default_modifier, 
                   default_units, default_fee, display_order, is_active
            FROM fee_sheet_category_codes
            WHERE category_id = $1
            ORDER BY display_order
        `, [id]);

        res.json({
            ...categoryResult.rows[0],
            codes: codesResult.rows
        });
    } catch (error) {
        console.error('Error fetching fee sheet category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

/**
 * POST /api/fee-sheet-categories
 * Create a new fee sheet category
 */
router.post('/', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, description, display_order, codes } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        await client.query('BEGIN');

        // Create category
        const categoryResult = await client.query(`
            INSERT INTO fee_sheet_categories (name, description, display_order, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, description || null, display_order || 0, req.user.id]);

        const category = categoryResult.rows[0];

        // Add codes if provided
        if (codes && Array.isArray(codes) && codes.length > 0) {
            for (let i = 0; i < codes.length; i++) {
                const code = codes[i];
                await client.query(`
                    INSERT INTO fee_sheet_category_codes 
                    (category_id, code_type, code, description, default_modifier, 
                     default_units, default_fee, display_order)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    category.id,
                    code.code_type || 'CPT',
                    code.code,
                    code.description || null,
                    code.default_modifier || null,
                    code.default_units || 1,
                    code.default_fee || null,
                    code.display_order || i
                ]);
            }
        }

        await client.query('COMMIT');

        // Log audit
        logAudit(req, 'fee_sheet_category', 'CREATE', category.id, null, { name });

        res.status(201).json(category);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating fee sheet category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/fee-sheet-categories/:id
 * Update a fee sheet category
 */
router.put('/:id', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, description, display_order, is_active, codes } = req.body;

        await client.query('BEGIN');

        // Update category
        const updateResult = await client.query(`
            UPDATE fee_sheet_categories
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                display_order = COALESCE($3, display_order),
                is_active = COALESCE($4, is_active),
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [name, description, display_order, is_active, id]);

        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Category not found' });
        }

        // Update codes if provided (replace all)
        if (codes && Array.isArray(codes)) {
            // Deactivate existing codes
            await client.query(`
                UPDATE fee_sheet_category_codes SET is_active = false WHERE category_id = $1
            `, [id]);

            // Insert/update new codes
            for (let i = 0; i < codes.length; i++) {
                const code = codes[i];
                if (code.id) {
                    // Update existing
                    await client.query(`
                        UPDATE fee_sheet_category_codes
                        SET code_type = $1, code = $2, description = $3,
                            default_modifier = $4, default_units = $5, default_fee = $6,
                            display_order = $7, is_active = true
                        WHERE id = $8
                    `, [
                        code.code_type || 'CPT', code.code, code.description,
                        code.default_modifier, code.default_units || 1, code.default_fee,
                        code.display_order || i, code.id
                    ]);
                } else {
                    // Insert new
                    await client.query(`
                        INSERT INTO fee_sheet_category_codes 
                        (category_id, code_type, code, description, default_modifier, 
                         default_units, default_fee, display_order)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        id, code.code_type || 'CPT', code.code, code.description,
                        code.default_modifier, code.default_units || 1, code.default_fee,
                        code.display_order || i
                    ]);
                }
            }
        }

        await client.query('COMMIT');

        logAudit(req, 'fee_sheet_category', 'UPDATE', id, null, { name });

        res.json(updateResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating fee sheet category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    } finally {
        client.release();
    }
});

/**
 * DELETE /api/fee-sheet-categories/:id
 * Soft delete (deactivate) a category
 */
router.delete('/:id', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE fee_sheet_categories
            SET is_active = false, updated_at = NOW()
            WHERE id = $1
            RETURNING id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        logAudit(req, 'fee_sheet_category', 'DELETE', id);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting fee sheet category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

/**
 * POST /api/fee-sheet-categories/:id/add-to-superbill
 * Add all codes from a category to a superbill
 */
router.post('/:id/add-to-superbill', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { superbill_id } = req.body;

        if (!superbill_id) {
            return res.status(400).json({ error: 'superbill_id is required' });
        }

        await client.query('BEGIN');

        // Get category codes
        const codesResult = await client.query(`
            SELECT code_type, code, description, default_modifier, default_units, default_fee
            FROM fee_sheet_category_codes
            WHERE category_id = $1 AND is_active = true
            ORDER BY display_order
        `, [id]);

        if (codesResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No active codes in this category' });
        }

        // Get superbill service date
        const superbillResult = await client.query(`
            SELECT service_date_from FROM superbills WHERE id = $1
        `, [superbill_id]);

        if (superbillResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Superbill not found' });
        }

        const serviceDate = superbillResult.rows[0].service_date_from;
        const addedLines = [];

        // Add each code as a superbill line (prevent duplicates)
        for (const code of codesResult.rows) {
            // Check if this CPT already exists on the superbill
            const existsCheck = await client.query(
                'SELECT id FROM superbill_lines WHERE superbill_id = $1 AND cpt_code = $2',
                [superbill_id, code.code]
            );
            if (existsCheck.rows.length > 0) {
                continue; // Skip duplicates
            }

            const insertResult = await client.query(`
                INSERT INTO superbill_lines 
                (superbill_id, cpt_code, description, modifier1, units, charge, service_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                superbill_id,
                code.code,
                code.description,
                code.default_modifier || null,
                code.default_units || 1,
                code.default_fee || 0,
                serviceDate
            ]);
            addedLines.push(insertResult.rows[0]);
        }

        // Update superbill version
        await client.query(`
            UPDATE superbills 
            SET version = version + 1, updated_at = NOW(), updated_by = $1
            WHERE id = $2
        `, [req.user.id, superbill_id]);

        await client.query('COMMIT');

        logAudit(req, 'superbill', 'ADD_CATEGORY_CODES', superbill_id, null, {
            category_id: id,
            codes_added: addedLines.length
        });

        res.json({
            success: true,
            lines_added: addedLines.length,
            lines: addedLines
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding category codes to superbill:', error);
        res.status(500).json({ error: 'Failed to add codes to superbill' });
    } finally {
        client.release();
    }
});

/**
 * POST /api/fee-sheet-categories/seed-defaults
 * Seed default categories (New Patient, Established Patient, etc.)
 */
router.post('/seed-defaults', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const defaultCategories = [
            {
                name: 'New Patient',
                description: 'E/M codes for new patient visits',
                codes: [
                    { code: '99201', description: 'Office visit - new patient, minimal', default_fee: 50.00 },
                    { code: '99202', description: 'Office visit - new patient, low complexity', default_fee: 85.00 },
                    { code: '99203', description: 'Office visit - new patient, moderate complexity', default_fee: 130.00 },
                    { code: '99204', description: 'Office visit - new patient, high complexity', default_fee: 195.00 },
                    { code: '99205', description: 'Office visit - new patient, comprehensive', default_fee: 260.00 }
                ]
            },
            {
                name: 'Established Patient',
                description: 'E/M codes for established patient visits',
                codes: [
                    { code: '99211', description: 'Office visit - established patient, minimal', default_fee: 25.00 },
                    { code: '99212', description: 'Office visit - established patient, straightforward', default_fee: 55.00 },
                    { code: '99213', description: 'Office visit - established patient, low complexity', default_fee: 95.00 },
                    { code: '99214', description: 'Office visit - established patient, moderate complexity', default_fee: 145.00 },
                    { code: '99215', description: 'Office visit - established patient, high complexity', default_fee: 200.00 }
                ]
            },
            {
                name: 'Preventive Care',
                description: 'Wellness and preventive visit codes',
                codes: [
                    { code: '99381', description: 'Preventive visit - infant (under 1 year)', default_fee: 150.00 },
                    { code: '99385', description: 'Preventive visit - 18-39 years (new)', default_fee: 175.00 },
                    { code: '99386', description: 'Preventive visit - 40-64 years (new)', default_fee: 200.00 },
                    { code: '99387', description: 'Preventive visit - 65+ years (new)', default_fee: 225.00 },
                    { code: '99395', description: 'Preventive visit - 18-39 years (established)', default_fee: 150.00 },
                    { code: '99396', description: 'Preventive visit - 40-64 years (established)', default_fee: 175.00 },
                    { code: '99397', description: 'Preventive visit - 65+ years (established)', default_fee: 200.00 }
                ]
            },
            {
                name: 'Procedures',
                description: 'Common office procedures',
                codes: [
                    { code: '36415', description: 'Venipuncture', default_fee: 10.00 },
                    { code: '93000', description: 'Electrocardiogram (ECG/EKG)', default_fee: 35.00 },
                    { code: '94010', description: 'Spirometry', default_fee: 40.00 },
                    { code: '81002', description: 'Urinalysis, non-automated', default_fee: 8.00 },
                    { code: '36000', description: 'IV access', default_fee: 25.00 }
                ]
            }
        ];

        for (let catIdx = 0; catIdx < defaultCategories.length; catIdx++) {
            const cat = defaultCategories[catIdx];

            // Check if category exists
            const existsResult = await client.query(
                'SELECT id FROM fee_sheet_categories WHERE name = $1',
                [cat.name]
            );

            let categoryId;
            if (existsResult.rows.length > 0) {
                categoryId = existsResult.rows[0].id;
            } else {
                const insertCat = await client.query(`
                    INSERT INTO fee_sheet_categories (name, description, display_order, created_by)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [cat.name, cat.description, catIdx, req.user.id]);
                categoryId = insertCat.rows[0].id;
            }

            // Add codes
            for (let codeIdx = 0; codeIdx < cat.codes.length; codeIdx++) {
                const code = cat.codes[codeIdx];
                await client.query(`
                    INSERT INTO fee_sheet_category_codes 
                    (category_id, code_type, code, description, default_fee, display_order)
                    VALUES ($1, 'CPT', $2, $3, $4, $5)
                    ON CONFLICT (category_id, code_type, code) DO UPDATE
                    SET description = EXCLUDED.description, default_fee = EXCLUDED.default_fee
                `, [categoryId, code.code, code.description, code.default_fee, codeIdx]);
            }
        }

        await client.query('COMMIT');

        res.json({ success: true, message: 'Default categories seeded successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error seeding default categories:', error);
        res.status(500).json({ error: 'Failed to seed default categories' });
    } finally {
        client.release();
    }
});

module.exports = router;
