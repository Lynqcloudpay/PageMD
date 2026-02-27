/**
 * Echo API Routes
 * 
 * REST endpoints for the Echo AI Clinical Assistant.
 * All routes require authentication and the 'ai.echo' permission.
 */

const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const echoService = require('../services/echoService');
const echoTrendEngine = require('../services/echoTrendEngine');
const echoContextEngine = require('../services/echoContextEngine');
const echoCDSEngine = require('../services/echoCDSEngine');
const { syncInboxItems } = require('./inbasket');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require auth
router.use(authenticate);

// ─── Chat Endpoint ──────────────────────────────────────────────────────────

/**
 * POST /api/echo/chat
 * Main chat endpoint for Echo interactions
 */
router.post('/chat', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { message, patientId, conversationId, uiContext, attachments } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await echoService.chat({
            message: message.trim(),
            patientId: patientId || null,
            conversationId: conversationId || null,
            user: req.user,
            clinicName: req.clinic?.name || null,
            uiContext: uiContext || null,
            attachments: attachments || null
        });

        res.json({
            success: true,
            response: result.response,
            conversationId: result.conversationId,
            toolCalls: result.toolCalls,
            usage: result.usage,
            visualizations: result.visualizations || []
        });

    } catch (err) {
        console.error('[Echo API] Chat error:', err);
        res.status(500).json({ error: 'Echo encountered an error. Please try again.' });
    }
});

/**
 * POST /api/echo/transcribe
 * Transcribe clinical audio using Whisper
 */
