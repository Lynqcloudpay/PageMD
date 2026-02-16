/**
 * Echo Service — Multi-Agent Orchestrator (Phase 2A)
 * 
 * Central brain of Project Echo. Routes user intent to sub-agents via
 * OpenAI function-calling. Manages conversation state, tool execution,
 * token budgets, and audit trails.
 * 
 * Phase 1: Read-only clinical queries, vital trends, semantic SQL
 * Phase 2A: Visit note drafting, write actions, global availability
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

CAPABILITIES (Phase 2A):
- Read patient data: demographics, medications, problems, vitals, visits, orders
- Analyze vital trends with clinical guidelines
- Draft visit note sections (HPI, assessment, plan)
- Suggest ICD-10 diagnoses based on clinical context
- Add problems, medications, and orders to the chart (with confirmation)
- Work globally: answer questions about schedule, inbox, and pending notes
- Navigate the EMR interface

CONSTRAINTS:
- Never fabricate clinical data. If data is unavailable, say so explicitly.
- Always recommend provider verification for critical findings
- Flag concerning trends with severity markers
- When presenting vitals or labs, always include the date of measurement
- For medication questions, include dose, frequency, and route
- Do not provide treatment recommendations — only data-driven observations
- For WRITE ACTIONS: Always present the action details clearly and mark them for confirmation
- For note drafting: Generate clinically appropriate content based on available data only

RESPONSE FORMAT:
- Use markdown formatting for structured data
- Use tables for comparing values across dates
- Use bullet points for lists of findings
- Keep responses under 500 words unless the user asks for detail
- End with a brief "Key Takeaway" when summarizing complex data
- For drafted notes: Clearly label each section (HPI, Assessment, Plan)

WRITE ACTION FORMAT:
When executing a write action (add_problem, add_medication, create_order), describe what you did concisely.
Example: "✅ Added **Essential Hypertension** (I10) to the problem list."`;

// ─── Tool Catalog (OpenAI Function Definitions) ────────────────────────────

const TOOL_CATALOG = [
    // ── Phase 1: Read-Only Tools ────────────────────────────────────────
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
                            'documents', 'referrals', 'pending_notes', 'dashboard'],
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
    },

    // ── Phase 2A: Visit Note Drafting ───────────────────────────────────
    {
        type: 'function',
        function: {
            name: 'draft_note_section',
            description: 'Generate a clinical note section draft (HPI, Assessment, or Plan) based on the patient context, chief complaint, and visit type. The provider will review and edit before finalizing.',
            parameters: {
                type: 'object',
                properties: {
                    section: {
                        type: 'string',
                        enum: ['hpi', 'assessment', 'plan', 'full_note'],
                        description: 'Which note section to draft'
                    },
                    chief_complaint: {
                        type: 'string',
                        description: 'The chief complaint or reason for visit'
                    },
                    visit_type: {
                        type: 'string',
                        description: 'Type of visit (follow-up, new patient, acute, annual physical)'
                    },
                    additional_context: {
                        type: 'string',
                        description: 'Any additional context from the user to incorporate into the draft'
                    }
                },
                required: ['section']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'suggest_diagnoses',
            description: 'Suggest ICD-10 diagnoses based on the chief complaint, symptoms, and patient history. Returns a list of relevant diagnosis codes with descriptions.',
            parameters: {
                type: 'object',
                properties: {
                    symptoms: {
                        type: 'string',
                        description: 'Symptoms or chief complaint to generate diagnosis suggestions for'
                    },
                    max_results: {
                        type: 'integer',
                        description: 'Max number of suggestions (default 5)'
                    }
                },
                required: ['symptoms']
            }
        }
    },

    // ── Phase 2A: Write Actions ─────────────────────────────────────────
    {
        type: 'function',
        function: {
            name: 'add_problem',
            description: 'Add a problem/diagnosis to the patient problem list. Use this when the provider confirms they want to add a diagnosis.',
            parameters: {
                type: 'object',
                properties: {
                    problem_name: {
                        type: 'string',
                        description: 'Name of the problem/diagnosis (e.g., "Essential Hypertension")'
                    },
                    icd10_code: {
                        type: 'string',
                        description: 'ICD-10 code (e.g., "I10")'
                    },
                    status: {
                        type: 'string',
                        enum: ['active', 'resolved', 'inactive'],
                        description: 'Problem status (default: active)'
                    }
                },
                required: ['problem_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'add_medication',
            description: 'Add a medication to the patient medication list. Use this when the provider confirms they want to prescribe or document a medication.',
            parameters: {
                type: 'object',
                properties: {
                    medication_name: {
                        type: 'string',
                        description: 'Name of the medication (e.g., "Lisinopril")'
                    },
                    dosage: {
                        type: 'string',
                        description: 'Dosage (e.g., "10mg")'
                    },
                    frequency: {
                        type: 'string',
                        description: 'Frequency (e.g., "daily", "twice daily", "PRN")'
                    },
                    route: {
                        type: 'string',
                        description: 'Route (e.g., "oral", "topical", "IV")'
                    }
                },
                required: ['medication_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: 'Create a clinical order (lab, imaging, referral, procedure). Use when the provider wants to place an order.',
            parameters: {
                type: 'object',
                properties: {
                    order_type: {
                        type: 'string',
                        enum: ['lab', 'imaging', 'referral', 'procedure'],
                        description: 'Type of order'
                    },
                    order_name: {
                        type: 'string',
                        description: 'Name of the order (e.g., "CBC with Differential", "Chest X-Ray")'
                    },
                    priority: {
                        type: 'string',
                        enum: ['routine', 'urgent', 'stat'],
                        description: 'Order priority (default: routine)'
                    },
                    indication: {
                        type: 'string',
                        description: 'Clinical indication/reason for the order'
                    }
                },
                required: ['order_type', 'order_name']
            }
        }
    },

    // ── Phase 2A: Global Tools (non-patient) ────────────────────────────
    {
        type: 'function',
        function: {
            name: 'get_schedule_summary',
            description: 'Get today\'s schedule summary including appointment counts, upcoming patients, and gaps. Works without a specific patient context.',
            parameters: {
                type: 'object',
                properties: {
                    date: {
                        type: 'string',
                        description: 'Date to check (YYYY-MM-DD format, default: today)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_pending_notes',
            description: 'Get a list of unsigned/pending clinical notes that need attention.',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'integer',
                        description: 'Max notes to return (default: 10)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_inbox_summary',
            description: 'Get inbox summary with counts of unread messages, pending results, tasks, and refill requests.',
            parameters: {
                type: 'object',
                properties: {}
            }
        }
    }
];

// ─── Tool Execution ─────────────────────────────────────────────────────────

async function executeTool(toolName, args, patientContext, patientId, tenantId, userId) {
    try {
        switch (toolName) {

            // ── Phase 1 Tools ───────────────────────────────────────────
            case 'get_patient_summary': {
                if (!patientContext) return { result: 'No patient selected. Please navigate to a patient chart first.', dataAccessed: [] };
                const summary = echoContextEngine.buildContextPrompt(patientContext);
                return { result: summary, dataAccessed: ['patients', 'allergies', 'medications', 'problems', 'visits'] };
            }

            case 'get_vital_trends': {
                if (!patientContext) return { result: 'No patient selected.', dataAccessed: [] };
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
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
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
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                let query = 'SELECT * FROM medications WHERE patient_id = $1';
                if (!args.include_inactive) query += ' AND active = true';
                query += ' ORDER BY created_at DESC';
                const meds = await pool.query(query, [patientId]);
                return { result: meds.rows, dataAccessed: ['medications'] };
            }

            case 'get_orders': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
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
                    dashboard: { path: '/dashboard', label: 'Dashboard', instructions: 'Open the main dashboard' },
                    schedule: { path: '/schedule', label: 'Schedule', instructions: 'Open the main schedule view' },
                    inbox: { path: '/tasks', label: 'Inbox', instructions: 'Open the clinical inbox for messages, results, and tasks' },
                    patient_chart: { path: `/patient/${args.patient_id || patientId}/snapshot`, label: 'Patient Chart', instructions: 'Open the patient\'s chart snapshot' },
                    visit_note: { path: `/patient/${args.patient_id || patientId}/visit/new`, label: 'Visit Note', instructions: 'Open or create a visit note for this patient' },
                    billing: { path: '/billing', label: 'Billing', instructions: 'Open the billing management page' },
                    orders: { path: `/patient/${args.patient_id || patientId}/snapshot`, label: 'Orders', instructions: 'Navigate to Orders section in the patient chart' },
                    medications: { path: `/patient/${args.patient_id || patientId}/snapshot`, label: 'Medications', instructions: 'Navigate to Medications section in the patient chart' },
                    settings: { path: '/admin-settings', label: 'Admin Settings', instructions: 'Open admin settings page' },
                    analytics: { path: '/analytics', label: 'Analytics', instructions: 'Open the analytics dashboard' },
                    compliance: { path: '/compliance', label: 'Compliance', instructions: 'Open the compliance dashboard' },
                    documents: { path: `/patient/${args.patient_id || patientId}/snapshot`, label: 'Documents', instructions: 'Navigate to Documents section in the patient chart' },
                    referrals: { path: `/patient/${args.patient_id || patientId}/snapshot`, label: 'Referrals', instructions: 'Navigate to Referrals section' },
                    pending_notes: { path: '/pending-notes', label: 'Pending Notes', instructions: 'View all unsigned/pending notes' }
                };
                const route = routes[args.destination] || { path: '/', label: 'Home', instructions: 'Navigate to the dashboard' };
                return { result: route, dataAccessed: ['navigation'], type: 'navigation' };
            }

            // ── Phase 2A: Note Drafting Tools ───────────────────────────
            case 'draft_note_section': {
                if (!patientContext) return { result: 'No patient selected. Please navigate to a patient chart to draft notes.', dataAccessed: [] };
                const draft = generateNoteDraft(args, patientContext);
                return {
                    result: draft,
                    dataAccessed: ['patients', 'medications', 'problems', 'visits', 'vitals'],
                    type: 'note_draft'
                };
            }

            case 'suggest_diagnoses': {
                const suggestions = generateDiagnosisSuggestions(args.symptoms, patientContext, args.max_results || 5);
                return {
                    result: suggestions,
                    dataAccessed: ['diagnosis_suggestions'],
                    type: 'diagnosis_suggestions'
                };
            }

            // ── Phase 2A: Write Actions ─────────────────────────────────
            case 'add_problem': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                const prob = await pool.query(
                    `INSERT INTO problems (patient_id, problem_name, icd10_code, status)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [patientId, args.problem_name, args.icd10_code || null, args.status || 'active']
                );
                return {
                    result: {
                        success: true,
                        message: `Added "${args.problem_name}"${args.icd10_code ? ` (${args.icd10_code})` : ''} to the problem list.`,
                        record: prob.rows[0]
                    },
                    dataAccessed: ['problems'],
                    type: 'write_action',
                    writeType: 'add_problem'
                };
            }

            case 'add_medication': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                const med = await pool.query(
                    `INSERT INTO medications (patient_id, medication_name, dosage, frequency, route, prescriber_id, active, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                    [patientId, args.medication_name, args.dosage || null, args.frequency || null,
                        args.route || 'oral', userId, true, 'active']
                );
                return {
                    result: {
                        success: true,
                        message: `Added ${args.medication_name}${args.dosage ? ` ${args.dosage}` : ''}${args.frequency ? ` ${args.frequency}` : ''} to the medication list.`,
                        record: med.rows[0]
                    },
                    dataAccessed: ['medications'],
                    type: 'write_action',
                    writeType: 'add_medication'
                };
            }

            case 'create_order': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                const order = await pool.query(
                    `INSERT INTO orders (patient_id, order_type, ordered_by, order_payload)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [patientId, args.order_type, userId,
                        JSON.stringify({
                            test_name: args.order_name,
                            priority: args.priority || 'routine',
                            indication: args.indication || null,
                            source: 'echo_ai'
                        })
                    ]
                );
                return {
                    result: {
                        success: true,
                        message: `Created ${args.priority || 'routine'} ${args.order_type} order: ${args.order_name}`,
                        record: order.rows[0]
                    },
                    dataAccessed: ['orders'],
                    type: 'write_action',
                    writeType: 'create_order'
                };
            }

            // ── Phase 2A: Global Tools ──────────────────────────────────
            case 'get_schedule_summary': {
                const targetDate = args.date || new Date().toISOString().split('T')[0];
                const schedule = await pool.query(
                    `SELECT 
                        COUNT(*) as total_appointments,
                        COUNT(CASE WHEN patient_status = 'checked-in' THEN 1 END) as checked_in,
                        COUNT(CASE WHEN patient_status = 'in-room' THEN 1 END) as in_room,
                        COUNT(CASE WHEN patient_status = 'completed' OR patient_status = 'checked-out' THEN 1 END) as completed,
                        COUNT(CASE WHEN patient_status = 'no-show' THEN 1 END) as no_shows,
                        COUNT(CASE WHEN patient_status = 'cancelled' THEN 1 END) as cancelled
                     FROM appointments
                     WHERE appointment_date = $1`,
                    [targetDate]
                );

                const upcoming = await pool.query(
                    `SELECT a.appointment_time, a.visit_type, a.patient_status,
                            p.first_name as patient_first, p.last_name as patient_last,
                            u.first_name as provider_first, u.last_name as provider_last
                     FROM appointments a
                     JOIN patients p ON a.patient_id = p.id
                     JOIN users u ON a.provider_id = u.id
                     WHERE a.appointment_date = $1 
                       AND a.patient_status NOT IN ('completed', 'checked-out', 'cancelled', 'no-show')
                     ORDER BY a.appointment_time ASC LIMIT 10`,
                    [targetDate]
                );

                return {
                    result: {
                        date: targetDate,
                        summary: schedule.rows[0],
                        upcoming: upcoming.rows
                    },
                    dataAccessed: ['appointments', 'patients', 'users']
                };
            }

            case 'get_pending_notes': {
                const limit = Math.min(args.limit || 10, 30);
                const pending = await pool.query(
                    `SELECT v.id, v.visit_date, v.visit_type, v.chief_complaint, v.status,
                            p.first_name as patient_first, p.last_name as patient_last,
                            u.first_name as provider_first, u.last_name as provider_last
                     FROM visits v
                     JOIN patients p ON v.patient_id = p.id
                     LEFT JOIN users u ON v.provider_id = u.id
                     WHERE v.status IN ('in-progress', 'draft', 'open')
                       AND v.note_signed_at IS NULL
                     ORDER BY v.visit_date DESC LIMIT $1`,
                    [limit]
                );

                return {
                    result: {
                        count: pending.rows.length,
                        notes: pending.rows
                    },
                    dataAccessed: ['visits', 'patients', 'users']
                };
            }

            case 'get_inbox_summary': {
                const inbox = await pool.query(
                    `SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = 'unread' OR status = 'new' THEN 1 END) as unread,
                        COUNT(CASE WHEN category = 'result' THEN 1 END) as results,
                        COUNT(CASE WHEN category = 'message' THEN 1 END) as messages,
                        COUNT(CASE WHEN category = 'task' THEN 1 END) as tasks,
                        COUNT(CASE WHEN category = 'refill' THEN 1 END) as refills
                     FROM inbox_items
                     WHERE status != 'archived'`
                );

                return {
                    result: inbox.rows[0] || { total: 0, unread: 0, results: 0, messages: 0, tasks: 0, refills: 0 },
                    dataAccessed: ['inbox_items']
                };
            }

            default:
                return { result: `Unknown tool: ${toolName}`, dataAccessed: [] };
        }
    } catch (err) {
        console.error(`[Echo] Tool ${toolName} failed:`, err.message);
        return { result: `Error executing ${toolName}: ${err.message}`, dataAccessed: [], error: true };
    }
}

// ─── Note Drafting Engine ───────────────────────────────────────────────────

function generateNoteDraft(args, context) {
    const { section, chief_complaint, visit_type, additional_context } = args;

    const d = context.demographics;
    const patientDesc = d
        ? `${d.first_name} ${d.last_name}, ${d.dob ? calculateAge(d.dob) : 'unknown age'}, ${d.sex || 'sex unknown'}`
        : 'this patient';

    const activeMeds = (context.medications || []).map(m =>
        `${m.medication_name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`
    ).join(', ');

    const activeProblems = (context.problems || []).map(p =>
        `${p.name || p.problem_name}${p.code || p.icd10_code ? ` (${p.code || p.icd10_code})` : ''}`
    ).join(', ');

    const latestVitals = buildVitalsSummary(context.vitalHistory);
    const cc = chief_complaint || 'follow-up';
    const vt = visit_type || 'follow-up';

    const result = {
        type: 'note_draft',
        section,
        chief_complaint: cc,
        visit_type: vt,
        drafts: {}
    };

    if (section === 'hpi' || section === 'full_note') {
        result.drafts.hpi = buildHPIDraft(patientDesc, cc, vt, activeProblems, activeMeds, latestVitals, context.recentVisits, additional_context);
    }
    if (section === 'assessment' || section === 'full_note') {
        result.drafts.assessment = buildAssessmentDraft(patientDesc, cc, activeProblems, latestVitals, context.recentVisits);
    }
    if (section === 'plan' || section === 'full_note') {
        result.drafts.plan = buildPlanDraft(cc, activeProblems, activeMeds, context.activeOrders);
    }

    return result;
}

function buildHPIDraft(patientDesc, cc, visitType, problems, meds, vitals, recentVisits, extra) {
    const parts = [];
    parts.push(`${patientDesc} presents for ${visitType} visit with chief complaint of ${cc}.`);

    if (problems) {
        parts.push(`\nActive medical history includes: ${problems}.`);
    }

    if (meds) {
        parts.push(`Current medications: ${meds}.`);
    }

    if (recentVisits?.length > 0) {
        const last = recentVisits[0];
        const lastDate = last.date || last.visit_date;
        const lastCC = last.chief_complaint || last.type || 'visit';
        parts.push(`Last visit was on ${lastDate} for ${lastCC}.`);
    }

    if (vitals) {
        parts.push(`Today's vitals: ${vitals}.`);
    }

    if (extra) {
        parts.push(`\nAdditional context: ${extra}.`);
    }

    parts.push('\n[Provider: Please review and expand with subjective findings from patient interview.]');

    return parts.join(' ');
}

function buildAssessmentDraft(patientDesc, cc, problems, vitals, recentVisits) {
    const parts = [];
    parts.push(`${patientDesc} presenting with ${cc}.`);

    if (problems) {
        parts.push(`\nActive problem list:\n${problems.split(', ').map(p => `- ${p}`).join('\n')}`);
    }

    if (vitals) {
        parts.push(`\nVitals today: ${vitals}`);
    }

    parts.push('\n\n[Provider: Please add clinical impressions, differential diagnoses, and assessment notes.]');

    return parts.join('');
}

function buildPlanDraft(cc, problems, meds, orders) {
    const parts = [];
    parts.push(`Plan for ${cc}:\n`);

    if (meds) {
        parts.push(`Current medications: Continue ${meds} as prescribed.`);
    }

    if (orders?.length > 0) {
        const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'sent');
        if (pendingOrders.length > 0) {
            parts.push(`\nPending orders: ${pendingOrders.map(o => o.name || o.order_type).join(', ')}`);
        }
    }

    parts.push('\n\n[Provider: Please specify follow-up interval, medication changes, referrals, and patient education.]');

    return parts.join('');
}

function buildVitalsSummary(vitalHistory) {
    if (!vitalHistory?.length) return null;
    const latest = vitalHistory[vitalHistory.length - 1];
    if (!latest?.vitals) return null;

    const v = typeof latest.vitals === 'string' ? JSON.parse(latest.vitals) : latest.vitals;
    const parts = [];
    if (v.systolicBp && v.diastolicBp) parts.push(`BP ${v.systolicBp}/${v.diastolicBp}`);
    if (v.heartRate) parts.push(`HR ${v.heartRate}`);
    if (v.temperature) parts.push(`Temp ${v.temperature}`);
    if (v.oxygenSaturation) parts.push(`SpO2 ${v.oxygenSaturation}%`);
    if (v.weight) parts.push(`Wt ${v.weight}`);
    if (v.respiratoryRate) parts.push(`RR ${v.respiratoryRate}`);
    return parts.length > 0 ? parts.join(', ') : null;
}

function calculateAge(dob) {
    if (!dob) return null;
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) age--;
    return `${age}yo`;
}

// ─── Diagnosis Suggestion Engine ────────────────────────────────────────────

function generateDiagnosisSuggestions(symptoms, context, maxResults) {
    // Common ICD-10 mapped by keyword clusters
    const DIAGNOSIS_MAP = [
        { keywords: ['hypertension', 'high blood pressure', 'htn', 'elevated bp'], code: 'I10', name: 'Essential Hypertension' },
        { keywords: ['diabetes', 'type 2', 'dm2', 'a1c', 'glucose', 'sugar'], code: 'E11.9', name: 'Type 2 Diabetes Mellitus without complications' },
        { keywords: ['diabetes', 'type 1', 'dm1', 'insulin dependent'], code: 'E10.9', name: 'Type 1 Diabetes Mellitus without complications' },
        { keywords: ['chest pain', 'angina', 'substernal'], code: 'R07.9', name: 'Chest Pain, unspecified' },
        { keywords: ['headache', 'cephalgia', 'head pain'], code: 'R51.9', name: 'Headache, unspecified' },
        { keywords: ['migraine'], code: 'G43.909', name: 'Migraine, unspecified' },
        { keywords: ['back pain', 'low back', 'lumbago', 'lumbar'], code: 'M54.5', name: 'Low Back Pain' },
        { keywords: ['knee pain', 'knee'], code: 'M25.569', name: 'Pain in unspecified knee' },
        { keywords: ['shoulder pain', 'shoulder'], code: 'M25.519', name: 'Pain in unspecified shoulder' },
        { keywords: ['cough', 'bronchitis'], code: 'R05.9', name: 'Cough, unspecified' },
        { keywords: ['shortness of breath', 'dyspnea', 'sob'], code: 'R06.00', name: 'Dyspnea, unspecified' },
        { keywords: ['anxiety', 'anxious', 'gad'], code: 'F41.1', name: 'Generalized Anxiety Disorder' },
        { keywords: ['depression', 'depressed', 'mdd'], code: 'F32.9', name: 'Major Depressive Disorder, single episode' },
        { keywords: ['insomnia', 'sleep', 'cant sleep'], code: 'G47.00', name: 'Insomnia, unspecified' },
        { keywords: ['uti', 'urinary tract', 'dysuria', 'urinary infection'], code: 'N39.0', name: 'Urinary Tract Infection, site not specified' },
        { keywords: ['pneumonia'], code: 'J18.9', name: 'Pneumonia, unspecified organism' },
        { keywords: ['asthma', 'wheezing'], code: 'J45.909', name: 'Unspecified Asthma, uncomplicated' },
        { keywords: ['copd', 'emphysema', 'chronic obstructive'], code: 'J44.1', name: 'COPD with acute exacerbation' },
        { keywords: ['anemia', 'low hemoglobin'], code: 'D64.9', name: 'Anemia, unspecified' },
        { keywords: ['hyperlipidemia', 'cholesterol', 'lipids', 'high cholesterol'], code: 'E78.5', name: 'Hyperlipidemia, unspecified' },
        { keywords: ['hypothyroid', 'thyroid', 'tsh'], code: 'E03.9', name: 'Hypothyroidism, unspecified' },
        { keywords: ['obesity', 'overweight', 'bmi'], code: 'E66.9', name: 'Obesity, unspecified' },
        { keywords: ['abdominal pain', 'stomach pain', 'belly pain'], code: 'R10.9', name: 'Unspecified Abdominal Pain' },
        { keywords: ['nausea', 'vomiting'], code: 'R11.2', name: 'Nausea with Vomiting, unspecified' },
        { keywords: ['diarrhea'], code: 'R19.7', name: 'Diarrhea, unspecified' },
        { keywords: ['constipation'], code: 'K59.00', name: 'Constipation, unspecified' },
        { keywords: ['rash', 'dermatitis', 'eczema'], code: 'L30.9', name: 'Dermatitis, unspecified' },
        { keywords: ['sore throat', 'pharyngitis', 'strep'], code: 'J02.9', name: 'Acute Pharyngitis, unspecified' },
        { keywords: ['sinusitis', 'sinus'], code: 'J01.90', name: 'Acute Sinusitis, unspecified' },
        { keywords: ['otitis', 'ear infection', 'ear pain'], code: 'H66.90', name: 'Otitis Media, unspecified' },
        { keywords: ['fatigue', 'tired', 'exhaustion', 'malaise'], code: 'R53.83', name: 'Other Fatigue' },
        { keywords: ['dizziness', 'vertigo', 'lightheaded'], code: 'R42', name: 'Dizziness and Giddiness' },
        { keywords: ['gerd', 'reflux', 'heartburn', 'acid'], code: 'K21.0', name: 'GERD with Esophagitis' },
        { keywords: ['edema', 'swelling', 'fluid retention'], code: 'R60.9', name: 'Edema, unspecified' },
        { keywords: ['conjunctivitis', 'pink eye', 'eye infection'], code: 'H10.9', name: 'Unspecified Conjunctivitis' },
        { keywords: ['well visit', 'annual', 'physical', 'wellness', 'routine exam'], code: 'Z00.00', name: 'Encounter for general adult medical examination' },
        { keywords: ['follow up', 'follow-up', 'f/u'], code: 'Z09', name: 'Encounter for follow-up examination' },
    ];

    const lower = symptoms.toLowerCase();
    const scored = DIAGNOSIS_MAP.map(dx => {
        const matchCount = dx.keywords.filter(kw => lower.includes(kw)).length;
        return { ...dx, score: matchCount };
    }).filter(dx => dx.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

    // Also consider existing problems for relevance
    if (context?.problems?.length > 0 && scored.length < maxResults) {
        const existingCodes = new Set(scored.map(s => s.code));
        for (const p of context.problems) {
            if (existingCodes.size >= maxResults) break;
            const code = p.code || p.icd10_code;
            if (code && !existingCodes.has(code)) {
                scored.push({
                    code,
                    name: p.name || p.problem_name,
                    score: 0.5,
                    source: 'existing_problem'
                });
                existingCodes.add(code);
            }
        }
    }

    return {
        query: symptoms,
        suggestions: scored.map(s => ({
            icd10_code: s.code,
            description: s.name,
            relevance: s.score > 1 ? 'high' : s.score > 0 ? 'medium' : 'contextual',
            source: s.source || 'keyword_match'
        }))
    };
}

// ─── Main Chat Function ─────────────────────────────────────────────────────

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

    // 2. Assemble patient context (only if a patient is selected)
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
    } else {
        // Global mode — no patient selected
        messages.push({
            role: 'system',
            content: 'MODE: Global (no patient selected). You can help with schedule, inbox, pending notes, navigation, and general EMR questions. If the user asks about a specific patient, suggest they navigate to that patient\'s chart first.'
        });
    }

    // Add conversation history
    for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
        if (msg.tool_calls) {
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

    // 6. Determine which tools are available based on context
    const availableTools = patientId
        ? TOOL_CATALOG  // All tools when a patient is selected
        : TOOL_CATALOG.filter(t => {
            const name = t.function.name;
            // Only global tools when no patient
            return ['get_schedule_summary', 'get_pending_notes', 'get_inbox_summary',
                'navigate_to', 'query_clinical_data'].includes(name);
        });

    // 7. Call LLM with function-calling
    let totalTokens = 0;
    const allToolCalls = [];
    let visualizations = [];
    let finalResponse = '';
    let writeActions = [];

    try {
        let llmResponse = await callLLM(messages, availableTools);
        totalTokens += llmResponse.usage?.total_tokens || 0;

        // Process tool calls (up to 3 rounds)
        let rounds = 0;
        while (llmResponse.tool_calls && llmResponse.tool_calls.length > 0 && rounds < 3) {
            rounds++;
            const assistantMessage = llmResponse.message;
            messages.push(assistantMessage);

            for (const toolCall of llmResponse.tool_calls) {
                const args = JSON.parse(toolCall.function.arguments || '{}');
                const result = await executeTool(
                    toolCall.function.name, args, patientContext, patientId, tenantId, user.id
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
                if (result.type === 'note_draft') {
                    visualizations.push({ type: 'note_draft', ...result.result });
                }
                if (result.type === 'diagnosis_suggestions') {
                    visualizations.push({ type: 'diagnosis_suggestions', ...result.result });
                }

                // Track write actions
                if (result.type === 'write_action') {
                    writeActions.push({
                        type: result.writeType,
                        success: result.result?.success || false,
                        message: result.result?.message,
                        record: result.result?.record
                    });
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result.result)
                });

                // Audit
                await logEchoAudit({
                    conversationId: conversation.id,
                    userId: user.id,
                    tenantId,
                    patientId,
                    action: result.type === 'write_action' ? 'write_action' : 'tool_execution',
                    toolName: toolCall.function.name,
                    inputRedacted: redactPHI(JSON.stringify(args)),
                    outputSummary: `${result.dataAccessed?.join(', ') || 'unknown'} accessed`,
                    dataAccessed: result.dataAccessed,
                    riskLevel: result.type === 'write_action' ? 'high' :
                        toolCall.function.name === 'query_clinical_data' ? 'medium' : 'low'
                });
            }

            llmResponse = await callLLM(messages, availableTools);
            totalTokens += llmResponse.usage?.total_tokens || 0;
        }

        finalResponse = llmResponse.content || '';

    } catch (err) {
        console.error('[Echo] Chat error:', err);
        finalResponse = 'I encountered an error processing your request. Please try again.';
    }

    // 8. Save messages
    await saveMessage(conversation.id, 'user', message, null, null, 0, null);
    await saveMessage(conversation.id, 'assistant', finalResponse, allToolCalls, null, totalTokens, ECHO_MODEL);

    // 9. Update conversation
    await pool.query(
        `UPDATE echo_conversations SET 
            message_count = message_count + 2, 
            total_tokens = total_tokens + $1,
            updated_at = NOW() 
         WHERE id = $2`,
        [totalTokens, conversation.id]
    );

    // 10. Update daily usage
    await updateTokenUsage(tenantId, totalTokens, allToolCalls.length);

    // 11. Audit
    await logEchoAudit({
        conversationId: conversation.id,
        userId: user.id,
        tenantId,
        patientId,
        action: writeActions.length > 0 ? 'chat_with_writes' : 'chat',
        toolName: null,
        inputRedacted: redactPHI(message),
        outputSummary: `Response: ${finalResponse.substring(0, 200)}...`,
        dataAccessed: [...new Set(allToolCalls.flatMap(tc => tc.dataAccessed))],
        riskLevel: writeActions.length > 0 ? 'high' : 'low'
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
        visualizations: visualizations.length > 0 ? visualizations : undefined,
        writeActions: writeActions.length > 0 ? writeActions : undefined
    };
}

// ─── LLM Communication ─────────────────────────────────────────────────────

async function callLLM(messages, tools) {
    const body = {
        model: ECHO_MODEL,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
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

// ─── PHI Redaction ──────────────────────────────────────────────────────────

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
