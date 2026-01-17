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
/**
 * Supported Tools Definition
 */
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'schedule_appointment',
            description: 'Schedule a new appointment for the patient.',
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'Date of appointment (YYYY-MM-DD)' },
                    time: { type: 'string', description: 'Time of appointment (HH:MM)' },
                    duration: { type: 'integer', description: 'Duration in minutes (default 30)' },
                    type: { type: 'string', description: 'Type of appointment (e.g., Follow-up, New Patient, Telehealth)' },
                    notes: { type: 'string', description: 'Reason for visit or notes' }
                },
                required: ['date', 'time']
            }
        }
    }
];

/**
 * Main function to ask the AI a clinical question about a patient or perform actions
 */
async function askAssistant(userId, patientId, question, additionalContext = {}) {
    try {
        // 1. Gather Clinical context
        const context = await gatherPatientContext(patientId);

        // 2. Build the system prompt
        const systemPrompt = buildSystemPrompt(context);

        // 3. Build the user prompt
        const userPrompt = `Context: ${JSON.stringify(additionalContext)}\n\nUser Request: ${question}`;

        // 4. Call LLM with Tools
        if (AI_PROVIDER === 'openai') {
            return await runOpenAIAgentLoop(userId, patientId, systemPrompt, userPrompt);
        } else {
            // Fallback for providers without tool support yet
            // (Anthropic also supports tools, but implementing OpenAI first for speed)
            if (AI_PROVIDER === 'anthropic') {
                return await callAnthropic(systemPrompt, userPrompt);
            }
            throw new Error('Unsupported AI Provider');
        }
    } catch (error) {
        console.error('AI Assistant Service Error:', error);
        throw error;
    }
}

/**
 * OpenAI Agent Loop - Handles reasoning, tool execution, and final response
 */
async function runOpenAIAgentLoop(userId, patientId, systemPrompt, userPrompt) {
    if (!OPENAI_API_KEY) throw new Error('OpenAI API Key not configured');

    let messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    // Step 1: Initial Call
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: AI_MODEL,
        messages: messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.1
    }, {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }
    });

    const responseMessage = response.data.choices[0].message;

    // Step 2: Check for Tool Calls
    if (responseMessage.tool_calls) {
        messages.push(responseMessage); // Add assistant's tool call request to history

        // Execute each tool call
        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            let toolOutput;
            if (functionName === 'schedule_appointment') {
                toolOutput = await scheduleAppointmentTool(userId, patientId, functionArgs);
            } else {
                toolOutput = JSON.stringify({ error: "Unknown tool" });
            }

            messages.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: toolOutput
            });
        }

        // Step 3: Follow-up Call (LLM interprets tool output)
        const secondResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: AI_MODEL,
            messages: messages
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }
        });

        return secondResponse.data.choices[0].message.content;
    }

    return responseMessage.content;
}

/**
 * Tool: Schedule Appointment
 */
async function scheduleAppointmentTool(userId, patientId, args) {
    try {
        const { date, time, duration = 30, type = 'Follow-up', notes } = args;

        // Validation
        if (!date || !time) return JSON.stringify({ error: "Date and time are required." });

        // Basic conflict check (simplified for AI agent)
        const check = await pool.query(
            `SELECT count(*) FROM appointments WHERE provider_id = $1 AND appointment_date = $2 AND appointment_time = $3`,
            [userId, date, time]
        );

        if (parseInt(check.rows[0].count) >= 2) {
            return JSON.stringify({ error: "Time slot is full (max 2 appointments). Please pick another time." });
        }

        // Create appointment
        const result = await pool.query(
            `INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, appointment_type, notes, created_by, clinic_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT clinic_id FROM users WHERE id = $8)) RETURNING id`,
            [patientId, userId, date, time, duration, type, notes, userId]
        );

        return JSON.stringify({
            success: true,
            message: `Appointment scheduled successfully for ${date} at ${time}.`,
            appointmentId: result.rows[0].id
        });

    } catch (dbError) {
        console.error("Tool Execution Error:", dbError);
        return JSON.stringify({ error: "Database error while scheduling.", details: dbError.message });
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

        // Recent Vitals (Extended history for trending)
        const vitalsRes = await pool.query('SELECT * FROM vitals WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 50', [patientId]);
        context.vitals = vitalsRes.rows;

        // Recent Visits & Notes (Last 5 visits with full note content)
        const visitsRes = await pool.query(
            `SELECT v.visit_date, v.note_type, v.status, v.note_draft, v.encounter_date, 
                    u.first_name || ' ' || u.last_name as provider_name 
             FROM visits v 
             LEFT JOIN users u ON v.provider_id = u.id 
             WHERE v.patient_id = $1 
             ORDER BY v.visit_date DESC 
             LIMIT 5`,
            [patientId]
        );
        context.recentVisits = visitsRes.rows;

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
