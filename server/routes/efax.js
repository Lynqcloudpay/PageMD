/**
 * eFax Integration Routes (Telnyx / Phaxio)
 * Receives incoming faxes via webhook and creates documents/inbox items
 * 
 * Telnyx: $0.007/page - CHEAPEST
 * Phaxio: $0.07/page - Fallback
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure upload directory for faxes
const faxDir = process.env.FAX_DIR || './uploads/fax';
if (!fs.existsSync(faxDir)) {
    fs.mkdirSync(faxDir, { recursive: true });
}

// Multer storage for fax files
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, faxDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
        cb(null, `fax-${uniqueSuffix}${path.extname(file.originalname) || '.pdf'}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

/**
 * Download file from URL and save locally
 */
async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

/**
 * POST /api/efax/receive
 * Webhook endpoint for Telnyx or Phaxio
 * 
 * TELNYX format (JSON):
 * {
 *   "data": {
 *     "event_type": "fax.received",
 *     "payload": { "fax_id", "from", "to", "page_count", "media_url" }
 *   }
 * }
 * 
 * PHAXIO format (multipart): fax file, from_number, to_number, num_pages, fax_id
 */
router.post('/receive', upload.single('fax'), async (req, res) => {
    console.log('[EFAX] Received webhook:', {
        contentType: req.headers['content-type'],
        hasFile: !!req.file,
        bodyKeys: Object.keys(req.body || {})
    });

    try {
        let fromNumber, toNumber, numPages, faxId, filePath, filename;

        // Detect provider by request format
        if (req.body?.data?.event_type || req.body?.event_type) {
            // TELNYX format
            const payload = req.body.data?.payload || req.body.payload || req.body;

            if (payload.event_type === 'fax.received' || req.body.data?.event_type === 'fax.received') {
                const faxData = payload.fax || payload;
                fromNumber = faxData.from || 'Unknown';
                toNumber = faxData.to || process.env.FAX_NUMBER || 'Unknown';
                numPages = faxData.page_count || faxData.pages || 1;
                faxId = faxData.fax_id || faxData.id || `telnyx-${Date.now()}`;

                const mediaUrl = faxData.media_url || faxData.pdf_url;
                if (mediaUrl) {
                    filename = `fax-${faxId}.pdf`;
                    filePath = path.join(faxDir, filename);
                    console.log('[EFAX] Downloading fax from:', mediaUrl);
                    await downloadFile(mediaUrl, filePath);
                }
            } else {
                console.log('[EFAX] Non-fax.received event:', req.body.data?.event_type);
                return res.status(200).json({ success: true, message: 'Event acknowledged' });
            }
        } else if (req.file || req.body.from_number) {
            // PHAXIO format
            fromNumber = req.body.from_number || 'Unknown';
            toNumber = req.body.to_number || process.env.FAX_NUMBER || 'Unknown';
            numPages = req.body.num_pages || 1;
            faxId = req.body.fax_id || `phaxio-${Date.now()}`;

            if (req.file) {
                filePath = req.file.path;
                filename = req.file.filename;
            } else if (req.body.file_url) {
                filename = `fax-${faxId}.pdf`;
                filePath = path.join(faxDir, filename);
                await downloadFile(req.body.file_url, filePath);
            }
        } else {
            console.log('[EFAX] Unknown webhook format');
            return res.status(200).json({ success: true, message: 'Format not recognized' });
        }

        if (!filePath) {
            return res.status(200).json({ success: true, message: 'No file to process' });
        }

        // TENANT-SAFE: Look up tenant by the receiving fax number
        let tenantId = 'default';
        try {
            // Normalize the to_number for lookup
            let normalizedTo = toNumber.replace(/\D/g, '');
            if (normalizedTo.length === 10) normalizedTo = '+1' + normalizedTo;
            else if (normalizedTo.length === 11 && normalizedTo.startsWith('1')) normalizedTo = '+' + normalizedTo;
            else if (!normalizedTo.startsWith('+')) normalizedTo = '+' + normalizedTo;

            const tenantLookup = await pool.query(
                'SELECT tenant_id FROM clinic_fax_numbers WHERE phone_number = $1 AND active = true',
                [normalizedTo]
            );
            if (tenantLookup.rows.length > 0) {
                tenantId = tenantLookup.rows[0].tenant_id;
                console.log('[EFAX] Routed to tenant:', tenantId);
            } else {
                console.warn('[EFAX] No tenant found for fax number:', toNumber, '- using default');
            }
        } catch (lookupErr) {
            console.error('[EFAX] Tenant lookup error:', lookupErr.message);
        }

        // Create document entry
        const docResult = await pool.query(`
            INSERT INTO documents (
                filename, file_path, mime_type, doc_type, 
                source, source_reference, comments, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            RETURNING id
        `, [
            `📠 Fax from ${fromNumber} (${numPages} pages)`,
            filePath,
            'application/pdf',
            'fax',
            'efax',
            faxId,
            JSON.stringify({
                from_number: fromNumber,
                to_number: toNumber,
                num_pages: numPages,
                received_at: new Date().toISOString(),
                provider: req.body?.data?.event_type ? 'telnyx' : 'phaxio'
            })
        ]);

        const documentId = docResult.rows[0].id;

        // Create inbox item
        await pool.query(`
            INSERT INTO inbox_items (
                id, tenant_id, type, priority, status,
                subject, body, reference_id, reference_table,
                created_at, updated_at
            ) VALUES (
                gen_random_uuid(), $1, 'document', 'normal', 'new',
                $2, $3, $4, 'documents',
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        `, [
            tenantId,
            `📠 Fax from ${fromNumber}`,
            `Received ${numPages} page fax. Review and assign to patient.`,
            documentId
        ]);

        console.log('[EFAX] Processed fax:', { documentId, fromNumber, numPages, faxId });

        res.status(200).json({ success: true, documentId });

    } catch (error) {
        console.error('[EFAX] Error:', error);
        res.status(500).json({ error: 'Failed to process fax', message: error.message });
    }
});

