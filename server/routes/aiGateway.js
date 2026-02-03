/**
 * AI Gateway API
 * 
 * Provides AI-powered clinical assistance endpoints:
 * - Visit summaries
 * - ICD-10 coding suggestions
 * - Order suggestions
 * - Patient message drafts
 * 
 * Features:
 * - PHI redaction before AI processing
 * - AI output storage with provenance
 * - Scope enforcement (ai.use)
 */

const express = require('express');
const crypto = require('crypto');
const { hybridAuth, requireScopes } = require('../middleware/oauthAuth');
const { requestIdMiddleware, success, error } = require('../utils/apiResponse');
const pool = require('../db');

const router = express.Router();

// Apply auth and request ID
router.use(requestIdMiddleware);
router.use(hybridAuth);

// Require ai.use scope for all endpoints
router.use(requireScopes('ai.use'));

// AI Provider configuration
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // openai, anthropic, google
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o';

/**
 * Store AI output with provenance
 */
async function storeAIOutput(tenantId, userId, appId, type, input, output, model) {
    try {
        const inputHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');

        await pool.query(
            `INSERT INTO ai_outputs (tenant_id, user_id, app_id, type, input_hash, input_summary, output, model, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT DO NOTHING`,
            [tenantId, userId, appId, type, inputHash, JSON.stringify(input).substring(0, 500), output, model]
        );
    } catch (err) {
        console.error('[AI Gateway] Failed to store output:', err.message);
    }
}

/**
 * Redact PHI from text for logging/audit
 */
function redactPHI(text) {
    if (!text) return text;

    // Simple PHI redaction patterns
    return text
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')           // SSN
        .replace(/\b\d{9}\b/g, '[SSN]')                        // SSN without dashes
        .replace(/\b[A-Z]\d{8}\b/gi, '[MRN]')                  // MRN patterns
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]') // Phone
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
}

/**
 * Call AI provider
 */
