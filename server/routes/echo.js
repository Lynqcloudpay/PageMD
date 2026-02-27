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
 * Transcribe clinical audio using Deepgram Nova-2 Medical (Whisper fallback)
 * 
 * Body (multipart): audio file + optional mode ('dictation' | 'ambient')
 * In ambient mode, raw transcript is post-processed into a SOAP note via GPT-4o-mini
 */
router.post('/transcribe', requirePermission('ai.echo'), upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            console.warn('[Echo API] Transcribe called without audio file. Check multipart headers.');
            return res.status(400).json({ error: 'No audio file provided' });
        }
        const visitId = req.body?.visitId;
        const mode = req.body?.mode || 'dictation';
        console.log(`[Echo Route] Transcribe request received. Mode: ${mode}, File: ${req.file?.originalname}`);
        const transcription = await echoService.transcribeAudio(req.file.buffer, req.file.originalname, { mode });

        // In ambient mode, post-process raw transcript into structured SOAP note
        if (mode === 'ambient' && transcription && transcription.trim().length > 0) {
            try {
                // Fetch rich patient context: Demographics + Active Problem List
                let patientContext = '';
                let problemList = [];
                if (visitId) {
                    const patientInfo = await pool.query(
                        `SELECT p.id as patient_id, p.gender, p.first_name, p.last_name, p.dob 
                         FROM patients p 
                         JOIN visits v ON v.patient_id = p.id 
                         WHERE v.id = $1`,
                        [visitId]
                    );

                    if (patientInfo.rows.length > 0) {
                        const p = patientInfo.rows[0];
                        const gender = p.gender ? p.gender.toLowerCase() : 'unknown';

                        // Robust age calculation
                        const today = new Date();
                        const birthDate = new Date(p.dob);
                        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
                        const m = today.getMonth() - birthDate.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                            calculatedAge--;
                        }
                        const age = p.dob ? calculatedAge : 'adult';

                        // Fetch Active Problems for Option A (Linkage)
                        const problemsQuery = await pool.query(
                            `SELECT problem_name FROM problems WHERE patient_id = $1 AND status = 'active'`,
                            [p.patient_id]
                        );
                        problemList = problemsQuery.rows.map(r => r.problem_name);

                        patientContext = `The patient is a ${age}-year-old ${gender}. `;
                        if (problemList.length > 0) {
                            patientContext += `Active Problem List: ${problemList.join(', ')}. `;
                        }
                    }
                }

                const soapResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.AI_API_KEY || process.env.OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini', // Using GPT-4o-mini for cost efficiency
                        temperature: 0.1,
                        max_tokens: 2500,
                        response_format: { type: 'json_object' },
                        messages: [
                            {
                                role: 'system',
                                content: `You are an elite Medical Scribe. ${patientContext}
GOAL: Create a high-revenue, physician-grade clinical note.

CRITICAL DEMOGRAPHICS RULE:
- The patient's EXACT age and gender are provided in the context above. USE THEM EXACTLY.
- DO NOT infer, guess, or change the patient's age or gender from the transcript.
- If the transcript contradicts the provided demographics, IGNORE the transcript and use the provided values.

NARRATIVE STYLE:
- Opening: Start HPI with "[EXACT Age from context] [EXACT Gender from context] with a PMHx of [ONLY conditions from the Active Problem List provided above] who presents for [Chief Complaint]."
- Clinical Linkage: If current symptoms relate to PMHx, explicitly state it. ONLY reference conditions that appear in the Active Problem List. NEVER invent or hallucinate conditions not on the list.
- "Dr. Format": Use professional medical shorthand (e.g., PMHx, pt, noted, denies, c/o).

PMHx STRICT RULE:
- ONLY mention medical history conditions that are EXPLICITLY listed in the Active Problem List above.
- If the Active Problem List is empty or says "None reported", do NOT fabricate any medical history.
- NEVER add conditions like "angina", "diabetes", "hypertension" unless they appear in the provided Active Problem List.

SEPARATION OF DATA:
- HPI (Subjective): Capture ONLY what the patient says. Narrative style. DO NOT include physical exam findings.
- BILLING OPTIMIZATION: 
  1. Pertinent Negatives: Document negatives to rule out high-risk differentials.
  2. SDOH: If social factors are mentioned, document them.
  3. Data Review: Include "Independent review of internal records was performed" if implied.
  4. Chronic Condition Status: For items in PMHx, use status words.
  5. Differential Reasoning: Briefly note alternatives being considered.
- Level 5 E/M markers: Include Location, Quality, Severity, Duration, Timing, Context, Modifying Factors.

ROS COMPLETENESS RULE:
- You MUST document ALL 10 systems. For systems not explicitly discussed, write "Negative" or "Denies [relevant symptoms]".
- The 10 required systems are: Constitutional, Eyes, ENT, Cardiovascular, Respiratory, Gastrointestinal, Genitourinary, Musculoskeletal, Neurological, Psychiatric.

PRONOUNS:
- Use biological binary pronouns (He/She, Him/Her). NEVER use 'they/them' for a single patient.

JSON STRUCTURE (output ONLY these 4 fields — do NOT include assessment or plan):
{
  "chiefComplaint": "Short phrase.",
  "hpi": "Narrative SUBJECTIVE paragraph. Strictly no physical exam data. Include ONLY PMHx from the provided Active Problem List.",
  "ros": "**System:** Findings. Each on a NEW row. ALL 10 systems MUST be documented.",
  "pe": "**System:** Findings. Each on a NEW row."
}`
                            },
                            {
                                role: 'user',
                                content: `Draft a professional note based on this transcript:\n\n${transcription}`
                            }
                        ]
                    })
                });

                if (soapResponse.ok) {
                    const soapData = await soapResponse.json();
                    const rawContent = soapData.choices?.[0]?.message?.content || '{}';
                    let parsed = {};
                    try { parsed = JSON.parse(rawContent); } catch (e) { parsed = { structuredNote: rawContent }; }

                    const parsedSections = {
                        chiefComplaint: parsed.chiefComplaint || '',
                        hpi: parsed.hpi || '',
                        ros: parsed.ros || '',
                        pe: parsed.pe || ''
                        // NOTE: assessment and plan are intentionally EXCLUDED from ambient auto-draft.
                        // The physician will use the AI Draft button to generate assessment suggestions
                        // and the MDM button to generate clinical reasoning — on demand only.
                    };

                    // 3. PERSIST RAW TRANSCRIPT TO VISIT RECORD (Elite Memory)
                    if (visitId) {
                        try {
                            await pool.query(
                                `UPDATE visits SET visit_transcript = $1, updated_at = NOW() WHERE id = $2`,
                                [transcription, visitId]
                            );
                            console.log(`[Echo API] Persisted transcript for visit ${visitId} (${transcription.length} chars)`);
                        } catch (saveErr) {
                            console.error(`[Echo API] Failed to persist transcript:`, saveErr);
                        }
                    }

                    return res.json({
                        success: true,
                        text: transcription,
                        rawTranscript: transcription,
                        structuredNote: parsed.structuredNote || rawContent,
                        parsedSections,
                        mode: 'ambient'
                    });
                }
            } catch (soapErr) {
                console.warn('[Echo API] SOAP structuring failed, returning raw transcript:', soapErr.message);
            }
        }

        // Even in dictation mode or failed ambient, if we have a visitId, store it
        if (visitId && transcription && transcription.trim().length > 0) {
            try {
                await pool.query(
                    `UPDATE visits SET visit_transcript = $1, updated_at = NOW() WHERE id = $2`,
                    [transcription, visitId]
                );
            } catch (saveErr) { }
        }

        res.json({ success: true, text: transcription, mode });
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
        // sections: { hpi: "...", ros: "...", pe: "...", assessment: "...", plan: "...", assessmentPlan: "..." }

        if (!visitId || !sections || Object.keys(sections).length === 0) {
            return res.status(400).json({ error: 'visitId and sections are required' });
        }

        // Verify the visit exists, belongs to this user, and is still draft
        const { patientId } = req.body;
        const query = patientId
            ? [`SELECT id, note_draft, status, provider_id, patient_id FROM visits WHERE id = $1 AND patient_id = $2`, [visitId, patientId]]
            : [`SELECT id, note_draft, status, provider_id, patient_id FROM visits WHERE id = $1`, [visitId]];

        const visitCheck = await pool.query(query[0], query[1]);

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
        const sectionRegex = /^(Chief Complaint|HPI|Review of Systems|Physical Exam|Results|Assessment|Plan|Care Plan|Follow Up):\s*/gm;
        let lastMatch = null;
        let match;
        const allMatches = [];

        // Find all section headers
        const regex = /(^|\n)(Chief Complaint|HPI|Review of Systems|Physical Exam|Results|Assessment|Plan|Care Plan|Follow Up):\s*/g;
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
            'Results', 'Assessment', 'Plan', 'Care Plan', 'Follow Up'
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
            model: process.env.ECHO_MODEL || 'gpt-4o-mini'
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

