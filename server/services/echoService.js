/**
 * Echo Service — Multi-Agent Orchestrator
 * 
 * Central brain of Project Echo. Routes user intent to sub-agents via
 * OpenAI function-calling. Manages conversation state, tool execution,
 * token budgets, and audit trails.
 */

const pool = require('../db');
const echoContextEngine = require('./echoContextEngine');
const echoTrendEngine = require('./echoTrendEngine');
const echoSemanticLayer = require('./echoSemanticLayer');

const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
const ECHO_MODEL = process.env.ECHO_MODEL || 'gpt-4o';
const DAILY_TOKEN_BUDGET = parseInt(process.env.ECHO_DAILY_TOKEN_BUDGET || '500000');

// ─── System Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Echo, a clinical AI assistant embedded in the PageMD EMR.

PERSONALITY:
- Concise, professional, medically precise
- Never diagnose — only surface data, trends, and evidence
- Always cite the source of data (visit date, order, document)
- Use clinical terminology appropriate for the provider's specialty
- Format responses with clear headers and bullet points when presenting data

CONSTRAINTS:
- Never fabricate clinical data. If data is unavailable, say so explicitly.
- Always recommend provider verification for critical findings
- Flag concerning trends with severity markers
- When presenting vitals or labs, always include the date of measurement
- For medication questions, include dose, frequency, and route
- Do not provide treatment recommendations — only data-driven observations

