const express = require('express');
const router = express.Router();
const pool = require('../db');

// Email functionality disabled for now - focus on dashboard
// To enable, install nodemailer: npm install nodemailer
const SALES_EMAIL = process.env.SALES_EMAIL || 'pagemdemr@outlook.com';

/**
 * POST /api/sales/inquiry
 * Submit a sales inquiry for sandbox access, demo, or pricing
 */
router.post('/inquiry', async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            practice,
            providers,
            message,
            interest,
            source // e.g., 'pricing_page', 'contact_page', 'landing_page'
        } = req.body;

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        // Store inquiry in database
        const result = await pool.query(`
            INSERT INTO sales_inquiries (
                name, email, phone, practice_name, provider_count,
                message, interest_type, source, status, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', NOW())
            RETURNING id, created_at
        `, [name, email, phone, practice, providers, message, interest, source]);

        const inquiry = result.rows[0];

        // Log the inquiry for tracking
        console.log(`New sales inquiry #${inquiry.id}: ${name} (${email}) - Interest: ${interest}`);

        res.status(201).json({
            success: true,
            message: 'Thank you for your interest! Our team will contact you within 1 business day.',
            inquiryId: inquiry.id
        });

    } catch (error) {
        console.error('Error submitting sales inquiry:', error);
        res.status(500).json({ error: 'Failed to submit inquiry. Please try again.' });
    }
});

/**
 * GET /api/sales/inquiries
 * Get all sales inquiries (for admin dashboard)
 */
router.get('/inquiries', async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT * FROM sales_inquiries
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            inquiries: result.rows,
            total: result.rowCount
        });

    } catch (error) {
        console.error('Error fetching sales inquiries:', error);
        res.status(500).json({ error: 'Failed to fetch inquiries' });
    }
});

/**
 * PATCH /api/sales/inquiries/:id
 * Update inquiry status (for admin)
 */
router.patch('/inquiries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const result = await pool.query(`
            UPDATE sales_inquiries
            SET status = COALESCE($1, status),
                notes = COALESCE($2, notes),
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [status, notes, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inquiry not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error updating inquiry:', error);
        res.status(500).json({ error: 'Failed to update inquiry' });
    }
});

module.exports = router;
