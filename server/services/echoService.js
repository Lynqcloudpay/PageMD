/**
 * Echo Service — Multi-Agent Orchestrator (Phase 1-4)
 * 
 * Central brain of Project Echo. Routes user intent to sub-agents via
 * OpenAI function-calling. Manages conversation state, tool execution,
 * token budgets, and audit trails.
 * 
 * Phase 1: Read-only clinical queries, vital trends, semantic SQL
 * Phase 2A: Visit note drafting, write actions, global availability
 * Phase 2B: Lab result intelligence, auto-interpretation, trend analysis
 * Phase 2C: Clinical decision support, gaps, DDI
 * Phase 2D: Voice dictation (Whisper)
 * Phase 3: Staged actions, batch commit, navigation observer
 * Phase 4: Document analysis (Vision), guideline citations, risk alerts
 */

const pool = require('../db');
const echoContextEngine = require('./echoContextEngine');
const echoTrendEngine = require('./echoTrendEngine');
const echoSemanticLayer = require('./echoSemanticLayer');
const echoLabEngine = require('./echoLabEngine');
const echoCDSEngine = require('./echoCDSEngine');
const echoScoreEngine = require('./echoScoreEngine');
const echoGuidelineEngine = require('./echoGuidelineEngine');

const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
if (!AI_API_KEY) {
    console.warn('[Echo] WARNING: Neither AI_API_KEY nor OPENAI_API_KEY found in environment.');
}
const ECHO_MODEL = process.env.ECHO_MODEL || 'gpt-4o';
const DAILY_TOKEN_BUDGET = parseInt(process.env.ECHO_DAILY_TOKEN_BUDGET || '500000');

const BASE_SYSTEM_PROMPT = `You are Eko, a clinical AI assistant embedded in the PageMD EMR.
PERSONALITY:
- Clinical & Thorough: Information accuracy is highest priority. Never guess.
- Human-in-the-Loop: You STAGE actions for approval. Never decide alone.
- Always calculate what is asked: When asked for risk scores (CHADS-VASc, ASCVD, MELD), ALWAYS call get_risk_scores with the appropriate score_type. Use defaults when data is missing and flag assumptions. Never refuse to calculate.
- Tiered Search: Start with the baseline; use tools if more facts are needed.
- Full-Spectrum Agent: You can generate referral letters, clinical letters (work excuses, disability, FMLA), suggest billing codes, prepare pre-visit briefs, create after-visit summaries, generate clinical handoffs, reconcile medications, and suggest evidence-based follow-up plans. Always use the appropriate tool when asked.

RESPONSE STYLE:
- No markdown headers or tables. Use **[text]** for labels, !![text]!! for alerts.`;

const SPECIALIST_PROMPTS = {
    scribe: `TASK: Clinical Documentation Specialist.
Focus on organic, narrative "Doctor's voice". 
- Draft HPI, Assessment, and Plan clearly.
- No ICD-10 codes in narrative.
- After drafting, say "I've drafted the [Section] for you below" and provide a brief Key Takeaway.`,

    analyst: `TASK: Clinical Data Analyst.
Focus on longitudinal data, trends, and evidence.
- Analyze labs, vitals, and visit history for patterns.
- Highlighting clinical significance of trends (e.g., rising glucose).
- Use tools to verify any "probable" findings.`,

    manager: `TASK: Clinical Operations Manager.
Focus on Treatment Plans and Orders.
- Staging problems, medications, and lab orders.
- Always check for existing problems/meds before staging duplicates.
- Mandatory: say "I've staged adding **[Item]** for your approval."`,

    navigator: `TASK: EMR Operations Specialist.
Focus on schedule, navigation, administrative overview, and operational tasks.
- Helping find data, summaries of the day, and navigating the interface.
- Scheduling appointments, sending messages to patients, and creating reminders/tasks.
- When asked to message a patient, schedule an appointment, or create a reminder, use the appropriate tool to stage the action for provider approval.`
};