RESPONSE FORMAT:
- Use markdown formatting for structured data
- Use tables for comparing values across dates
- Use bullet points for lists of findings
- Keep responses under 500 words unless the user asks for detail
- End with a brief "Key Takeaway" when summarizing complex data`;

// ─── Tool Catalog (OpenAI Function Definitions) ────────────────────────────

const TOOL_CATALOG = [
    {
        type: 'function',
        function: {
            name: 'get_patient_summary',
            description: 'Get a comprehensive summary of the current patient including demographics, allergies, medications, active problems, and recent visits.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_vital_trends',
            description: 'Get historical vital sign trends with statistical analysis and clinical context. Returns data suitable for charting.',
            parameters: {
                type: 'object',
                properties: {
                    vital_type: {
                        type: 'string',
                        enum: Object.keys(echoTrendEngine.VITAL_GUIDELINES),
                        description: 'The specific vital sign to analyze'
                    },
                    all_vitals: {
                        type: 'boolean',
                        description: 'If true, analyze all available vitals instead of a specific one'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_visit_history',
            description: 'Get past visit notes including chief complaints, assessments, and plans. Useful for reviewing clinical history.',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'integer',
                        description: 'Number of recent visits to return (default 5, max 20)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_medications',
            description: 'Get active medications for the patient with dosage, frequency, and route information.',
            parameters: {
                type: 'object',
                properties: {
                    include_inactive: {
                        type: 'boolean',
                        description: 'If true, also return inactive/discontinued medications'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_orders',
            description: 'Get orders (labs, imaging, procedures, referrals) for the patient.',
            parameters: {
                type: 'object',
                properties: {
                    status_filter: {
                        type: 'string',
                        enum: ['all', 'pending', 'completed', 'cancelled'],
                        description: 'Filter by order status (default: all)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'query_clinical_data',
            description: 'Execute a natural language query against the clinical database. Use this for aggregate questions like "how many patients have X" or "show all visits in the last month". Only SELECT queries are allowed.',
            parameters: {
                type: 'object',
                properties: {
                    sql_query: {
                        type: 'string',
                        description: 'A PostgreSQL SELECT query using only allowed tables and columns'
                    },
                    natural_question: {
                        type: 'string',
                        description: 'The original natural language question for context'
                    }
                },
                required: ['sql_query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'navigate_to',
            description: 'Help the user navigate the EMR interface by providing the correct route and instructions.',
            parameters: {
                type: 'object',
                properties: {
                    destination: {
                        type: 'string',
                        enum: ['schedule', 'inbox', 'patient_chart', 'visit_note', 'billing',
                            'orders', 'medications', 'settings', 'analytics', 'compliance',
                            'documents', 'referrals', 'pending_notes'],
                        description: 'The EMR section to navigate to'
                    },
                    patient_id: {
                        type: 'string',
                        description: 'Patient ID if navigating to a patient-specific page'
                    }
                },
                required: ['destination']
            }
        }
    }
];

// ─── Tool Execution ─────────────────────────────────────────────────────────

/**
 * Execute a tool call from the LLM
 */
async function executeTool(toolName, args, patientContext, patientId, tenantId) {
    const startTime = Date.now();

    try {
        switch (toolName) {

            case 'get_patient_summary': {
                const summary = echoContextEngine.buildContextPrompt(patientContext);
                return { result: summary, dataAccessed: ['patients', 'allergies', 'medications', 'problems', 'visits'] };
            }

            case 'get_vital_trends': {
                const vitalHistory = patientContext.vitalHistory || [];
                if (args.all_vitals) {
                    const allTrends = echoTrendEngine.analyzeAllVitals(vitalHistory);
                    return { result: allTrends, dataAccessed: ['visits.vitals'] };
                }
                if (!args.vital_type) {
                    const summary = echoTrendEngine.generateTrendSummary(vitalHistory);
                    return { result: summary, dataAccessed: ['visits.vitals'] };
                }
                const trend = echoTrendEngine.analyzeVitalTrend(vitalHistory, args.vital_type);
                return { result: trend, dataAccessed: ['visits.vitals'] };
            }

            case 'get_visit_history': {
                const limit = Math.min(args.limit || 5, 20);
                const visits = await pool.query(
                    `SELECT id, visit_date, encounter_date, visit_type, note_type, status,
                            chief_complaint, assessment, plan, note_draft, note_signed_at
                     FROM visits WHERE patient_id = $1
                     ORDER BY visit_date DESC LIMIT $2`,
                    [patientId, limit]
                );
                return { result: visits.rows, dataAccessed: ['visits'] };
            }

            case 'get_medications': {
                let query = 'SELECT * FROM medications WHERE patient_id = $1';
                if (!args.include_inactive) query += ' AND active = true';
                query += ' ORDER BY created_at DESC';
                const meds = await pool.query(query, [patientId]);
                return { result: meds.rows, dataAccessed: ['medications'] };
            }

            case 'get_orders': {
                let query = `SELECT o.*, u.first_name as ordered_by_first, u.last_name as ordered_by_last
                             FROM orders o LEFT JOIN users u ON o.ordered_by = u.id
                             WHERE o.patient_id = $1`;
                const params = [patientId];
                if (args.status_filter && args.status_filter !== 'all') {
                    query += ` AND o.status = $2`;
                    params.push(args.status_filter);
                }
                query += ' ORDER BY o.created_at DESC LIMIT 50';
                const orders = await pool.query(query, params);
                return { result: orders.rows, dataAccessed: ['orders', 'users'] };
            }

            case 'query_clinical_data': {
                const queryResult = await echoSemanticLayer.executeQuery(args.sql_query, tenantId);
                return { result: queryResult, dataAccessed: ['semantic_query'] };
            }

            case 'navigate_to': {
                const routes = {
                    schedule: { path: '/schedule', label: 'Schedule', instructions: 'Open the main schedule view' },
                    inbox: { path: '/inbox', label: 'Inbox', instructions: 'Open the clinical inbox for messages, results, and tasks' },
                    patient_chart: { path: `/snapshot/${args.patient_id || patientId}`, label: 'Patient Chart', instructions: 'Open the patient\'s chart snapshot' },
                    visit_note: { path: `/visit/${args.patient_id || patientId}`, label: 'Visit Note', instructions: 'Open or create a visit note for this patient' },
                    billing: { path: '/billing', label: 'Billing', instructions: 'Open the billing management page' },
                    orders: { path: `/snapshot/${args.patient_id || patientId}`, label: 'Orders', instructions: 'Navigate to Orders section in the patient chart' },
                    medications: { path: `/snapshot/${args.patient_id || patientId}`, label: 'Medications', instructions: 'Navigate to Medications section in the patient chart' },
                    settings: { path: '/admin-settings', label: 'Admin Settings', instructions: 'Open admin settings page' },
                    analytics: { path: '/analytics', label: 'Analytics', instructions: 'Open the analytics dashboard' },
                    compliance: { path: '/compliance', label: 'Compliance', instructions: 'Open the compliance dashboard' },
                    documents: { path: `/snapshot/${args.patient_id || patientId}`, label: 'Documents', instructions: 'Navigate to Documents section in the patient chart' },
                    referrals: { path: `/snapshot/${args.patient_id || patientId}`, label: 'Referrals', instructions: 'Navigate to Referrals section' },
                    pending_notes: { path: '/pending-notes', label: 'Pending Notes', instructions: 'View all unsigned/pending notes' }
                };
                const route = routes[args.destination] || { path: '/', label: 'Home', instructions: 'Navigate to the dashboard' };
                return { result: route, dataAccessed: ['navigation'], type: 'navigation' };
            }

            default:
                return { result: `Unknown tool: ${toolName}`, dataAccessed: [] };
        }
    } catch (err) {
        console.error(`[Echo] Tool ${toolName} failed:`, err.message);
        return { result: `Error executing ${toolName}: ${err.message}`, dataAccessed: [], error: true };
    }
}

// ─── Main Chat Function ─────────────────────────────────────────────────────

/**
 * Process a chat message through the Echo orchestrator
 * 
 * @param {Object} params
 * @param {string} params.message - User's message
 * @param {string} params.patientId - Current patient ID
 * @param {string} params.conversationId - Existing conversation ID (optional)
 * @param {Object} params.user - Authenticated user object
 * @returns {Object} { response, toolCalls, conversationId, usage, visualization }
 */
async function chat({ message, patientId, conversationId, user }) {
    const startTime = Date.now();
    const tenantId = user.clinic_id;

    // 1. Check daily token budget
    const budgetCheck = await checkTokenBudget(tenantId);
    if (!budgetCheck.allowed) {
        return {
            response: '⚠️ Daily AI usage limit reached. Echo will reset at midnight. Contact your administrator for budget adjustments.',
            toolCalls: [],
            usage: { totalTokens: 0, budgetRemaining: 0 }
        };
    }

    // 2. Assemble patient context
    const patientContext = patientId
        ? await echoContextEngine.assemblePatientContext(patientId, tenantId)
        : null;

    // 3. Load or create conversation
    let conversation;
    if (conversationId) {
        conversation = await loadConversation(conversationId);
    }
    if (!conversation) {
        conversation = await createConversation(patientId, user.id, tenantId);
    }

    // 4. Build message history
    const history = await getMessageHistory(conversation.id, 20);

    // 5. Build messages for the LLM
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Add patient context as a system message if available
    if (patientContext) {
        const contextPrompt = echoContextEngine.buildContextPrompt(patientContext);
        messages.push({
            role: 'system',
            content: `CURRENT PATIENT CONTEXT:\n${contextPrompt}`
        });

        // Add schema prompt for semantic queries
        messages.push({
            role: 'system',
            content: echoSemanticLayer.getSchemaPrompt()
        });
    }

    // Add conversation history
    for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
        if (msg.tool_calls) {
            // Re-add tool call/result pairs for continuity
            const toolCalls = typeof msg.tool_calls === 'string' ? JSON.parse(msg.tool_calls) : msg.tool_calls;
            const toolResults = typeof msg.tool_results === 'string' ? JSON.parse(msg.tool_results) : msg.tool_results;
            if (toolResults && Array.isArray(toolResults)) {
                for (const result of toolResults) {
                    messages.push({ role: 'tool', content: JSON.stringify(result.output), tool_call_id: result.tool_call_id });
                }
            }
        }
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // 6. Call LLM with function-calling
    let totalTokens = 0;
    const allToolCalls = [];
    let visualizations = [];
    let finalResponse = '';

    try {
        // Initial LLM call
        let llmResponse = await callLLM(messages, TOOL_CATALOG);
        totalTokens += llmResponse.usage?.total_tokens || 0;

        // Process tool calls (up to 3 rounds to prevent infinite loops)
        let rounds = 0;
        while (llmResponse.tool_calls && llmResponse.tool_calls.length > 0 && rounds < 3) {
            rounds++;
            const assistantMessage = llmResponse.message;
            messages.push(assistantMessage);

            // Execute each tool call
            for (const toolCall of llmResponse.tool_calls) {
                const args = JSON.parse(toolCall.function.arguments || '{}');
                const result = await executeTool(
                    toolCall.function.name, args, patientContext, patientId, tenantId
                );

                allToolCalls.push({
                    name: toolCall.function.name,
                    args,
                    result: typeof result.result === 'object' ? JSON.stringify(result.result).substring(0, 2000) : result.result,
                    dataAccessed: result.dataAccessed
                });

                // Collect visualizations
                if (result.result?.type === 'vital_trend' && result.result?.dataPoints?.length > 0) {
                    visualizations.push(result.result);
                }
                if (result.type === 'navigation') {
                    visualizations.push({ type: 'navigation', ...result.result });
                }

                // Add tool result to messages
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result.result)
                });

                // Audit the tool call
                await logEchoAudit({
                    conversationId: conversation.id,
                    userId: user.id,
                    tenantId,
                    patientId,
                    action: 'tool_execution',
                    toolName: toolCall.function.name,
                    inputRedacted: redactPHI(JSON.stringify(args)),
                    outputSummary: `${result.dataAccessed?.join(', ') || 'unknown'} accessed`,
                    dataAccessed: result.dataAccessed,
                    riskLevel: toolCall.function.name === 'query_clinical_data' ? 'medium' : 'low'
                });
            }

            // Follow-up LLM call with tool results
            llmResponse = await callLLM(messages, TOOL_CATALOG);
            totalTokens += llmResponse.usage?.total_tokens || 0;
        }

        finalResponse = llmResponse.content || '';

    } catch (err) {
        console.error('[Echo] Chat error:', err);
        finalResponse = 'I encountered an error processing your request. Please try again.';
    }

    // 7. Save messages
    await saveMessage(conversation.id, 'user', message, null, null, 0, null);
    await saveMessage(conversation.id, 'assistant', finalResponse, allToolCalls, null, totalTokens, ECHO_MODEL);

    // 8. Update conversation
    await pool.query(
        `UPDATE echo_conversations SET 
            message_count = message_count + 2, 
            total_tokens = total_tokens + $1,
            updated_at = NOW() 
         WHERE id = $2`,
        [totalTokens, conversation.id]
    );

    // 9. Update daily usage
    await updateTokenUsage(tenantId, totalTokens, allToolCalls.length);

    // 10. Audit the overall interaction
    await logEchoAudit({
        conversationId: conversation.id,
        userId: user.id,
        tenantId,
        patientId,
        action: 'chat',
        toolName: null,
        inputRedacted: redactPHI(message),
        outputSummary: `Response: ${finalResponse.substring(0, 200)}...`,
        dataAccessed: [...new Set(allToolCalls.flatMap(tc => tc.dataAccessed))],
        riskLevel: 'low'
    });

    return {
        response: finalResponse,
        toolCalls: allToolCalls.map(tc => ({ name: tc.name, dataAccessed: tc.dataAccessed })),
        conversationId: conversation.id,
        usage: {
            totalTokens,
            model: ECHO_MODEL,
            latencyMs: Date.now() - startTime,
            budgetRemaining: budgetCheck.remaining - totalTokens
        },
        visualizations: visualizations.length > 0 ? visualizations : undefined
    };
}

// ─── LLM Communication ─────────────────────────────────────────────────────

async function callLLM(messages, tools) {
    const body = {
        model: ECHO_MODEL,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 2000
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
        content: choice.message?.content || '',
        message: choice.message,
        tool_calls: choice.message?.tool_calls || null,
        usage: data.usage
    };
}

// ─── Conversation Management ────────────────────────────────────────────────

async function createConversation(patientId, userId, tenantId) {
    const result = await pool.query(
        `INSERT INTO echo_conversations (patient_id, user_id, tenant_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [patientId, userId, tenantId]
    );
    return result.rows[0];
}