/**
 * POST /api/echo/refine-section
 * Individualized AI refinement for a specific note section
 */
router.post('/refine-section', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { visitId, section, diagnosis, existingMdms } = req.body;
        if (!visitId || !section) {
            return res.status(400).json({ error: 'Visit ID and section are required' });
        }

        console.log(`[Echo Refine] Refining ${section} ${diagnosis ? `for ${diagnosis}` : ''} in visit ${visitId}`);

        // 1. Fetch transcript, patient context, and visit orders
        const visitResult = await pool.query(
            `SELECT v.visit_transcript, v.patient_id, p.gender, p.dob,
             (SELECT string_agg(problem_name, ', ') FROM problems WHERE patient_id = v.patient_id AND status = 'active') as problem_list,
             (SELECT string_agg(medication_name || ' ' || COALESCE(dosage, ''), '; ') FROM medications WHERE patient_id = v.patient_id AND active = true) as med_list,
             v.note_draft
             FROM visits v
             JOIN patients p ON v.patient_id = p.id
             WHERE v.id = $1`,
            [visitId]
        );

        if (visitResult.rows.length === 0) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        const visit = visitResult.rows[0];
        // Graceful fallback: visit_transcript is the canonical source, but note_draft
        // holds the content for all visits transcribed before the column was added.
        const transcript = visit.visit_transcript || visit.note_draft;
        if (!transcript) {
            return res.status(400).json({ error: 'No spoken transcript found for this visit. Please transcribe audio first.' });
        }

        // Robust age calculation for refinement
        const today = new Date();
        const birthDate = new Date(visit.dob);
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
        }
        const age = visit.dob ? calculatedAge : 'adult';
        const context = `The patient is a ${age}-year-old ${visit.gender || 'unknown'}. PMHx: ${visit.problem_list || 'None reported'}.`;

        // 2. Formulate targeted prompt
        let promptSnippet = "";
        let responseFormat = {};

        switch (section.toLowerCase()) {
            case 'hpi':
                promptSnippet = `Write a professional, narrative HPI (Subjective only). Do not include physical exam. Focus on symptoms, onset, and relevant PMHx linkage. CRITICAL: Use the EXACT patient age and gender from the context provided. ONLY reference conditions from the Active Problem List provided. Do NOT invent or hallucinate any medical history not in the list.`;
                responseFormat = { type: 'text' };
                break;
            case 'ros':
                promptSnippet = `Document a complete Review of Systems (ROS). 
                Format EACH system on a new line as: **System Name:** Findings.
                YOU MUST INCLUDE ALL 10 SYSTEMS: Constitutional, Eyes, ENT, Cardiovascular, Respiratory, Gastrointestinal, Genitourinary, Musculoskeletal, Neurological, Psychiatric.
                IMPORTANT: If a system was NOT mentioned in the transcript, document it as negative/normal (e.g., "**Eyes:** Denies vision changes or eye pain."). 
                EVERY system MUST appear. Use medical terminology (e.g., "Denies", "Negative for").`;
                responseFormat = { type: 'text' };
                break;
            case 'pe':
                promptSnippet = `Document a complete Physical Exam findings. 
                Format EACH system on a new line as: **System Name:** Findings.
                INCLUDE: Constitutional, HENT, Neck, Lungs, Heart, Abdomen, Musculoskeletal, Neurological, Skin/Integumentary.
                IMPORTANT: If a system was NOT explicitly mentioned as being examined, assume findings are normal/WNL (Within Normal Limits). 
                Use medical shorthand/terminology (e.g., "WNL", "Supple", "CTB BL", "RRR", "Nontender").`;
                responseFormat = { type: 'text' };
                break;
            case 'assessment_suggestions':
                promptSnippet = `Based on the transcript, identify potential diagnoses that were discussed or addressed.
                Output a JSON object with a "suggestions" key containing an array of objects:
                { "code": "ICD-10 Code", "description": "Clinical Description", "reason": "Brief logic for this suggestion" }
                Ensure codes are specific and billable.`;
                responseFormat = { type: 'json_object' };
                break;
            case 'mdm':
                // Physician-grade clinical reasoning MDM
                const ordersUsed = visit.note_draft ? (visit.note_draft.match(/Plan:[\s\S]+/i)?.[0] || 'No specific orders found') : 'N/A';
                promptSnippet = `You are the treating physician writing your own clinical reasoning. Write a CONCISE MDM (1-2 short paragraphs, MAX 6 sentences).
                Diagnosis: "${diagnosis || 'Generalized health management'}".
                
                CONTEXT:
                - Transcript excerpt: ${transcript.substring(0, 800)}
                - Orders/Rx placed: ${ordersUsed}
                - Home Meds: ${visit.med_list || 'None'}
                - Chronic Problems: ${visit.problem_list || 'None'}
                
                THINK LIKE A PHYSICIAN — include:
                1. DIFFERENTIAL considered and why this diagnosis was favored (r/o what?)
                2. ORDER JUSTIFICATION — why EACH lab/imaging/referral was ordered (e.g., "CBC ordered to r/o infectious or inflammatory etiology"; "Ortho referral given failed conservative tx")
                3. RISK — medication interactions or comorbidity risk that influenced your plan (e.g., "Given concurrent anticoagulation with Eliquis, NSAID use limited to short course with GI monitoring")
                4. FOLLOW-UP rationale — what to reassess and when (e.g., "RTC 2 weeks to reassess pain response; escalate to surgical consult if no improvement")
                
                STRICT RULES:
                - Write in FIRST PERSON as the physician ("I considered...", "Labs ordered to r/o...")
                - NO patient emotion or concern language ("patient is worried about surgery")
                - NO generic filler ("it is important to note", "this adds complexity")
                - Use clinical shorthand (PMHx, c/o, r/o, f/u, RTC, BID, etc.)
                - MAX 2 paragraphs. Every sentence must serve a clinical or billing purpose.
                
                ${existingMdms ? `REPETITION WARNING:
                The following MDMs have already been written for other diagnoses in this visit:
                ---
                ${existingMdms}
                ---
                DO NOT repeat the same clinical logic or wording. If this diagnosis (e.g., Unstable Angina) is related to another (e.g., ACS), focus specifically on the unique reasoning or management aspects of THIS diagnosis code. Cross-reference briefly if needed, but do not copy-paste paragraphs.` : ''}

                - Output ONLY the MDM text.`;
                responseFormat = { type: 'text' };
                break;
            default:
                if (section.toLowerCase() === 'plan') {
                    promptSnippet = `Document the plan section accurately based on the conversation. 
                    STRICT FORMATTING: 
                    1. List EVERY diagnosis addressed.
                    2. Under each diagnosis, list EVERY instruction, medication, or order discussed as a distinct bullet point starting with its own line.
                    3. Ensure NO words are joined/concatenated. Use proper spacing and punctuation.
                    4. Do not include patient preference or fluff. Just clinical orders and logic.`;
                } else {
                    promptSnippet = `Document the ${section} section accurately based on the conversation.`;
                }
                responseFormat = { type: 'text' };
        }

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.AI_API_KEY || process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0.1,
                response_format: responseFormat,
                messages: [
                    {
                        role: 'system',
                        content: `You are an elite Medical Scribe. ${context}
                        TASK: Refine/Draft the "${section}" section of the visit note.
                        CRITICAL: ONLY output the requested content. Use the EXACT patient demographics (age, gender) from context above. ONLY reference PMHx conditions from the context. NEVER invent medical history. ${responseFormat.type === 'json_object' ? 'Output VALID JSON.' : 'No preamble, no conversational fillers.'}`
                    },
                    {
                        role: 'user',
                        content: `Transcript:\n"${transcript}"\n\nCommand: ${promptSnippet}`
                    }
                ]
            })
        });

        if (!aiResponse.ok) throw new Error('AI processing failed');
        const data = await aiResponse.json();
        let draftedText = data.choices?.[0]?.message?.content || '';
        let suggestions = null;

        if (section === 'assessment_suggestions') {
            try {
                const parsed = JSON.parse(draftedText);
                suggestions = parsed.suggestions || [];
                draftedText = ''; // Clear text if we are in suggestion mode
            } catch (e) {
                console.error('JSON parse error for suggestions:', e);
            }
        }

        res.json({ success: true, draftedText: draftedText.trim(), suggestions });

    } catch (err) {
        console.error('[Echo Refine] Error:', err);
        res.status(500).json({ error: 'Failed to refine section with AI' });
    }
});

module.exports = router;
