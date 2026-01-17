/**
 * AI Clinical Assistant Service
 * 
 * Handles interaction with LLM providers (OpenAI/Anthropic) to provide
 * clinical decision support, note generation, and patient data summaries.
 * 
 * Design Principles:
 * 1. Tenant Isolation: Only use data provided for the specific patient context.
 * 2. Clinical Accuracy: Frame responses as suggestions for clinician review.
 * 3. Privacy: Do not send PII (Personally Identifiable Information) unless necessary and configured.
 */

const axios = require('axios');
const pool = require('../db');

// Configuration
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'anthropic'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL || (AI_PROVIDER === 'openai' ? 'gpt-4-turbo' : 'claude-3-opus-20240229');

/**
 * Main function to ask the AI a clinical question about a patient
 * @param {string} userId - ID of the user asking
 * @param {string} patientId - ID of the patient context
 * @param {string} question - The user's query
 * @param {Object} additionalContext - Optional UI-provided context (e.g. current draft note)
 * @returns {Promise<string>} AI Response
 */
async function askAssistant(userId, patientId, question, additionalContext = {}) {
    try {
        // 1. Gather Clinical context
        const context = await gatherPatientContext(patientId);

        // 2. Build the system prompt
        const systemPrompt = buildSystemPrompt(context);

        // 3. Build the user prompt
        const userPrompt = `Context: ${JSON.stringify(additionalContext)}\n\nQuestion: ${question}`;

        // 4. Call LLM
        let response;
        if (AI_PROVIDER === 'openai') {
            response = await callOpenAI(systemPrompt, userPrompt);
        } else if (AI_PROVIDER === 'anthropic') {
            response = await callAnthropic(systemPrompt, userPrompt);
        } else {
            throw new Error('Unsupported AI Provider');
        }

        return response;
    } catch (error) {
        console.error('AI Assistant Service Error:', error);
        throw error;
    }
}

/**
 * Gather a comprehensive snapshot of patient data for AI context
 */
async function gatherPatientContext(patientId) {
    const context = {
        demographics: {},
        vitals: [],
        medications: [],
        problems: [],
        allergies: [],
        recentVisits: []
    };

    try {
        // Demographics
        const patientRes = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
        if (patientRes.rows.length > 0) {
            const p = patientRes.rows[0];
            context.demographics = {
                age: p.dob ? (new Date().getFullYear() - new Date(p.dob).getFullYear()) : 'Unknown',
                sex: p.sex,
                race: p.race,
                ethnicity: p.ethnicity
            };
        }

        // Problems
        const problemsRes = await pool.query('SELECT * FROM patient_diagnoses WHERE patient_id = $1 AND status = $2', [patientId, 'active']);
        context.problems = problemsRes.rows.map(r => r.diagnosis_name);

        // Medications
        const medsRes = await pool.query('SELECT * FROM prescriptions WHERE patient_id = $1 AND status = $2', [patientId, 'active']);
        context.medications = medsRes.rows.map(r => `${r.medication_name} ${r.dosage}`);

        // Allergies
        const allergiesRes = await pool.query('SELECT * FROM patient_allergies WHERE patient_id = $1', [patientId]);
        context.allergies = allergiesRes.rows.map(r => r.allergen);

        // Recent Vitals
        const vitalsRes = await pool.query('SELECT * FROM vitals WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 3', [patientId]);
        context.vitals = vitalsRes.rows;

        return context;
    } catch (error) {
        console.warn('Failed to gather complete patient context for AI:', error.message);
        return context; // Return partial context
    }
}

/**
 * Build a structured system prompt using the EMR AI core mission
 */
function buildSystemPrompt(context) {
    return `You are the PageMD AI Clinical Assistant, a core intelligence layer integrated into the PageMD EMR system.
Your mission is to empower clinicians with proactive, clinical-grade intelligence while maintaining the highest standards of safety and privacy.

IDENTITY & PRINCIPLES:
- You are an expert clinical assistant.
- Tenant Isolation: Your knowledge is strictly limited to the patient context provided. 
- Clinical Decision Support (CDS): Provide evidence-based suggestions. Always include a disclaimer that final decisions are made by the provider.
- Omniscience: You have read-only access to the patient's entire record (provided below).

PATIENT CONTEXT:
${JSON.stringify(context, null, 2)}

OPERATIONAL FRAMEWORK:
1. Summarize complex data into actionable clinical insights.
2. Flag potential discrepancies (e.g., drug-drug interactions or allergy conflicts).
3. Draft clinical documentation (SOAP notes) based on visit data.
4. Maintain a professional, concise, and helpful tone.

Safety Rule: If you identify a critical clinical risk (e.g. fatal interaction), start your response with "CRITICAL SAFETY ALERT".`;
}

/**
 * Call OpenAI Chat Completions API
 */
async function callOpenAI(systemPrompt, userPrompt) {
    if (!OPENAI_API_KEY) throw new Error('OpenAI API Key not configured');

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: AI_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.1 // Lower temperature for clinical consistency
    }, {
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    return response.data.choices[0].message.content;
}

/**
 * Call Anthropic Messages API
 */
async function callAnthropic(systemPrompt, userPrompt) {
    if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API Key not configured');

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: AI_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.1
    }, {
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    return response.data.content[0].text;
}

module.exports = {
    askAssistant,
    gatherPatientContext
};