async function loadConversation(conversationId) {
    const result = await pool.query(
        'SELECT * FROM echo_conversations WHERE id = $1',
        [conversationId]
    );
    return result.rows[0] || null;
}

async function getMessageHistory(conversationId, limit = 20) {
    const result = await pool.query(
        `SELECT role, content, tool_calls, tool_results FROM echo_messages 
         WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2`,
        [conversationId, limit]
    );
    return result.rows;
}

async function saveMessage(conversationId, role, content, toolCalls, toolResults, tokensUsed, model) {
    await pool.query(
        `INSERT INTO echo_messages (conversation_id, role, content, tool_calls, tool_results, tokens_used, model)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [conversationId, role, content,
            toolCalls ? JSON.stringify(toolCalls) : null,
            toolResults ? JSON.stringify(toolResults) : null,
            tokensUsed, model]
    );
}

// ─── Token Budget ───────────────────────────────────────────────────────────

async function checkTokenBudget(tenantId) {
    try {
        const result = await pool.query(
            `SELECT total_tokens FROM echo_usage WHERE tenant_id = $1 AND usage_date = CURRENT_DATE`,
            [tenantId]
        );
        const used = result.rows[0]?.total_tokens || 0;
        return {
            allowed: used < DAILY_TOKEN_BUDGET,
            used,
            remaining: Math.max(0, DAILY_TOKEN_BUDGET - used),
            budget: DAILY_TOKEN_BUDGET
        };
    } catch (err) {
        console.warn('[Echo] Budget check failed, allowing:', err.message);
        return { allowed: true, used: 0, remaining: DAILY_TOKEN_BUDGET, budget: DAILY_TOKEN_BUDGET };
    }
}

async function updateTokenUsage(tenantId, tokens, toolCalls) {
    try {
        await pool.query(
            `INSERT INTO echo_usage (tenant_id, usage_date, total_tokens, total_requests, total_tool_calls)
             VALUES ($1, CURRENT_DATE, $2, 1, $3)
             ON CONFLICT (tenant_id, usage_date) 
             DO UPDATE SET 
                total_tokens = echo_usage.total_tokens + $2,
                total_requests = echo_usage.total_requests + 1,
                total_tool_calls = echo_usage.total_tool_calls + $3,
                updated_at = NOW()`,
            [tenantId, tokens, toolCalls]
        );
    } catch (err) {
        console.warn('[Echo] Usage update failed:', err.message);
    }
}

// ─── Audit ──────────────────────────────────────────────────────────────────

async function logEchoAudit({ conversationId, userId, tenantId, patientId, action, toolName, inputRedacted, outputSummary, dataAccessed, riskLevel }) {
    try {
        await pool.query(
            `INSERT INTO echo_audit (conversation_id, user_id, tenant_id, patient_id, action, tool_name, input_redacted, output_summary, data_accessed, risk_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [conversationId, userId, tenantId, patientId, action, toolName, inputRedacted, outputSummary, JSON.stringify(dataAccessed), riskLevel]
        );
    } catch (err) {
        console.error('[Echo] Audit log failed:', err.message);
    }
}

// ─── PHI Redaction (reused from aiGateway pattern) ──────────────────────────

function redactPHI(text) {
    if (!text) return text;
    return text
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
        .replace(/\b\d{9}\b/g, '[SSN]')
        .replace(/\b[A-Z]\d{8}\b/gi, '[MRN]')
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    chat,
    TOOL_CATALOG,
    loadConversation,
    getMessageHistory,
    checkTokenBudget
};