router.post('/transcribe', requirePermission('ai.echo'), upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            console.warn('[Echo API] Transcribe called without audio file. Check multipart headers.');
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const transcription = await echoService.transcribeAudio(req.file.buffer, req.file.originalname);
        res.json({ success: true, text: transcription });
    } catch (err) {
        console.error('[Echo API] Transcribe error details:', {
            message: err.message,
            stack: err.stack,
            fileName: req.file?.originalname,
            fileSize: req.file?.size
        });
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

/**
 * POST /api/echo/commit
 * Execute a staged clinical action after provider approval
 */
router.post('/commit', requirePermission('ai.echo'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { type, payload, actions, conversationId } = req.body;
        const userId = req.user.id;
        const tenantId = req.user.clinic_id;

        // Normalize to array of actions
        const actionsToCommit = actions && Array.isArray(actions)
            ? actions
            : (type && payload ? [{ type, payload }] : []);

        if (actionsToCommit.length === 0) {
            return res.status(400).json({ error: 'Actions are required' });
        }

        await client.query('BEGIN');
        const results = [];

        // Log the active search path for diagnostics
        const schemaRes = await client.query('SHOW search_path');
        console.log(`[Echo Commit] Active search_path:`, schemaRes.rows[0].search_path);

        for (const action of actionsToCommit) {
            const { type: actType, payload: actPayload } = action;
            let record;

            console.log(`[Echo Commit] Executing ${actType}:`, JSON.stringify(actPayload));

            try {
                switch (actType) {
                    case 'add_problem':
                        record = await client.query(
                            `INSERT INTO problems (patient_id, problem_name, icd10_code, status)
                             VALUES ($1, $2, $3, $4) RETURNING *`,
                            [actPayload.patient_id, actPayload.problem_name, actPayload.icd10_code, actPayload.status]
                        );
                        break;

                    case 'add_medication':
                        record = await client.query(
                            `INSERT INTO medications (patient_id, medication_name, dosage, frequency, route, prescriber_id, active, status)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                            [actPayload.patient_id, actPayload.medication_name, actPayload.dosage, actPayload.frequency,
                            actPayload.route, userId, true, 'active']
                        );
                        break;

                    case 'create_order':
                        record = await client.query(
                            `INSERT INTO orders (patient_id, order_type, ordered_by, test_name, order_payload)
                             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                            [actPayload.patient_id, actPayload.order_type, userId, actPayload.test_name, actPayload.order_payload]
                        );
                        break;

                    // ── Phase 5: Operational Actions ────────────────────────
                    case 'send_message':
                        if (actPayload.message_type === 'portal') {
                            // 1. Find or create thread
                            let threadId;
                            const existingThread = await client.query(
                                `SELECT id FROM portal_message_threads 
                                 WHERE patient_id = $1 
                                 ORDER BY last_message_at DESC LIMIT 1`,
                                [actPayload.patient_id]
                            );

                            if (existingThread.rows.length > 0) {
                                threadId = existingThread.rows[0].id;
                                await client.query(
                                    `UPDATE portal_message_threads 
                                     SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, status = 'open'
                                     WHERE id = $1`,
                                    [threadId]
                                );
                            } else {
                                const newThread = await client.query(
                                    `INSERT INTO portal_message_threads (patient_id, subject, assigned_user_id)
                                     VALUES ($1, $2, $3) RETURNING id`,
                                    [actPayload.patient_id, actPayload.subject || 'Message from your care team', userId]
                                );
                                threadId = newThread.rows[0].id;
                            }

                            // 2. Insert message
                            record = await client.query(
                                `INSERT INTO portal_messages (thread_id, sender_user_id, sender_id, sender_type, body)
                                 VALUES ($1, $2, $2, 'staff', $3) RETURNING *`,
                                [threadId, userId, actPayload.body]
                            );

                            // Trigger inbasket sync so it shows up in Clinical Inbox
                            try {
                                const schemaName = req.clinic?.schema_name || 'public';
                                await syncInboxItems(tenantId, schemaName, client);

                                // FORCE the AI-sent message to show up as 'new' in the inbox so provider can review it
                                await client.query(
                                    `UPDATE inbox_items SET status = 'new' WHERE reference_id = $1 AND reference_table = 'portal_message_threads'`,
                                    [threadId]
                                );
                            } catch (syncErr) {
                                console.warn('[Echo Commit] Inbasket sync failed (non-blocking):', syncErr.message);
                            }
                        } else {
                            // Internal message
                            record = await client.query(
                                `INSERT INTO messages (patient_id, from_user_id, to_user_id, subject, body, message_type, priority)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                                [actPayload.patient_id, userId, actPayload.to_user_id || userId, actPayload.subject, actPayload.body,
                                    'message', 'normal']
                            );

                            // Also sync internal messages so they surface
                            try {
                                const schemaName = req.clinic?.schema_name || 'public';
                                await syncInboxItems(tenantId, schemaName, client);
                            } catch (syncErr) {
                                console.warn('[Echo Commit] Internal Inbasket sync failed (non-blocking):', syncErr.message);
                            }
                        }
                        break;

                    case 'schedule_appointment':
                        record = await client.query(
                            `INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time,
                                appointment_type, duration, notes, status, patient_status, created_by, clinic_id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                            [actPayload.patient_id, userId, actPayload.appointment_date,
                            actPayload.appointment_time, actPayload.appointment_type,
                            actPayload.duration || 30, actPayload.reason || null,
                                'scheduled', 'scheduled', userId, tenantId]
                        );
                        break;

                    case 'create_reminder':
                        // Reminders now go directly to Patient Flags (Chart) as requested, 
                        // instead of clogging the In Basket as invisible messages.
                        // We provide a mandatory flag_type_id via subquery to ensure DB constraint satisfaction,
                        // but use custom_label 'REMINDER' which Snapshot.jsx prioritize for the blue UI.
                        record = await client.query(
                            `INSERT INTO patient_flags (
                                clinic_id, patient_id, flag_type_id, created_by_user_id,
                                note, custom_label, custom_severity, status
                            )
                            VALUES (
                                $1, $2, 
                                (SELECT id FROM flag_types WHERE label = 'Safety Concern' OR label = 'Critical Alert' OR label = 'Reminder' LIMIT 1),
                                $3, $4, $5, $6, 'active'
                            ) 
                            RETURNING *, note as body, custom_label as subject`,
                            [tenantId, actPayload.patient_id, userId,
                                actPayload.reminder_text, 'REMINDER', 'info']
                        );
                        break;
                }

                if (record && record.rows && record.rows[0]) {
                    results.push({ type: actType, record: record.rows[0] });
                } else {
                    console.warn(`[Echo Commit] No record created for ${actType}`);
                }
            } catch (dbErr) {
                console.error(`[Echo Commit DB Error] for ${actType}:`, dbErr.message);
                throw dbErr; // Re-throw to trigger catch block with ROLLBACK
            }
        }

        // Audit for the commit(s)
        await client.query(
            `INSERT INTO echo_audit (conversation_id, user_id, tenant_id, patient_id, action, output_summary, risk_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [conversationId, userId, tenantId, actionsToCommit[0].payload.patient_id,
                actionsToCommit.length > 1 ? 'batch_commit' : 'action_committed',
                `Committed ${results.length} clinical actions`, 'high']
        );

        await client.query('COMMIT');
        res.json({ success: true, count: results.length, results });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Echo API] Commit error:', err);
        res.status(500).json({ error: 'Failed to commit clinical action(s)' });
    } finally {
        client.release();
    }
});

// ─── Write to Note ──────────────────────────────────────────────────────────

/**
 * GET /api/echo/open-notes/:patientId
 * Find today's open (draft/in-progress) visit notes for a patient
 */
router.get('/open-notes/:patientId', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const userId = req.user.id;

        // Find draft/in-progress visits for this patient (recent encounters, not signed)
        // Broadened to last 7 days to be resilient to timezones and multi-day charting
        const result = await pool.query(
            `SELECT v.id, v.visit_date, v.visit_type, v.status, v.note_draft,
                    v.created_at, a.appointment_time
             FROM visits v
             LEFT JOIN appointments a ON a.id = v.appointment_id
             WHERE v.patient_id = $1
               AND v.status NOT IN ('signed', 'cosigned', 'retracted')
               AND v.visit_date >= CURRENT_DATE - INTERVAL '7 days'
             ORDER BY v.visit_date DESC, v.created_at DESC`,
            [patientId]
        );

        const notes = result.rows.map(r => ({
            visitId: r.id,
            visitDate: r.visit_date,
            visitType: r.visit_type || 'Follow-up',
            status: r.status,
            time: r.appointment_time || null,
            hasContent: !!(r.note_draft && r.note_draft.trim().length > 0),
            preview: r.note_draft ? r.note_draft.substring(0, 100) : ''
        }));

        res.json({ notes, count: notes.length });
    } catch (err) {
        console.error('[Echo API] Open notes fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch open notes' });
    }
});

/**
 * POST /api/echo/write-to-note
 * Insert AI-drafted content into a specific section of an open visit note
 */
router.post('/write-to-note', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { visitId, sections } = req.body;
        // sections: { hpi: "...", ros: "...", pe: "...", assessment: "...", plan: "..." }

        if (!visitId || !sections || Object.keys(sections).length === 0) {
            return res.status(400).json({ error: 'visitId and sections are required' });
        }

        // Verify the visit exists, belongs to this user, and is still draft
        const visitCheck = await pool.query(
            `SELECT id, note_draft, status, provider_id FROM visits WHERE id = $1`,
            [visitId]
        );

        if (visitCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        const visit = visitCheck.rows[0];
        if (visit.provider_id && String(visit.provider_id) !== String(req.user.id)) {
            console.warn(`[Echo API] Note ${visitId} belongs to provider ${visit.provider_id}, writing as user ${req.user.id}`);
        }
        if (['signed', 'cosigned', 'retracted'].includes(visit.status)) {
            return res.status(400).json({ error: 'Cannot write to a signed/retracted note' });
        }

        // Parse existing note_draft into sections
        const existingDraft = visit.note_draft || '';
        const sectionMap = {};
        const sectionOrder = [];

        // Parse "Section Label: content" format
        const sectionRegex = /^(Chief Complaint|HPI|Review of Systems|Physical Exam|Results|Assessment|Plan|Caregiver Training|ASCVD Risk|Safety Plan|Care Plan|Follow Up):\s*/gm;
        let lastMatch = null;
        let match;
        const allMatches = [];

        // Find all section headers
        const regex = /(^|\n)(Chief Complaint|HPI|Review of Systems|Physical Exam|Results|Assessment|Plan|Caregiver Training|ASCVD Risk|Safety Plan|Care Plan|Follow Up):\s*/g;
        while ((match = regex.exec(existingDraft)) !== null) {
            allMatches.push({ label: match[2], index: match.index + match[0].length - match[2].length - 2, headerEnd: match.index + match[0].length });
        }

        // Extract content for each section
        for (let i = 0; i < allMatches.length; i++) {
            const label = allMatches[i].label;
            const contentStart = allMatches[i].headerEnd;
            const contentEnd = i + 1 < allMatches.length ? allMatches[i + 1].index : existingDraft.length;
            sectionMap[label.toLowerCase()] = existingDraft.substring(contentStart, contentEnd).trim();
            sectionOrder.push(label);
        }

        // Map incoming section keys to note section labels
        const keyToLabel = {
            'hpi': 'HPI',
            'chiefComplaint': 'Chief Complaint',
            'ros': 'Review of Systems',
            'pe': 'Physical Exam',
            'results': 'Results',
            'assessment': 'Assessment',
            'plan': 'Plan',
            'carePlan': 'Care Plan',
            'followUp': 'Follow Up'
        };

        const updatedSections = [];

        // Apply incoming sections
        for (const [key, content] of Object.entries(sections)) {
            const label = keyToLabel[key] || key;
            const normalizedKey = label.toLowerCase();

            if (sectionMap.hasOwnProperty(normalizedKey)) {
                // Section exists — replace content (or append if existing content is present)
                const existing = sectionMap[normalizedKey];
                if (existing && existing.trim().length > 0) {
                    // Append with separator if there's already content
                    sectionMap[normalizedKey] = existing + '\n\n' + content;
                } else {
                    sectionMap[normalizedKey] = content;
                }
            } else {
                // Section doesn't exist — add it
                sectionMap[normalizedKey] = content;
                sectionOrder.push(label);
            }

            updatedSections.push(label);
        }

        // Reconstruct the note_draft in proper order
        const canonicalOrder = [
            'Chief Complaint', 'HPI', 'Review of Systems', 'Physical Exam',
            'Results', 'Assessment', 'Plan', 'Caregiver Training', 'ASCVD Risk',
            'Safety Plan', 'Care Plan', 'Follow Up'
        ];

        const outputSections = [];
        for (const label of canonicalOrder) {
            const key = label.toLowerCase();
            if (sectionMap.hasOwnProperty(key) && sectionMap[key]) {
                outputSections.push(`${label}: ${sectionMap[key]}`);
            }
        }

        const updatedDraft = outputSections.join('\n\n');

        // Save back to database
        await pool.query(
            `UPDATE visits SET note_draft = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [updatedDraft, visitId]
        );

        // Audit
        try {
            await pool.query(
                `INSERT INTO echo_audit (conversation_id, user_id, tenant_id, patient_id, action, output_summary, risk_level)
                 VALUES ($1, $2, $3, (SELECT patient_id FROM visits WHERE id = $4), $5, $6, $7)`,
                [null, req.user.id, req.user.clinic_id, visitId,
                    'write_to_note', `Wrote ${updatedSections.join(', ')} to visit ${visitId}`, 'medium']
            );
        } catch (auditErr) {
            console.warn('[Echo API] Audit log failed (non-blocking):', auditErr.message);
        }

        console.log(`[Echo API] Wrote to note ${visitId}: ${updatedSections.join(', ')}`);
        res.json({ success: true, updatedSections, visitId });

    } catch (err) {
        console.error('[Echo API] Write to note error:', err);
        res.status(500).json({ error: 'Failed to write to note' });
    }
});

// ─── Conversations ──────────────────────────────────────────────────────────

/**
 * GET /api/echo/conversations/:patientId
 * Get conversation history for a patient
 */
router.get('/conversations/:patientId', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT id, title, message_count, total_tokens, created_at, updated_at
             FROM echo_conversations 
             WHERE patient_id = $1 AND user_id = $2
             ORDER BY updated_at DESC LIMIT 20`,
            [patientId, userId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('[Echo API] Conversations fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

/**
 * GET /api/echo/conversations/:id/messages
 * Get messages in a conversation
 */
router.get('/conversations/:id/messages', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const conv = await pool.query(
            'SELECT user_id FROM echo_conversations WHERE id = $1',
            [id]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        if (conv.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await echoService.getMessageHistory(id, 100);
        res.json(messages);
    } catch (err) {
        console.error('[Echo API] Messages fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * DELETE /api/echo/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const conv = await pool.query(
            'SELECT user_id FROM echo_conversations WHERE id = $1',
            [id]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        if (conv.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await pool.query('DELETE FROM echo_conversations WHERE id = $1', [id]);
        res.json({ success: true, message: 'Conversation deleted' });
    } catch (err) {
        console.error('[Echo API] Conversation delete error:', err);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// ─── Trend Analysis ─────────────────────────────────────────────────────────

/**
 * GET /api/echo/trends/:patientId/:vitalType
 * Get specific vital trend analysis (standalone, without chat)
 */
router.get('/trends/:patientId/:vitalType', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId, vitalType } = req.params;

        const vitalHistory = await echoContextEngine.getVitalHistory(patientId, 50);
        const analysis = echoTrendEngine.analyzeVitalTrend(vitalHistory, vitalType);

        res.json(analysis);
    } catch (err) {
        console.error('[Echo API] Trend analysis error:', err);
        res.status(500).json({ error: 'Failed to analyze trend' });
    }
});

/**
 * GET /api/echo/gaps/:patientId
 * Proactive clinical gap analysis
 */
router.get('/gaps/:patientId', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const tenantId = req.user.clinic_id;

        const context = await echoContextEngine.assemblePatientContext(patientId, tenantId);
        const gaps = await echoCDSEngine.analyzeClinicalGaps(context);

        res.json(gaps);
    } catch (err) {
        console.error('[Echo API] Gaps analysis error:', err);
        res.status(500).json({ error: 'Failed to analyze clinical gaps' });
    }
});

// ─── Risk Summary (Phase 4C) ────────────────────────────────────────────────

/**
 * GET /api/echo/risk-summary/:patientId
 * Lightweight risk score summary for chart badge rendering
 */
router.get('/risk-summary/:patientId', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const tenantId = req.user.clinic_id;

        const context = await echoContextEngine.assemblePatientContext(patientId, tenantId);
        const echoScoreEngine = require('../services/echoScoreEngine');
        const insights = await echoScoreEngine.generatePredictiveInsights(context);

        // Return a slim summary for badge rendering
        const scores = insights.scores || [];
        const elevated = scores.filter(s =>
            (s.type === 'ascvd' && s.score > 7.5) ||
            (s.type === 'chads' && s.score >= 2) ||
            (s.type === 'meld' && s.score >= 15)
        );

        res.json({
            hasElevated: elevated.length > 0,
            elevatedCount: elevated.length,
            scores: scores.map(s => ({
                type: s.type,
                score: s.score,
                level: s.level,
                unit: s.unit
            }))
        });
    } catch (err) {
        console.error('[Echo API] Risk summary error:', err);
        res.status(500).json({ error: 'Failed to calculate risk summary' });
    }
});

// ─── Usage & Health ─────────────────────────────────────────────────────────

/**
 * GET /api/echo/usage
 * Get current usage stats for the clinic
 */
router.get('/usage', requirePermission('ai.echo'), async (req, res) => {
    try {
        const tenantId = req.user.clinic_id;
        const budget = await echoService.checkTokenBudget(tenantId);

        res.json({
            today: budget,
            model: process.env.ECHO_MODEL || 'gpt-4o'
        });
    } catch (err) {
        console.error('[Echo API] Usage fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});

/**
 * GET /api/echo/preferences
 * Get current user's learned preferences
 */
router.get('/preferences', requirePermission('ai.echo'), async (req, res) => {
    try {
        const prefs = await echoService.getUserPreferences(req.user.id);
        res.json({ preferences: prefs });
    } catch (err) {
        console.error('[Echo API] Preferences fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

/**
 * PUT /api/echo/preferences/:id
 * Update a preference (value or active status)
 */
router.put('/preferences/:id', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { preference_value, active } = req.body;
        const updated = await echoService.updateUserPreference(req.params.id, req.user.id, { preference_value, active });
        if (!updated) return res.status(404).json({ error: 'Preference not found' });
        res.json({ preference: updated });
    } catch (err) {
        console.error('[Echo API] Preference update error:', err);
        res.status(500).json({ error: 'Failed to update preference' });
    }
});

/**
 * DELETE /api/echo/preferences/:id
 * Soft-delete a preference
 */
router.delete('/preferences/:id', requirePermission('ai.echo'), async (req, res) => {
    try {
        await echoService.deleteUserPreference(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[Echo API] Preference delete error:', err);
        res.status(500).json({ error: 'Failed to delete preference' });
    }
});

module.exports = router;