/**
 * GET /api/efax/status
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        const provider = process.env.TELNYX_API_KEY ? 'Telnyx' :
            process.env.PHAXIO_API_KEY ? 'Phaxio' : 'Not configured';

        const recentFaxes = await pool.query(`
            SELECT COUNT(*) as count FROM documents 
            WHERE source = 'efax' 
            AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        `);

        res.json({
            provider,
            faxNumber: process.env.FAX_NUMBER || 'Not configured',
            webhookUrl: `${process.env.API_URL || 'https://pagemdemr.com'}/api/efax/receive`,
            recentFaxCount: parseInt(recentFaxes.rows[0]?.count || 0),
            pricing: provider === 'Telnyx' ? '$0.007/page' : provider === 'Phaxio' ? '$0.07/page' : 'N/A'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
    }
});

/**
 * GET /api/efax/unassigned
 */
router.get('/unassigned', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT d.*, i.id as inbox_item_id, i.status as inbox_status
            FROM documents d
            LEFT JOIN inbox_items i ON i.reference_id = d.id AND i.reference_table = 'documents'
            WHERE d.source = 'efax' AND d.patient_id IS NULL
            ORDER BY d.created_at DESC LIMIT 50
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get unassigned faxes' });
    }
});

/**
 * PUT /api/efax/:documentId/assign
 */
router.put('/:documentId/assign', authenticate, async (req, res) => {
    try {
        const { documentId } = req.params;
        const { patientId, docType } = req.body;

        if (!patientId) {
            return res.status(400).json({ error: 'patientId is required' });
        }

        const result = await pool.query(`
            UPDATE documents 
            SET patient_id = $1, doc_type = COALESCE($2, doc_type), updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 RETURNING *
        `, [patientId, docType, documentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        await pool.query(`
            UPDATE inbox_items 
            SET patient_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE reference_id = $2 AND reference_table = 'documents'
        `, [patientId, documentId]);

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign fax' });
    }
});

module.exports = router;