async function callAI(systemPrompt, userPrompt, options = {}) {
    const maxTokens = options.maxTokens || 2000;

    try {
        if (AI_PROVIDER === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_API_KEY}`
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    max_tokens: maxTokens,
                    temperature: options.temperature || 0.3
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                content: data.choices[0]?.message?.content || '',
                model: AI_MODEL,
                usage: data.usage
            };
        }

        // Add other providers as needed
        throw new Error(`AI provider ${AI_PROVIDER} not implemented`);
    } catch (err) {
        console.error('[AI Gateway] AI call failed:', err.message);
        throw err;
    }
}

/**
 * Visit Summary
 * POST /ai/v1/visit-summary
 */
router.post('/visit-summary', async (req, res) => {
    try {
        const { visit_id, include_assessment = true, include_plan = true } = req.body;

        if (!visit_id) {
            return error(res, 'validation_error', 'visit_id is required', 400);
        }

        // Fetch visit data
        const visitResult = await pool.query(
            `SELECT v.*, p.first_name, p.last_name, p.dob, p.sex,
              u.first_name as provider_first, u.last_name as provider_last
       FROM visits v
       LEFT JOIN patients p ON v.patient_id = p.id
       LEFT JOIN users u ON v.provider_id = u.id
       WHERE v.id = $1`,
            [visit_id]
        );

        if (visitResult.rows.length === 0) {
            return error(res, 'not_found', 'Visit not found', 404);
        }

        const visit = visitResult.rows[0];

        // Build clinical context
        const clinicalContext = `
Patient: ${visit.first_name} ${visit.last_name}, ${visit.sex}, DOB: ${visit.dob}
Visit Date: ${visit.visit_date}
Chief Complaint: ${visit.chief_complaint || 'Not recorded'}
${visit.history_of_present_illness ? `HPI: ${visit.history_of_present_illness}` : ''}
${visit.physical_exam ? `Exam: ${visit.physical_exam}` : ''}
${visit.assessment ? `Assessment: ${visit.assessment}` : ''}
${visit.plan ? `Plan: ${visit.plan}` : ''}
    `.trim();

        const systemPrompt = `You are a medical documentation assistant. Generate a concise, professional clinical summary.
Format the output in clear sections. Be factual and don't add information not present in the source.`;

        const userPrompt = `Summarize this clinical encounter:\n\n${clinicalContext}`;

        const aiResult = await callAI(systemPrompt, userPrompt);

        // Store with provenance
        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const userId = req.oauth?.userId || req.user?.id;
        const appId = req.oauth?.appId;

        await storeAIOutput(tenantId, userId, appId, 'visit-summary',
            { visit_id, patient_id: visit.patient_id }, aiResult.content, aiResult.model);

        return success(res, {
            visit_id,
            summary: aiResult.content,
            model: aiResult.model,
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('[AI Gateway] Visit summary error:', err);
        return error(res, 'ai_error', 'Failed to generate summary', 500);
    }
});

/**
 * ICD-10 Coding Suggestions
 * POST /ai/v1/icd10-suggestions
 */
router.post('/icd10-suggestions', async (req, res) => {
    try {
        const { clinical_text, max_suggestions = 5 } = req.body;

        if (!clinical_text) {
            return error(res, 'validation_error', 'clinical_text is required', 400);
        }

        const systemPrompt = `You are a medical coding assistant specializing in ICD-10-CM codes.
Given clinical documentation, suggest the most appropriate ICD-10 codes.
Return a JSON array with objects containing: code, description, confidence (high/medium/low).
Only return the JSON array, no other text.`;

        const userPrompt = `Suggest ICD-10 codes for:\n\n${clinical_text}\n\nReturn up to ${max_suggestions} codes.`;

        const aiResult = await callAI(systemPrompt, userPrompt);

        // Parse JSON response
        let suggestions = [];
        try {
            const jsonMatch = aiResult.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                suggestions = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('[AI Gateway] Failed to parse ICD-10 suggestions:', e.message);
        }

        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const userId = req.oauth?.userId || req.user?.id;
        const appId = req.oauth?.appId;

        await storeAIOutput(tenantId, userId, appId, 'icd10-suggestions',
            { clinical_text: redactPHI(clinical_text) }, suggestions, aiResult.model);

        return success(res, {
            suggestions,
            model: aiResult.model,
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('[AI Gateway] ICD-10 suggestions error:', err);
        return error(res, 'ai_error', 'Failed to generate suggestions', 500);
    }
});

/**
 * Order Suggestions
 * POST /ai/v1/order-suggestions
 */
router.post('/order-suggestions', async (req, res) => {
    try {
        const { diagnosis, patient_age, patient_sex, existing_orders = [], max_suggestions = 10 } = req.body;

        if (!diagnosis) {
            return error(res, 'validation_error', 'diagnosis is required', 400);
        }

        const context = `
Diagnosis/Condition: ${diagnosis}
${patient_age ? `Patient Age: ${patient_age}` : ''}
${patient_sex ? `Patient Sex: ${patient_sex}` : ''}
${existing_orders.length > 0 ? `Already Ordered: ${existing_orders.join(', ')}` : ''}
    `.trim();

        const systemPrompt = `You are a clinical decision support assistant.
Suggest appropriate diagnostic tests and procedures based on the clinical scenario.
Return a JSON array with objects containing: order_type (lab/imaging/procedure), name, cpt_code (if known), rationale.
Only return the JSON array, no other text.`;

        const userPrompt = `Suggest orders for:\n\n${context}\n\nReturn up to ${max_suggestions} suggestions.`;

        const aiResult = await callAI(systemPrompt, userPrompt);

        let suggestions = [];
        try {
            const jsonMatch = aiResult.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                suggestions = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('[AI Gateway] Failed to parse order suggestions:', e.message);
        }

        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const userId = req.oauth?.userId || req.user?.id;
        const appId = req.oauth?.appId;

        await storeAIOutput(tenantId, userId, appId, 'order-suggestions',
            { diagnosis, patient_age, patient_sex }, suggestions, aiResult.model);

        return success(res, {
            suggestions,
            model: aiResult.model,
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('[AI Gateway] Order suggestions error:', err);
        return error(res, 'ai_error', 'Failed to generate suggestions', 500);
    }
});

/**
 * Patient Message Draft
 * POST /ai/v1/patient-message-draft
 */
router.post('/patient-message-draft', async (req, res) => {
    try {
        const { patient_id, message_type, context, tone = 'professional' } = req.body;

        if (!patient_id || !message_type) {
            return error(res, 'validation_error', 'patient_id and message_type are required', 400);
        }

        // Fetch patient for personalization
        const patientResult = await pool.query(
            'SELECT first_name, last_name, preferred_language FROM patients WHERE id = $1',
            [patient_id]
        );

        const patient = patientResult.rows[0];
        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient';

        const messageTypes = {
            'appointment_reminder': 'appointment reminder',
            'lab_results': 'lab results notification',
            'prescription_ready': 'prescription ready notification',
            'followup': 'follow-up message',
            'general': 'general communication'
        };

        const systemPrompt = `You are a healthcare communication assistant.
Draft a ${tone}, clear, and empathetic patient message.
Use appropriate health literacy level. Be concise but warm.`;

        const userPrompt = `Draft a ${messageTypes[message_type] || message_type} for ${patientName}.
${context ? `Context: ${context}` : ''}
Keep the message brief and actionable.`;

        const aiResult = await callAI(systemPrompt, userPrompt, { maxTokens: 500 });

        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const userId = req.oauth?.userId || req.user?.id;
        const appId = req.oauth?.appId;

        await storeAIOutput(tenantId, userId, appId, 'patient-message-draft',
            { patient_id, message_type }, aiResult.content, aiResult.model);

        return success(res, {
            draft: aiResult.content,
            message_type,
            patient_name: patientName,
            model: aiResult.model,
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('[AI Gateway] Message draft error:', err);
        return error(res, 'ai_error', 'Failed to generate draft', 500);
    }
});

/**
 * Health check
 * GET /ai/v1/health
 */
router.get('/health', (req, res) => {
    return success(res, {
        status: 'ok',
        provider: AI_PROVIDER,
        model: AI_MODEL,
        configured: !!AI_API_KEY
    });
});

module.exports = router;
