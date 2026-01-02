const express = require('express');
const router = express.Router();
const pool = require('../db');
const nodemailer = require('nodemailer');

// Configure email transporter (using environment variables)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Sales notification email
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

        // Send email notification to sales team
        const interestLabel = {
            'demo': 'Demo Request',
            'sandbox': 'Sandbox Access',
            'pricing': 'Pricing Information',
            'enterprise': 'Enterprise Solutions',
            'starter': 'Starter Plan',
            'professional': 'Professional Plan',
            'other': 'General Inquiry'
        }[interest] || interest;

        const emailHtml = `
            <h2>New Sales Inquiry - ${interestLabel}</h2>
            <p><strong>Source:</strong> ${source || 'Website'}</p>
            <hr />
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <p><strong>Practice:</strong> ${practice || 'Not provided'}</p>
            <p><strong>Providers:</strong> ${providers || 'Not specified'}</p>
            <hr />
            <p><strong>Interest:</strong> ${interestLabel}</p>
            <p><strong>Message:</strong></p>
            <p>${message || 'No additional message'}</p>
            <hr />
            <p><em>Submitted: ${new Date().toLocaleString()}</em></p>
            <p><em>Inquiry ID: ${inquiry.id}</em></p>
        `;

        try {
            await transporter.sendMail({
                from: `"PageMD Sales" <${process.env.SMTP_USER || 'noreply@pagemdemr.com'}>`,
                to: SALES_EMAIL,
                subject: `New Inquiry: ${interestLabel} from ${name}`,
                html: emailHtml
            });
            console.log(`Sales notification sent for inquiry ${inquiry.id}`);
        } catch (emailError) {
            // Log email error but don't fail the request
            console.error('Failed to send sales notification email:', emailError.message);
        }

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
 * Get all sales inquiries (for admin dashboard - requires auth)
 */
router.get('/inquiries', async (req, res) => {
    try {
        // TODO: Add authentication check for admin users
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