function getSystemPrompt(intent = 'general') {
    const specialist = SPECIALIST_PROMPTS[intent] || '';
    return `${BASE_SYSTEM_PROMPT}\n\n${specialist}\n\nAlways include a **Key Takeaway:** at the end.`;
}

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
            name: 'get_lab_history',
            description: 'Get deep historical lab results for a patient. Use this for longitudinal analysis when the baseline context is insufficient.',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'integer',
                        description: 'Number of lab results to return (default 50, max 200)'
                    },
                    test_name: {
                        type: 'string',
                        description: 'Optional filter for a specific test (e.g., "A1c", "Hemoglobin")'
                    }
                }
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
                    },
                    custom_narrative: {
                        type: 'string',
                        description: 'A fully synthesized, organic narrative draft for the section. If provided, this will be used instead of the generated template.'
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

    // ── Phase 2B: Lab Intelligence Tools ─────────────────────────────────
    {
        type: 'function',
        function: {
            name: 'interpret_lab_results',
            description: 'Interpret all lab results for the patient. Auto-flags abnormals and criticals with clinical context, reference ranges, and follow-up suggestions.',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'integer',
                        description: 'Number of recent lab orders to analyze (default 10)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_lab_trends',
            description: 'Analyze trends for a specific lab test over time (e.g., HbA1c trend, creatinine trend). Shows direction, percent change, and clinical significance.',
            parameters: {
                type: 'object',
                properties: {
                    test_name: {
                        type: 'string',
                        description: 'Name of the lab test to track (e.g., "HbA1c", "creatinine", "TSH", "LDL")'
                    }
                },
                required: ['test_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'interpret_specific_test',
            description: 'Interpret a single lab test value with clinical context. Use when the user mentions a specific test and value.',
            parameters: {
                type: 'object',
                properties: {
                    test_name: {
                        type: 'string',
                        description: 'Lab test name (e.g., "TSH", "HbA1c", "potassium")'
                    },
                    value: {
                        type: 'number',
                        description: 'The numeric test result value'
                    }
                },
                required: ['test_name', 'value']
            }
        }
    },

    {
        type: 'function',
        function: {
            name: 'check_clinical_gaps',
            description: 'Analyzes patient history for missing preventive screenings (mammograms, colonoscopies) or chronic care gaps (diabetic eye exams).',
            parameters: {
                type: 'object',
                properties: {
                    focus: { type: 'string', enum: ['preventive', 'chronic', 'all'], default: 'all' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_risk_scores',
            description: 'Calculates standardized clinical risk scores (ASCVD, CHA2DS2-VASc, MELD) based on the current patient context (vitals, labs, problems).',
            parameters: {
                type: 'object',
                properties: {
                    score_type: {
                        type: 'string',
                        enum: ['ascvd', 'chads', 'meld', 'all'],
                        description: 'The specific risk score to calculate (default: all)'
                    }
                }
            }
        }
    },
    // ── Phase 4: Document Analysis & Evidence ────────────────────────────
    {
        type: 'function',
        function: {
            name: 'analyze_document',
            description: 'Analyze an uploaded clinical document image (lab report, referral letter, prior records). Structures the key findings into a card. Only call this when the user has uploaded a document/image attachment.',
            parameters: {
                type: 'object',
                properties: {
                    document_type: {
                        type: 'string',
                        enum: ['lab_report', 'referral', 'imaging', 'prescription', 'insurance', 'other'],
                        description: 'The type of clinical document being analyzed'
                    },
                    summary: {
                        type: 'string',
                        description: 'A brief 1-2 sentence summary of the document contents'
                    },
                    key_findings: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string', description: 'Name of the finding (e.g., "A1c", "Diagnosis")' },
                                value: { type: 'string', description: 'The extracted value or text' },
                                flag: { type: 'string', enum: ['normal', 'abnormal', 'critical', 'info'], description: 'Clinical significance' }
                            },
                            required: ['label', 'value', 'flag']
                        },
                        description: 'Key data points extracted from the document'
                    },
                    source_date: {
                        type: 'string',
                        description: 'Date from the document if identifiable (YYYY-MM-DD)'
                    },
                    recommendations: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Clinical recommendations based on the document findings'
                    }
                },
                required: ['document_type', 'summary', 'key_findings']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_guidelines',
            description: 'Search evidence-based clinical guidelines (ADA, AHA/ACC, USPSTF, KDIGO). Use when the provider asks about best practices, screening recommendations, treatment targets, or evidence-based approaches.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The clinical topic or question to search guidelines for'
                    },
                    category: {
                        type: 'string',
                        enum: ['preventive', 'chronic', 'all'],
                        description: 'Filter by guideline category (default: all)'
                    }
                },
                required: ['query']
            }
        }
    },
    // ── Phase 5: Operational Action Tools ─────────────────────────────────
    {
        type: 'function',
        function: {
            name: 'send_message',
            description: 'Send a message to the patient (via portal) or to another provider (internal). Stages the message for provider approval before sending.',
            parameters: {
                type: 'object',
                properties: {
                    message_body: {
                        type: 'string',
                        description: 'The body/content of the message'
                    },
                    subject: {
                        type: 'string',
                        description: 'Subject line for the message'
                    },
                    message_type: {
                        type: 'string',
                        enum: ['portal', 'internal'],
                        description: 'portal = message to patient, internal = message to another provider (default: portal)'
                    }
                },
                required: ['message_body']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'schedule_appointment',
            description: 'Schedule an appointment for the current patient. Stages the appointment for provider approval before booking.',
            parameters: {
                type: 'object',
                properties: {
                    appointment_date: {
                        type: 'string',
                        description: 'Date for the appointment (YYYY-MM-DD format, or natural language like "tomorrow", "next Monday")'
                    },
                    appointment_time: {
                        type: 'string',
                        description: 'Time for the appointment (e.g., "1:00 PM", "13:00")'
                    },
                    appointment_type: {
                        type: 'string',
                        description: 'Type of visit (e.g., "Follow Up", "New Patient", "Telehealth", "Physical")'
                    },
                    duration: {
                        type: 'integer',
                        description: 'Duration in minutes (default: 30)'
                    },
                    reason: {
                        type: 'string',
                        description: 'Reason for the appointment / chief complaint'
                    }
                },
                required: ['appointment_date', 'appointment_time']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_reminder',
            description: 'Create a clinical reminder or task for the provider. Use when the provider says "remind me to...", "follow up on...", "don\'t forget to...". Stages for approval.',
            parameters: {
                type: 'object',
                properties: {
                    reminder_text: {
                        type: 'string',
                        description: 'The reminder/task description (e.g., "Ask about diabetes management", "Follow up on lab results")'
                    },
                    due_date: {
                        type: 'string',
                        description: 'When this reminder is due (YYYY-MM-DD, or "next encounter", "next week")'
                    },
                    priority: {
                        type: 'string',
                        enum: ['low', 'normal', 'high', 'urgent'],
                        description: 'Priority level (default: normal)'
                    }
                },
                required: ['reminder_text']
            }
        }
    },

    // ── Phase 5B: Agentic Workflow Tools ──────────────────────────────────
    {
        type: 'function',
        function: {
            name: 'generate_referral_letter',
            description: 'Generate a specialist referral letter with full clinical context. Includes patient demographics, relevant history, medications, labs, and reason for referral.',
            parameters: {
                type: 'object',
                properties: {
                    specialty: {
                        type: 'string',
                        description: 'Specialty to refer to (e.g., "Cardiology", "Orthopedics", "Endocrinology")'
                    },
                    reason: {
                        type: 'string',
                        description: 'Clinical reason for the referral'
                    },
                    urgency: {
                        type: 'string',
                        enum: ['routine', 'urgent', 'emergent'],
                        description: 'Urgency level (default: routine)'
                    },
                    specific_questions: {
                        type: 'string',
                        description: 'Specific questions for the specialist'
                    }
                },
                required: ['specialty', 'reason']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'suggest_billing_codes',
            description: 'Suggest E&M level and CPT codes based on the current visit note complexity, time spent, and medical decision-making. Provides coding justification.',
            parameters: {
                type: 'object',
                properties: {
                    visit_type: {
                        type: 'string',
                        enum: ['new_patient', 'established', 'telehealth', 'preventive', 'consultation'],
                        description: 'Type of visit for code selection'
                    },
                    time_spent: {
                        type: 'integer',
                        description: 'Total time spent in minutes (for time-based billing)'
                    },
                    mdm_complexity: {
                        type: 'string',
                        enum: ['straightforward', 'low', 'moderate', 'high'],
                        description: 'Medical decision-making complexity'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_clinical_letter',
            description: 'Generate a clinical letter such as a work excuse, disability form, school physical clearance, FMLA certification, or return-to-work note.',
            parameters: {
                type: 'object',
                properties: {
                    letter_type: {
                        type: 'string',
                        enum: ['work_excuse', 'return_to_work', 'disability', 'fmla', 'school_physical', 'sports_clearance', 'jury_duty', 'custom'],
                        description: 'Type of clinical letter'
                    },
                    details: {
                        type: 'string',
                        description: 'Additional details (e.g., dates, restrictions, accommodations needed)'
                    },
                    recipient: {
                        type: 'string',
                        description: 'Who the letter is addressed to (e.g., employer name, school)'
                    }
                },
                required: ['letter_type']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'prep_visit',
            description: 'Generate a pre-visit intelligence brief for the current patient. Includes outstanding labs, care gaps, medication refills due, last visit context, and action items. Use when provider says "prep me" or "what do I need to know about this patient".',
            parameters: {
                type: 'object',
                properties: {
                    focus: {
                        type: 'string',
                        enum: ['comprehensive', 'chronic_care', 'preventive', 'medication_review'],
                        description: 'Focus area for the prep (default: comprehensive)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'suggest_followup_plan',
            description: 'Suggest an evidence-based follow-up plan including interval, labs to order, and screenings due based on the patient\'s active conditions.',
            parameters: {
                type: 'object',
                properties: {
                    conditions: {
                        type: 'string',
                        description: 'Specific conditions to focus on (leave empty for all active problems)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_avs',
            description: 'Generate a patient-friendly After Visit Summary (AVS). Includes diagnosis in plain language, medication changes, follow-up instructions, and when to seek emergency care.',
            parameters: {
                type: 'object',
                properties: {
                    chief_complaint: {
                        type: 'string',
                        description: 'The chief complaint or reason for today\'s visit'
                    },
                    instructions: {
                        type: 'string',
                        description: 'Any additional instructions to include'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'handoff_summary',
            description: 'Generate an end-of-day clinical handoff summary for the covering provider. Includes active patients, pending results, critical follow-ups, and outstanding tasks.',
            parameters: {
                type: 'object',
                properties: {
                    date: {
                        type: 'string',
                        description: 'Date to generate handoff for (default: today)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'reconcile_medications',
            description: 'Perform medication reconciliation for the current patient. Identifies duplicates, therapeutic overlaps, missing doses, high-risk combinations, and medications that may no longer be needed.',
            parameters: {
                type: 'object',
                properties: {
                    include_otc: {
                        type: 'boolean',
                        description: 'Whether to consider OTC medications (default: true)'
                    }
                }
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
                            note_draft, note_signed_at
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

            case 'get_lab_history': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                let query = 'SELECT test_name, result_value as value, result_units as unit, created_at as date FROM orders WHERE patient_id = $1 AND result_value IS NOT NULL';
                const params = [patientId];
                if (args.test_name) {
                    query += ' AND test_name ILIKE $2';
                    params.push(`%${args.test_name}%`);
                }
                query += ' ORDER BY created_at DESC LIMIT $3';
                params.push(Math.min(args.limit || 50, 200));

                const labs = await pool.query(query, params);
                return { result: labs.rows, dataAccessed: ['orders'] };
            }

            case 'get_risk_scores': {
                if (!patientContext) return { result: 'No patient selected.', dataAccessed: [] };
                const scoreResult = await echoScoreEngine.generatePredictiveInsights(patientContext, args.score_type || 'all');

                return {
                    result: {
                        type: 'risk_assessment',
                        scores: scoreResult.scores,
                        assumptions: scoreResult.assumptions,
                        summary: scoreResult.summary
                    },
                    dataAccessed: ['patients', 'visits.vitals', 'orders', 'problems'],
                    type: 'risk_assessment'
                };
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
                const actionId = `act_${Math.random().toString(36).substring(2, 9)}`;
                return {
                    result: {
                        action_id: actionId,
                        type: 'add_problem',
                        label: `Add Problem: ${args.problem_name}`,
                        message: `Staged adding **${args.problem_name}** to the problem list.`,
                        payload: {
                            patient_id: patientId,
                            problem_name: args.problem_name,
                            icd10_code: args.icd10_code || null,
                            status: args.status || 'active'
                        }
                    },
                    dataAccessed: [],
                    type: 'staged_action'
                };
            }

            case 'add_medication': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };

                // DDI Check
                const interaction = echoCDSEngine.checkMedicationInteractions(args.medication_name, patientContext?.medications || []);

                const actionId = `act_${Math.random().toString(36).substring(2, 9)}`;
                return {
                    result: {
                        action_id: actionId,
                        type: 'add_medication',
                        label: `Add Medication: ${args.medication_name}`,
                        message: `Staged adding **${args.medication_name}** to the medication list.`,
                        interactionWarning: interaction,
                        payload: {
                            patient_id: patientId,
                            medication_name: args.medication_name,
                            dosage: args.dosage || null,
                            frequency: args.frequency || null,
                            route: args.route || 'oral',
                            active: true,
                            status: 'active'
                        }
                    },
                    dataAccessed: ['medications'],
                    type: 'staged_action'
                };
            }

            case 'create_order': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                const actionId = `act_${Math.random().toString(36).substring(2, 9)}`;
                return {
                    result: {
                        action_id: actionId,
                        type: 'create_order',
                        label: `Create ${args.order_type}: ${args.order_name}`,
                        message: `Staged creating **${args.order_type}** order: **${args.order_name}**.`,
                        payload: {
                            patient_id: patientId,
                            order_type: args.order_type,
                            test_name: args.order_name,
                            order_payload: {
                                test_name: args.order_name,
                                priority: args.priority || 'routine',
                                indication: args.indication || null,
                                source: 'echo_ai'
                            }
                        }
                    },
                    dataAccessed: [],
                    type: 'staged_action'
                };
            }

            // ── Phase 2B: Lab Intelligence ───────────────────────────────
            case 'interpret_lab_results': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                const limit = Math.min(args.limit || 10, 30);
                const labOrders = await pool.query(
                    `SELECT * FROM orders WHERE patient_id = $1 AND order_type = 'lab'
                     AND (status = 'completed' OR result_value IS NOT NULL)
                     ORDER BY created_at DESC LIMIT $2`,
                    [patientId, limit]
                );
                const analysis = echoLabEngine.analyzePatientLabs(labOrders.rows);
                return {
                    result: analysis,
                    dataAccessed: ['orders', 'lab_results'],
                    type: 'lab_analysis'
                };
            }

            case 'get_lab_trends': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                const testKey = echoLabEngine.resolveTestKey(args.test_name);
                if (!testKey) {
                    return {
                        result: `No reference data found for "${args.test_name}". Try common names like: HbA1c, TSH, LDL, creatinine, potassium, hemoglobin, etc.`,
                        dataAccessed: []
                    };
                }
                const allLabs = await pool.query(
                    `SELECT * FROM orders WHERE patient_id = $1 AND order_type = 'lab'
                     AND (status = 'completed' OR result_value IS NOT NULL)
                     ORDER BY created_at ASC`,
                    [patientId]
                );
                const fullAnalysis = echoLabEngine.analyzePatientLabs(allLabs.rows);
                const guideline = echoLabEngine.LAB_GUIDELINES[testKey];
                const matchedTrend = fullAnalysis.trends.find(
                    t => t.testName === guideline?.name
                );
                const matchedResults = fullAnalysis.results.filter(
                    r => r.testName === guideline?.name
                );
                return {
                    result: {
                        testName: guideline?.name || args.test_name,
                        trend: matchedTrend || { direction: 'insufficient_data', dataPoints: matchedResults.length },
                        results: matchedResults,
                        guideline: {
                            normalRange: `${guideline?.normal?.min}–${guideline?.normal?.max} ${guideline?.unit}`,
                            unit: guideline?.unit
                        }
                    },
                    dataAccessed: ['orders', 'lab_results'],
                    type: 'lab_trend'
                };
            }

            case 'interpret_specific_test': {
                const interp = echoLabEngine.interpretSpecificTest(args.test_name, args.value);
                return {
                    result: interp,
                    dataAccessed: ['lab_reference_ranges'],
                    type: 'lab_interpretation'
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
                    `SELECT a.appointment_time, a.appointment_type as visit_type, a.patient_status,
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
                        COUNT(CASE WHEN type = 'result' THEN 1 END) as results,
                        COUNT(CASE WHEN type = 'message' THEN 1 END) as messages,
                        COUNT(CASE WHEN type = 'task' THEN 1 END) as tasks,
                        COUNT(CASE WHEN type = 'refill' THEN 1 END) as refills
                     FROM inbox_items
                     WHERE status != 'archived'`
                );

                return {
                    result: inbox.rows[0] || { total: 0, unread: 0, results: 0, messages: 0, tasks: 0, refills: 0 },
                    dataAccessed: ['inbox_items']
                };
            }

            // Phase 2C - Clinical Decision Support
            case 'check_clinical_gaps': {
                if (!patientId || !patientContext) return { result: 'No patient selected.', dataAccessed: [] };
                const gaps = await echoCDSEngine.analyzeClinicalGaps(patientContext);
                return {
                    type: 'clinical_gaps',
                    result: gaps,
                    dataAccessed: ['patients', 'problems', 'orders', 'labs', 'social_history']
                };
            }

            // ── Phase 5: Operational Action Tools ────────────────────────
            case 'send_message': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                const actionId = `act_${Math.random().toString(36).substring(2, 9)}`;
                const patientName = patientContext?.demographics
                    ? `${patientContext.demographics.first_name} ${patientContext.demographics.last_name}`
                    : 'patient';
                return {
                    result: {
                        action_id: actionId,
                        type: 'send_message',
                        label: `Send Message to ${patientName}`,
                        message: `Staged sending a **${args.message_type || 'portal'}** message to **${patientName}**.`,
                        payload: {
                            patient_id: patientId,
                            subject: args.subject || 'Message from your care team',
                            body: args.message_body,
                            message_type: args.message_type || 'portal'
                        }
                    },
                    dataAccessed: [],
                    type: 'staged_action'
                };
            }

            case 'schedule_appointment': {
                if (!patientId) return { result: 'No patient selected.', dataAccessed: [] };
                const actionId = `act_${Math.random().toString(36).substring(2, 9)}`;
                const patientName = patientContext?.demographics
                    ? `${patientContext.demographics.first_name} ${patientContext.demographics.last_name}`
                    : 'patient';

                // Parse natural language dates
                let appointmentDate = args.appointment_date;
                const today = new Date();
                if (appointmentDate === 'tomorrow') {
                    const tmrw = new Date(today);
                    tmrw.setDate(tmrw.getDate() + 1);
                    appointmentDate = tmrw.toISOString().split('T')[0];
                } else if (appointmentDate === 'today') {
                    appointmentDate = today.toISOString().split('T')[0];
                }

                let apptType = args.appointment_type || 'Follow-up';
                if (apptType === 'Follow Up') apptType = 'Follow-up';

                // Normalize time for DB (ensure it's not "1:00 PM" but "13:00")
                let appointmentTime = args.appointment_time;
                if (appointmentTime && (appointmentTime.includes('AM') || appointmentTime.includes('PM'))) {
                    try {
                        const [time, modifier] = appointmentTime.split(' ');
                        let [hours, minutes] = time.split(':');
                        if (hours === '12') hours = '00';
                        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
                        appointmentTime = `${hours}:${minutes}:00`;
                    } catch (e) {
                        console.warn('[Echo Service] Failed to normalize time:', appointmentTime);
                    }
                }

                return {
                    result: {
                        action_id: actionId,
                        type: 'schedule_appointment',
                        label: `Schedule ${apptType} for ${patientName}`,
                        message: `Staged scheduling a **${apptType}** appointment for **${patientName}** on **${appointmentDate}** at **${args.appointment_time}**.`,
                        payload: {
                            patient_id: patientId,
                            appointment_date: appointmentDate,
                            appointment_time: appointmentTime,
                            appointment_type: apptType,
                            duration: args.duration || 30,
                            reason: args.reason || null
                        }
                    },
                    dataAccessed: [],
                    type: 'staged_action'
                };
            }

            case 'create_reminder': {
                const actionId = `act_${Math.random().toString(36).substring(2, 9)}`;
                return {
                    result: {
                        action_id: actionId,
                        type: 'create_reminder',
                        label: `Reminder: ${args.reminder_text.substring(0, 50)}${args.reminder_text.length > 50 ? '...' : ''}`,
                        message: `Staged creating a reminder: **${args.reminder_text}**${args.due_date ? ` (due: ${args.due_date})` : ''}.`,
                        payload: {
                            patient_id: patientId || null,
                            reminder_text: args.reminder_text,
                            due_date: args.due_date || null,
                            priority: args.priority || 'normal'
                        }
                    },
                    dataAccessed: [],
                    type: 'staged_action'
                };
            }

            // ── Phase 5B: Agentic Workflow Tools ────────────────────────
            case 'generate_referral_letter': {
                if (!patientContext) return { result: 'No patient selected.', dataAccessed: [] };
                const d = patientContext.demographics || {};
                const age = d.dob ? calculateAge(d.dob) : 'unknown age';
                const patientDesc = `${d.first_name || ''} ${d.last_name || ''}, ${age}, ${d.sex || 'sex unknown'}`;
                const problems = (patientContext.problems || []).map(p => cleanProblemName(p.name || p.problem_name || '')).filter(Boolean);
                const meds = (patientContext.medications || []).map(m => {
                    const name = m.medication_name || '';
                    const dose = m.dosage ? ` ${m.dosage}` : '';
                    const freq = m.frequency ? ` ${m.frequency}` : '';
                    return `${name}${dose}${freq}`;
                }).filter(Boolean);
                const allergies = (patientContext.allergies || []).map(a => a.allergen || a.allergy_name || '').filter(Boolean);
                const recentLabs = (patientContext.labs || []).slice(0, 10).map(l => `${l.test_name}: ${l.result_value} ${l.result_units || ''}`.trim()).filter(Boolean);
                const vitals = buildVitalsSummary(patientContext.vitalHistory);

                const letter = [
                    `**REFERRAL TO ${(args.specialty || '').toUpperCase()}**`,
                    `**Urgency:** ${args.urgency || 'Routine'}`,
                    '',
                    `Dear ${args.specialty} Colleague,`,
                    '',
                    `I am referring ${patientDesc} to your care for evaluation and management of: **${args.reason}**.`,
                    '',
                    `**Active Medical History:**`,
                    problems.length > 0 ? problems.map(p => `• ${p}`).join('\n') : '• No active problems documented',
                    '',
                    `**Current Medications:**`,
                    meds.length > 0 ? meds.map(m => `• ${m}`).join('\n') : '• No active medications',
                    '',
                    `**Allergies:** ${allergies.length > 0 ? allergies.join(', ') : 'NKDA'}`,
                    '',
                    vitals ? `**Recent Vitals:** ${vitals}` : '',
                    '',
                    recentLabs.length > 0 ? `**Relevant Labs:**\n${recentLabs.map(l => `• ${l}`).join('\n')}` : '',
                    '',
                    args.specific_questions ? `**Specific Questions:**\n${args.specific_questions}` : '',
                    '',
                    `Thank you for your evaluation. Please send findings and recommendations back to our office.`,
                    '',
                    `Sincerely,`,
                    `[Provider Signature]`
                ].filter(l => l !== undefined).join('\n');

                return {
                    result: { type: 'clinical_document', document_type: 'referral_letter', content: letter, specialty: args.specialty },
                    dataAccessed: ['patients', 'problems', 'medications', 'allergies', 'orders', 'visits.vitals'],
                    type: 'clinical_document'
                };
            }

            case 'suggest_billing_codes': {
                const problems = patientContext?.problems || [];
                const meds = patientContext?.medications || [];
                const labs = patientContext?.labs || [];
                // Helper: search problems list with strict word boundary matching to avoid partial matches (e.g., 'mi' in 'migraine')
                const hasProblem = (keywords) => {
                    const found = problems.some(p => {
                        const name = (p.problem_name || p.name || '').toLowerCase();

                        // Skip if it looks like a family history or negative mention
                        if (name.includes('denies') || name.includes('negative for') || name.includes('no history of') || name.includes('no ') || name.includes('hx of')) {
                            if (name.includes('family')) return false;
                        }

                        return keywords.some(kw => {
                            const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, 'i');
                            const isMatch = regex.test(name);
                            if (isMatch) {
                                console.log(`[Echo Score Engine] MATCH: "${kw}" found in "${name}"`);
                            }
                            return isMatch;
                        });
                    });
                    return found;
                };

                const d = patientContext.demographics || {};
                const age = d.dob ? calculateAge(d.dob) : 'unknown age';
                const sex = d.sex || 'unknown sex';

                console.log(`[Echo Score Engine] Calculating for ${age}y ${sex} with ${problems.length} problems.`);
                if (problems.length > 0) {
                    console.log(`[Echo Score Engine] Problem set:`, problems.map(p => p.problem_name || p.name).join(', '));
                }
                const numProblems = problems.length;
                const numMeds = meds.length;
                const hasChronicConditions = problems.some(p => {
                    const n = (p.problem_name || p.name || '').toLowerCase();
                    return n.includes('diabetes') || n.includes('hypertension') || n.includes('heart failure') ||
                        n.includes('copd') || n.includes('ckd') || n.includes('asthma');
                });

                let suggestedLevel, cptCode, justification;
                const vt = args.visit_type || 'established';

                if (args.time_spent && args.time_spent >= 40) {
                    // Time-based billing
                    if (vt === 'new_patient') {
                        if (args.time_spent >= 74) { cptCode = '99205'; suggestedLevel = 'Level 5'; }
                        else if (args.time_spent >= 59) { cptCode = '99204'; suggestedLevel = 'Level 4'; }
                        else if (args.time_spent >= 44) { cptCode = '99203'; suggestedLevel = 'Level 3'; }
                        else { cptCode = '99202'; suggestedLevel = 'Level 2'; }
                    } else {
                        if (args.time_spent >= 55) { cptCode = '99215'; suggestedLevel = 'Level 5'; }
                        else if (args.time_spent >= 40) { cptCode = '99214'; suggestedLevel = 'Level 4'; }
                        else if (args.time_spent >= 30) { cptCode = '99213'; suggestedLevel = 'Level 3'; }
                        else { cptCode = '99212'; suggestedLevel = 'Level 2'; }
                    }
                    justification = `Time-based billing: ${args.time_spent} minutes total time on date of encounter.`;
                } else {
                    // MDM-based
                    const mdm = args.mdm_complexity || (numProblems >= 4 || hasChronicConditions ? 'moderate' : numProblems >= 2 ? 'low' : 'straightforward');
                    if (vt === 'new_patient') {
                        const mdmMap = { straightforward: ['99202', 'Level 2'], low: ['99203', 'Level 3'], moderate: ['99204', 'Level 4'], high: ['99205', 'Level 5'] };
                        [cptCode, suggestedLevel] = mdmMap[mdm] || ['99203', 'Level 3'];
                    } else {
                        const mdmMap = { straightforward: ['99212', 'Level 2'], low: ['99213', 'Level 3'], moderate: ['99214', 'Level 4'], high: ['99215', 'Level 5'] };
                        [cptCode, suggestedLevel] = mdmMap[mdm] || ['99213', 'Level 3'];
                    }
                    justification = `MDM-based: ${mdm} complexity. ${numProblems} active problem(s), ${numMeds} medication(s)${hasChronicConditions ? ', chronic condition management' : ''}.`;
                }

                const additionalCodes = [];
                if (vt === 'preventive') additionalCodes.push({ code: '99395', description: 'Preventive visit, 18-39y' }, { code: '99396', description: 'Preventive visit, 40-64y' });
                if (vt === 'telehealth') additionalCodes.push({ code: '95', modifier: 'Synchronous telehealth modifier' });

                return {
                    result: {
                        type: 'billing_suggestion',
                        primary: { cptCode, level: suggestedLevel, justification },
                        visitType: vt,
                        additionalCodes,
                        disclaimer: 'Coding suggestions are advisory only. Final code selection is the responsibility of the billing provider.',
                        mdmFactors: { problems: numProblems, medications: numMeds, labsOrdered: labs.length, chronicConditions: hasChronicConditions }
                    },
                    dataAccessed: ['problems', 'medications', 'orders'],
                    type: 'billing_suggestion'
                };
            }

            case 'generate_clinical_letter': {
                if (!patientContext) return { result: 'No patient selected.', dataAccessed: [] };
                const d = patientContext.demographics || {};
                const patientName = `${d.first_name || ''} ${d.last_name || ''}`;
                const dob = d.dob ? new Date(d.dob).toLocaleDateString('en-US') : 'N/A';
                const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

                const templates = {
                    work_excuse: `To Whom It May Concern:\n\nThis letter confirms that ${patientName} (DOB: ${dob}) was seen in our office on ${today} and is excused from work${args.details ? `. ${args.details}` : ' for medical reasons'}.\n\nPlease contact our office with any questions.\n\nSincerely,\n[Provider Signature]`,

                    return_to_work: `To Whom It May Concern:\n\nThis letter certifies that ${patientName} (DOB: ${dob}) was evaluated on ${today} and is medically cleared to return to work${args.details ? ` with the following considerations: ${args.details}` : ' without restrictions'}.\n\nSincerely,\n[Provider Signature]`,

                    disability: `To Whom It May Concern:\n\nI am the treating physician for ${patientName} (DOB: ${dob}). This patient has been under my care and is being evaluated for disability. ${args.details || 'Please see attached medical records for clinical details.'}\n\nDiagnoses:\n${(patientContext.problems || []).map(p => `• ${cleanProblemName(p.name || p.problem_name || '')}`).join('\n') || '• See chart'}\n\nCurrent Medications:\n${(patientContext.medications || []).map(m => `• ${m.medication_name || ''}`).join('\n') || '• See chart'}\n\nSincerely,\n[Provider Signature]`,

                    fmla: `FMLA CERTIFICATION\n\nPatient: ${patientName} (DOB: ${dob})\nDate: ${today}\n\nI certify that the above-named patient has a serious health condition that${args.details ? `: ${args.details}` : ' requires ongoing treatment and/or renders the patient unable to perform job functions'}.\n\nEstimated duration: [Provider to complete]\nSchedule of treatments: [Provider to complete]\n\nProvider Signature: _______________`,

                    school_physical: `SCHOOL PHYSICAL EXAMINATION\n\nStudent: ${patientName} (DOB: ${dob})\nDate of Exam: ${today}\n\nThis student has been examined and is found to be in satisfactory health for school attendance${args.details ? `. Notes: ${args.details}` : ''}.\n\nVitals: ${buildVitalsSummary(patientContext.vitalHistory) || 'See chart'}\nAllergies: ${(patientContext.allergies || []).map(a => a.allergen || a.allergy_name).filter(Boolean).join(', ') || 'NKDA'}\n\nProvider Signature: _______________`,

                    sports_clearance: `SPORTS PHYSICAL CLEARANCE\n\nAthlete: ${patientName} (DOB: ${dob})\nDate: ${today}\n\nThis patient has been examined and is${args.details ? `: ${args.details}` : ' medically cleared for sports participation without restrictions'}.\n\nProvider Signature: _______________`,

                    jury_duty: `To the Court:\n\nThis letter confirms that ${patientName} (DOB: ${dob}) is a patient of this practice. ${args.details || 'Due to their medical condition, participation in jury duty would pose a hardship at this time.'}\n\nSincerely,\n[Provider Signature]`,

                    custom: `Date: ${today}\n${args.recipient ? `To: ${args.recipient}\n` : ''}\nRe: ${patientName} (DOB: ${dob})\n\n${args.details || '[Provider to complete letter content]'}\n\nSincerely,\n[Provider Signature]`
                };

                const content = templates[args.letter_type] || templates.custom;

                return {
                    result: { type: 'clinical_document', document_type: args.letter_type, content },
                    dataAccessed: ['patients', 'problems', 'medications', 'allergies', 'visits.vitals'],
                    type: 'clinical_document'
                };
            }

            case 'prep_visit': {
                if (!patientContext) return { result: 'No patient selected.', dataAccessed: [] };
                const d = patientContext.demographics || {};
                const age = d.dob ? calculateAge(d.dob) : 'unknown age';
                const problems = (patientContext.problems || []).map(p => cleanProblemName(p.name || p.problem_name || '')).filter(Boolean);
                const meds = (patientContext.medications || []).map(m => m.medication_name || '').filter(Boolean);
                const allergies = (patientContext.allergies || []).map(a => a.allergen || a.allergy_name || '').filter(Boolean);
                const recentVisits = patientContext.recentVisits || [];
                const vitals = buildVitalsSummary(patientContext.vitalHistory);

                const lastVisit = recentVisits[0];
                const lastVisitDate = lastVisit ? formatClinicalDate(lastVisit.date || lastVisit.visit_date) : 'No prior visits';
                const lastCC = lastVisit ? (lastVisit.chief_complaint || lastVisit.type || 'Office visit') : 'N/A';

                const brief = {
                    type: 'visit_prep',
                    patient: `${d.first_name} ${d.last_name}, ${age}, ${d.sex || ''}`,
                    lastVisit: { date: lastVisitDate, chiefComplaint: lastCC },
                    activeProblems: problems,
                    medications: meds,
                    allergies: allergies.length > 0 ? allergies : ['NKDA'],
                    recentVitals: vitals || 'No recent vitals',
                    actionItems: [],
                    alerts: []
                };

                // Flag overdue items
                if (!lastVisit) brief.alerts.push('⚠️ No prior visits on file — new patient');
                if (meds.length > 10) brief.alerts.push(`⚠️ Polypharmacy: ${meds.length} active medications`);
                if (problems.some(p => p.toLowerCase().includes('diabetes'))) brief.actionItems.push('Check A1c (last result and date)');
                if (problems.some(p => p.toLowerCase().includes('hypertension'))) brief.actionItems.push('Review BP trend and medication adherence');
                if (problems.some(p => p.toLowerCase().includes('depression') || p.toLowerCase().includes('anxiety'))) brief.actionItems.push('Screen with PHQ-9/GAD-7');

                return {
                    result: brief,
                    dataAccessed: ['patients', 'problems', 'medications', 'allergies', 'visits', 'visits.vitals'],
                    type: 'visit_prep'
                };
            }

            case 'suggest_followup_plan': {
                if (!patientContext) return { result: 'No patient selected.', dataAccessed: [] };
                const problems = (patientContext.problems || []).map(p => (p.name || p.problem_name || '').toLowerCase()).filter(Boolean);
                const suggestions = [];

                const conditionPlans = {
                    'diabetes': { interval: '3 months', labs: ['HbA1c', 'BMP', 'Lipid Panel', 'Urine Albumin/Creatinine'], screenings: ['Diabetic eye exam (annual)', 'Foot exam', 'Monofilament testing'] },
                    'hypertension': { interval: '3-6 months', labs: ['BMP (potassium, creatinine)', 'Lipid Panel'], screenings: ['Home BP log review', 'ASCVD risk reassessment'] },
                    'heart failure': { interval: '1-3 months', labs: ['BMP', 'BNP/NT-proBNP', 'CBC'], screenings: ['Daily weight monitoring', 'Fluid restriction compliance'] },
                    'copd': { interval: '3-6 months', labs: ['CBC', 'ABG if indicated'], screenings: ['Pulmonary function tests (annual)', 'Flu/pneumonia vaccines'] },
                    'ckd': { interval: '3-6 months', labs: ['BMP', 'CBC', 'Phosphorus', 'PTH', 'Urine Albumin/Creatinine'], screenings: ['Nephrology referral if Stage 4+', 'Renal diet counseling'] },
                    'hypothyroid': { interval: '6-12 months', labs: ['TSH', 'Free T4'], screenings: ['Dose adjustment review'] },
                    'depression': { interval: '4-8 weeks (acute), 3-6 months (stable)', labs: ['PHQ-9 scoring'], screenings: ['Suicide risk assessment', 'Medication side effects'] },
                    'anxiety': { interval: '4-8 weeks', labs: ['GAD-7 scoring', 'TSH (rule out thyroid)'], screenings: ['Sleep assessment', 'Substance use screening'] },
                    'asthma': { interval: '3-6 months', labs: ['Spirometry (annual)'], screenings: ['Asthma control test (ACT)', 'Inhaler technique review'] },
                    'hyperlipidemia': { interval: '6-12 months', labs: ['Lipid Panel', 'Liver function (if on statin)'], screenings: ['ASCVD risk calculation', 'Statin benefit discussion'] },
                    'obesity': { interval: '3 months', labs: ['HbA1c', 'Lipid Panel', 'Liver function'], screenings: ['BMI trend', 'Nutrition counseling', 'Exercise prescription'] }
                };

                for (const [condition, plan] of Object.entries(conditionPlans)) {
                    if (problems.some(p => p.includes(condition))) {
                        suggestions.push({ condition: condition.charAt(0).toUpperCase() + condition.slice(1), ...plan });
                    }
                }

                if (suggestions.length === 0) {
                    suggestions.push({ condition: 'General', interval: '12 months', labs: ['CBC', 'BMP', 'Lipid Panel'], screenings: ['Age-appropriate cancer screenings', 'Immunizations'] });
                }

                return {
                    result: { type: 'followup_plan', plans: suggestions },
                    dataAccessed: ['problems', 'medications'],
                    type: 'followup_plan'
                };
            }

            case 'generate_avs': {
                if (!patientContext) return { result: 'No patient selected.', dataAccessed: [] };
                const d = patientContext.demographics || {};
                const problems = (patientContext.problems || []).map(p => cleanProblemName(p.name || p.problem_name || '')).filter(Boolean);
                const meds = (patientContext.medications || []).map(m => {
                    const name = m.medication_name || '';
                    const dose = m.dosage ? ` ${m.dosage}` : '';
                    const freq = m.frequency ? ` ${m.frequency}` : '';
                    return `${name}${dose}${freq}`;
                }).filter(Boolean);

                const avs = [
                    `**AFTER VISIT SUMMARY**`,
                    `Patient: ${d.first_name} ${d.last_name}`,
                    `Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
                    '',
                    `**Why You Were Seen Today:**`,
                    args.chief_complaint || 'Follow-up visit',
                    '',
                    `**Your Conditions:**`,
                    problems.length > 0 ? problems.map(p => `• ${p}`).join('\n') : '• Discussed during visit',
                    '',
                    `**Your Medications:**`,
                    meds.length > 0 ? meds.map(m => `• ${m}`).join('\n') : '• No changes',
                    '',
                    `**What To Do Next:**`,
                    args.instructions || '• Follow up as directed by your provider\n• Take all medications as prescribed\n• Contact our office if symptoms worsen',
                    '',
                    `**When To Seek Emergency Care:**`,
                    `• Chest pain or difficulty breathing`,
                    `• Sudden severe headache or vision changes`,
                    `• Signs of allergic reaction (swelling, hives, difficulty breathing)`,
                    `• Any symptoms that concern you — trust your instincts`,
                    '',
                    `**Contact Us:** Call our office at [clinic phone] with any questions.`
                ].join('\n');

                return {
                    result: { type: 'clinical_document', document_type: 'avs', content: avs },
                    dataAccessed: ['patients', 'problems', 'medications'],
                    type: 'clinical_document'
                };
            }

            case 'handoff_summary': {
                const targetDate = args.date || new Date().toISOString().split('T')[0];
                // Get today's seen patients with active issues
                const seenToday = await pool.query(
                    `SELECT v.id, v.visit_date, v.visit_type, v.status,
                            p.first_name, p.last_name,
                            v.note_draft
                     FROM visits v
                     JOIN patients p ON v.patient_id = p.id
                     WHERE v.visit_date::date = $1::date
                     ORDER BY v.visit_date DESC LIMIT 30`,
                    [targetDate]
                );

                // Get pending results
                const pendingResults = await pool.query(
                    `SELECT o.test_name, o.order_type, p.first_name, p.last_name
                     FROM orders o
                     JOIN patients p ON o.patient_id = p.id
                     WHERE o.status = 'pending' AND o.created_at::date = $1::date
                     LIMIT 20`,
                    [targetDate]
                );

                // Get unsigned notes
                const unsignedNotes = await pool.query(
                    `SELECT v.id, p.first_name, p.last_name, v.visit_type
                     FROM visits v
                     JOIN patients p ON v.patient_id = p.id
                     WHERE v.status IN ('in-progress', 'draft', 'open')
                       AND v.note_signed_at IS NULL
                       AND v.visit_date::date = $1::date
                     LIMIT 20`,
                    [targetDate]
                );

                return {
                    result: {
                        type: 'handoff_summary',
                        date: targetDate,
                        patientsSeen: seenToday.rows.length,
                        patients: seenToday.rows.map(v => ({
                            name: `${v.first_name} ${v.last_name}`,
                            visitType: v.visit_type || 'Not documented',
                            status: v.status
                        })),
                        pendingResults: pendingResults.rows.map(o => ({
                            patient: `${o.first_name} ${o.last_name}`,
                            test: o.test_name,
                            type: o.order_type
                        })),
                        unsignedNotes: unsignedNotes.rows.map(v => ({
                            patient: `${v.first_name} ${v.last_name}`,
                            visitType: v.visit_type
                        }))
                    },
                    dataAccessed: ['visits', 'patients', 'orders'],
                    type: 'handoff_summary'
                };
            }

            case 'reconcile_medications': {
                if (!patientContext) return { result: 'No patient selected.', dataAccessed: [] };
                const meds = (patientContext.medications || []).filter(m => m.active !== false);
                const problems = (patientContext.problems || []).map(p => (p.name || p.problem_name || '').toLowerCase());

                const findings = {
                    type: 'med_reconciliation',
                    totalMedications: meds.length,
                    duplicates: [],
                    highRisk: [],
                    noIndication: [],
                    suggestions: []
                };

                // Check for duplicates (same drug class)
                const drugClasses = {};
                const classMap = {
                    'ace inhibitor': ['lisinopril', 'enalapril', 'ramipril', 'benazepril', 'captopril', 'fosinopril', 'quinapril'],
                    'arb': ['losartan', 'valsartan', 'irbesartan', 'olmesartan', 'telmisartan', 'candesartan'],
                    'statin': ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin', 'pitavastatin'],
                    'ssri': ['sertraline', 'fluoxetine', 'escitalopram', 'citalopram', 'paroxetine', 'fluvoxamine'],
                    'ppi': ['omeprazole', 'pantoprazole', 'esomeprazole', 'lansoprazole', 'rabeprazole', 'dexlansoprazole'],
                    'beta blocker': ['metoprolol', 'atenolol', 'propranolol', 'carvedilol', 'bisoprolol', 'nebivolol'],
                    'ccb': ['amlodipine', 'nifedipine', 'diltiazem', 'verapamil', 'felodipine'],
                    'diuretic': ['hydrochlorothiazide', 'furosemide', 'chlorthalidone', 'spironolactone', 'bumetanide'],
                    'anticoagulant': ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'eliquis', 'xarelto'],
                    'antiplatelet': ['aspirin', 'clopidogrel', 'plavix', 'ticagrelor', 'prasugrel'],
                    'nsaid': ['ibuprofen', 'naproxen', 'meloxicam', 'diclofenac', 'celecoxib', 'indomethacin'],
                    'benzodiazepine': ['alprazolam', 'lorazepam', 'clonazepam', 'diazepam', 'temazepam']
                };

                for (const med of meds) {
                    const medName = (med.medication_name || '').toLowerCase();
                    for (const [drugClass, drugs] of Object.entries(classMap)) {
                        if (drugs.some(d => medName.includes(d))) {
                            if (!drugClasses[drugClass]) drugClasses[drugClass] = [];
                            drugClasses[drugClass].push(med.medication_name);
                        }
                    }
                }

                // Flag duplicates
                for (const [cls, drugs] of Object.entries(drugClasses)) {
                    if (drugs.length > 1) {
                        findings.duplicates.push({ class: cls, medications: drugs, warning: `Multiple ${cls}s detected: ${drugs.join(', ')}` });
                    }
                }

                // High-risk combos
                if (drugClasses['anticoagulant'] && drugClasses['antiplatelet']) {
                    findings.highRisk.push({ combo: 'Anticoagulant + Antiplatelet', risk: 'Increased bleeding risk', medications: [...(drugClasses['anticoagulant'] || []), ...(drugClasses['antiplatelet'] || [])] });
                }
                if (drugClasses['anticoagulant'] && drugClasses['nsaid']) {
                    findings.highRisk.push({ combo: 'Anticoagulant + NSAID', risk: 'Significantly increased GI bleeding risk', medications: [...(drugClasses['anticoagulant'] || []), ...(drugClasses['nsaid'] || [])] });
                }
                if (drugClasses['ace inhibitor'] && drugClasses['arb']) {
                    findings.highRisk.push({ combo: 'ACE Inhibitor + ARB', risk: 'Dual RAAS blockade — hyperkalemia and renal risk', medications: [...(drugClasses['ace inhibitor'] || []), ...(drugClasses['arb'] || [])] });
                }
                if (drugClasses['ssri'] && drugClasses['nsaid']) {
                    findings.highRisk.push({ combo: 'SSRI + NSAID', risk: 'Increased GI bleeding risk', medications: [...(drugClasses['ssri'] || []), ...(drugClasses['nsaid'] || [])] });
                }

                // Polypharmacy check
                if (meds.length > 10) {
                    findings.suggestions.push(`⚠️ Polypharmacy: ${meds.length} active medications. Consider deprescribing review.`);
                }
                if (drugClasses['benzodiazepine'] && problems.some(p => p.includes('fall') || p.includes('elderly'))) {
                    findings.suggestions.push('⚠️ Benzodiazepine in elderly patient — fall risk. Consider taper.');
                }
                if (drugClasses['ppi']) {
                    findings.suggestions.push('📋 PPI on chronic use — consider step-down or reassess indication (fracture/C.diff/B12 deficiency risk).');
                }

                return {
                    result: findings,
                    dataAccessed: ['medications', 'problems'],
                    type: 'med_reconciliation'
                };
            }

            // Phase 4 - Document Analysis (structured output from Vision)
            case 'analyze_document': {
                return {
                    type: 'document_analysis',
                    result: {
                        type: 'document_analysis',
                        document_type: args.document_type,
                        summary: args.summary,
                        key_findings: args.key_findings || [],
                        source_date: args.source_date || null,
                        recommendations: args.recommendations || []
                    },
                    dataAccessed: ['uploaded_document']
                };
            }

            // Phase 4 - Clinical Guideline Search
            case 'search_guidelines': {
                const guidelineResults = echoGuidelineEngine.searchGuidelines(
                    args.query,
                    args.category || 'all',
                    5
                );
                return {
                    type: 'guideline_evidence',
                    result: guidelineResults,
                    dataAccessed: ['clinical_guidelines']
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
    const { section, chief_complaint, visit_type, additional_context, custom_narrative } = args;

    const d = context.demographics;
    const patientDesc = d
        ? `${d.first_name} ${d.last_name}, ${d.dob ? calculateAge(d.dob) : 'unknown age'}, ${d.sex || 'sex unknown'}`
        : 'this patient';

    const activeMeds = (context.medications || [])
        .map(m => (m.medication_name || '').trim())
        .filter(Boolean)
        .filter((v, i, a) => a.findIndex(item => item.toLowerCase() === v.toLowerCase()) === i)
        .join(', ');

    const activeProblems = (context.problems || [])
        .map(p => cleanProblemName(p.name || p.problem_name || '').trim())
        .filter(Boolean)
        .filter((v, i, a) => a.findIndex(item => item.toLowerCase() === v.toLowerCase()) === i)
        .join(', ');

    const latestVitals = buildVitalsSummary(context.vitalHistory);
    const cc = (chief_complaint || 'follow-up').toLowerCase();
    const vt = (visit_type || 'follow-up').toLowerCase();

    const result = {
        type: 'note_draft',
        section,
        chief_complaint: cc,
        visit_type: vt,
        drafts: {}
    };

    if (custom_narrative) {
        result.drafts[section === 'full_note' ? 'hpi' : section] = custom_narrative;
        if (section !== 'full_note') return result;
    }

    if (section === 'hpi' || section === 'full_note') {
        result.drafts.hpi = custom_narrative || buildHPIDraft(patientDesc, cc, vt, activeProblems, activeMeds, latestVitals, context.recentVisits, additional_context);
    }
    if (section === 'assessment' || section === 'full_note') {
        result.drafts.assessment = buildAssessmentDraft(patientDesc, cc, activeProblems, latestVitals, context.recentVisits);
    }
    if (section === 'plan' || section === 'full_note') {
        result.drafts.plan = buildPlanDraft(cc, activeProblems, activeMeds, context.activeOrders);
    }

    return result;
}

function formatClinicalDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function cleanProblemName(name) {
    if (!name) return '';
    // Remove common ICD10 prefixes like "I10 - " or "[I10] "
    return name.replace(/^[A-Z]\d{1,2}(\.\d+)?\s*[-–—]\s*/, '').replace(/^\[[A-Z]\d{1,2}(\.\d+)?\]\s*/, '').trim();
}

function buildHPIDraft(patientDesc, cc, visitType, problems, meds, vitals, recentVisits, extra) {
    const parts = [];

    // Professional Opening
    parts.push(`The patient is a ${patientDesc} presenting for a ${visitType} visit with a chief complaint of ${cc}.`);

    // Medical History Synthesis
    if (problems) {
        parts.push(`Active medical history is notable for ${problems}.`);
    }

    // Medication Synthesis
    if (meds) {
        parts.push(`Current medications include ${meds}.`);
    }

    // Recent Clinical Context
    if (recentVisits?.length > 0) {
        const last = recentVisits[0];
        const lastDate = formatClinicalDate(last.date || last.visit_date);
        const lastCC = (last.chief_complaint || last.type || 'office visit').toLowerCase();
        parts.push(`At the most recent encounter on ${lastDate}, the patient was seen for ${lastCC}.`);
    }

    // Vitals Integration
    if (vitals) {
        parts.push(`Physical findings today are notable for stable vitals (${vitals}).`);
    }

    // Additional Narrative
    if (extra) {
        parts.push(`\nIn addition: ${extra}.`);
    }

    parts.push('\n[Provider: Please review the above and expand with specific subjective details from the patient interview.]');

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

/**
 * Detect user intent based on keywords and message patterns
 */
function detectIntent(message) {
    const m = message.toLowerCase();
    if (m.includes('draft') || m.includes('hpi') || m.includes('note') || m.includes('soap') || m.includes('avs') || m.includes('after visit')) return 'scribe';
    if (m.includes('lab') || m.includes('trend') || m.includes('vital') || m.includes('chronic') || m.includes('analyz') || m.includes('reconcil')) return 'analyst';
    if (m.includes('score') || m.includes('chads') || m.includes('ascvd') || m.includes('meld') || m.includes('risk') || m.includes('calculate')) return 'analyst';
    if (m.includes('referral') || m.includes('refer') || m.includes('letter') || m.includes('excuse') || m.includes('disability') || m.includes('fmla') || m.includes('clearance')) return 'scribe';
    if (m.includes('bill') || m.includes('cpt') || m.includes('e&m') || m.includes('code') || m.includes('coding')) return 'analyst';
    if (m.includes('prep') || m.includes('brief') || m.includes('what do i need') || m.includes('follow up') || m.includes('follow-up') || m.includes('followup')) return 'analyst';
    if (m.includes('handoff') || m.includes('hand off') || m.includes('hand-off') || m.includes('end of day') || m.includes('sign out')) return 'navigator';
    if (m.includes('add') || m.includes('stage') || m.includes('prescribe') || m.includes('medication') || m.includes('problem')) return 'manager';
    if (m.includes('schedule') || m.includes('where is') || m.includes('navigate') || m.includes('inbox') || m.includes('unsigned')) return 'navigator';
    if (m.includes('message') || m.includes('send') || m.includes('remind') || m.includes('appointment') || m.includes('book')) return 'navigator';
    return 'general';
}

// ─── Main Chat Function ─────────────────────────────────────────────────────

async function chat({ message, patientId, conversationId, user, uiContext, attachments }) {
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

    // 4. Build message history - Increased for deep conversational awareness
    const history = await getMessageHistory(conversation.id, 30);

    // 5. Build messages for the LLM
    const intent = detectIntent(message);
    const messages = [
        { role: 'system', content: getSystemPrompt(intent) }
    ];

    if (uiContext) {
        messages.push({
            role: 'system',
            content: `UI CONTEXT: The provider is currently viewing: ${uiContext}`
        });
    }

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

    // Add conversation history - Optimized for tokens
    for (const msg of history) {
        // Strip large drafts from history sent to LLM to save tokens
        let content = msg.content;
        if (msg.role === 'assistant') {
            content = content.replace(/I've drafted the ([^ ]+) for you below/g, '[DRAFTED $1 SECTION]');
            // Limit assistant re-rehearsal of long reasoning unless specifically needed
            if (content.length > 500) {
                content = content.substring(0, 500) + '... [Long Response Truncated in History]';
            }
        }
        messages.push({ role: msg.role, content });

        if (msg.tool_calls) {
            const toolResults = typeof msg.tool_results === 'string' ? JSON.parse(msg.tool_results) : msg.tool_results;
            if (toolResults && Array.isArray(toolResults)) {
                for (const result of toolResults) {
                    // Truncate massive tool results (like raw large tables) in history
                    let toolOutput = JSON.stringify(result.output);
                    if (toolOutput.length > 1000) {
                        toolOutput = toolOutput.substring(0, 1000) + '... [Tool Data Truncated]';
                    }
                    messages.push({ role: 'tool', content: toolOutput, tool_call_id: result.tool_call_id });
                }
            }
        }
    }

    // Add current user message (with optional Vision attachments)
    if (attachments && attachments.length > 0) {
        // GPT-4o Vision: build multi-part content with text + images
        const contentParts = [
            { type: 'text', text: message }
        ];
        for (const att of attachments) {
            if (att.base64 && att.mimeType) {
                contentParts.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${att.mimeType};base64,${att.base64}`,
                        detail: 'auto'
                    }
                });
            }
        }
        messages.push({ role: 'user', content: contentParts });
    } else {
        messages.push({ role: 'user', content: message });
    }

    // 6. Determine which tools are available based on context
    const availableTools = patientId
        ? TOOL_CATALOG  // All tools when a patient is selected
        : TOOL_CATALOG.filter(t => {
            const name = t.function.name;
            // Only global tools when no patient
            return ['get_schedule_summary', 'get_pending_notes', 'get_inbox_summary',
                'navigate_to', 'query_clinical_data', 'search_guidelines',
                'handoff_summary', 'create_reminder'].includes(name);
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
                // Phase 2B: Lab visualizations
                if (result.type === 'lab_analysis') {
                    visualizations.push({ type: 'lab_analysis', ...result.result });
                }
                if (result.type === 'lab_trend') {
                    visualizations.push({ type: 'lab_analysis', ...result.result });
                }
                if (result.type === 'lab_interpretation') {
                    visualizations.push({ type: 'lab_interpretation', ...result.result });
                }
                if (result.type === 'clinical_gaps') {
                    visualizations.push({ type: 'clinical_gaps', ...result.result });
                }
                if (result.type === 'staged_action') {
                    visualizations.push({ type: 'staged_action', ...result.result });
                }
                if (result.type === 'risk_scores' || result.type === 'risk_assessment') {
                    visualizations.push({ type: 'risk_assessment', ...result.result });
                }
                // Phase 4: Document analysis & guideline evidence
                if (result.type === 'document_analysis') {
                    visualizations.push({ type: 'document_analysis', ...result.result });
                }
                if (result.type === 'guideline_evidence') {
                    visualizations.push({ type: 'guideline_evidence', ...result.result });
                }
                // Phase 5B: Agentic workflow tool visualizations
                if (result.type === 'clinical_document') {
                    visualizations.push({ type: 'clinical_document', ...result.result });
                }
                if (result.type === 'billing_suggestion') {
                    visualizations.push({ type: 'billing_suggestion', ...result.result });
                }
                if (result.type === 'visit_prep') {
                    visualizations.push({ type: 'visit_prep', ...result.result });
                }
                if (result.type === 'followup_plan') {
                    visualizations.push({ type: 'followup_plan', ...result.result });
                }
                if (result.type === 'handoff_summary') {
                    visualizations.push({ type: 'handoff_summary', ...result.result });
                }
                if (result.type === 'med_reconciliation') {
                    visualizations.push({ type: 'med_reconciliation', ...result.result });
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
                    action: result.type === 'write_action' || result.type === 'staged_action' ? result.type : 'tool_execution',
                    toolName: toolCall.function.name,
                    inputRedacted: redactPHI(JSON.stringify(args)),
                    outputSummary: `${result.dataAccessed?.join(', ') || 'unknown'} accessed`,
                    dataAccessed: result.dataAccessed,
                    riskLevel: result.type === 'write_action' || result.type === 'staged_action' ? 'high' :
                        toolCall.function.name === 'query_clinical_data' ? 'medium' : 'low'
                });
            }

            llmResponse = await callLLM(messages, availableTools);
            totalTokens += llmResponse.usage?.total_tokens || 0;
        }

        finalResponse = llmResponse.content || '';

    } catch (err) {
        console.error('[Echo] Chat error stack:', err.stack);
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
            'Authorization': `Bearer ${AI_API_KEY || process.env.OPENAI_API_KEY}`
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
    // Drop the FK constraint if it exists — echo_conversations is in public schema
    // but patients live in tenant schemas, so the FK can never be satisfied
    try {
        await pool.query(`
            ALTER TABLE echo_conversations 
            DROP CONSTRAINT IF EXISTS echo_conversations_patient_id_fkey
        `);
    } catch (e) {
        // Ignore — constraint may already be dropped
    }

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

async function getMessageHistory(conversationId, limit = 30) {
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

/**
 * Transcribe clinical audio using OpenAI Whisper
 */
async function transcribeAudio(buffer, originalname) {
    try {
        const formData = new FormData();
        // Node 18+ fetch handles FormData + Blob nicely
        const blob = new Blob([buffer], { type: 'audio/webm' });
        formData.append('file', blob, originalname || 'audio.webm');
        formData.append('model', 'whisper-1');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AI_API_KEY}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('[Echo Service] OpenAI Whisper Error:', errorBody);
            throw new Error(`Whisper API error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        return data.text;
    } catch (err) {
        console.error('[Echo Service] Transcription failure:', err.message);
        throw err;
    }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    chat,
    executeTool,
    TOOL_CATALOG,
    loadConversation,
    getMessageHistory,
    checkTokenBudget,
    transcribeAudio
};
