/**
 * noteSerializer.js
 * Pure-function utilities for serializing / deserializing a visit note.
 * No React – testable in isolation.
 */

// ─── HTML Entity Decoding ───────────────────────────────────────────────────

export const decodeHtmlEntities = (text) => {
    if (typeof text !== 'string') return String(text || '');
    let str = text;
    if (typeof document !== 'undefined') {
        const el = document.createElement('textarea');
        for (let i = 0; i < 4; i++) {
            const prev = str;
            el.innerHTML = str;
            str = el.value;
            str = str
                .replace(/&#x2F;/gi, '/')
                .replace(/&#47;/g, '/')
                .replace(/&sol;/g, '/')
                .replace(/&amp;/g, '&');
            if (str === prev) break;
        }
    } else {
        str = str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x2F;/gi, '/');
    }
    return str;
};

// ─── Section Definitions (order matters) ────────────────────────────────────

const SECTION_DEFS = [
    { key: 'chiefComplaint', labels: ['Chief Complaint', 'CC'] },
    { key: 'hpi', labels: ['HPI', 'History of Present Illness'] },
    { key: 'rosNotes', labels: ['ROS', 'Review of Systems'] },
    { key: 'peNotes', labels: ['PE', 'Physical Exam'] },
    { key: 'results', labels: ['Results', 'Data'] },
    { key: 'assessment', labels: ['Assessment', 'A'] },
    { key: 'plan', labels: ['Plan', 'P'] },
    { key: 'cts', labels: ['Caregiver Training', 'CTS'] },
    { key: 'ascvd', labels: ['ASCVD Risk', 'Cardiovascular'] },
    { key: 'safetyPlan', labels: ['Safety Plan', 'Behavioral Safety'] },
    { key: 'carePlan', labels: ['Care Plan', 'CP'] },
    { key: 'followUp', labels: ['Follow Up', 'FU'] },
];

// Build a union of all labels for stop-pattern (used in regex building)
const allLabels = SECTION_DEFS.flatMap(s => s.labels);

// ─── parseNoteText ──────────────────────────────────────────────────────────

/**
 * Parse a flat note_draft string into an object keyed by section.
 * Returns an object like { chiefComplaint: '', hpi: '', rosNotes: '', ... }
 */
export const parseNoteText = (text) => {
    const empty = SECTION_DEFS.reduce((acc, s) => ({ ...acc, [s.key]: '' }), {});
    if (!text || !text.trim()) return empty;

    const decoded = decodeHtmlEntities(text);
    const safe = typeof decoded === 'string' ? decoded : String(decoded || '');

    const result = { ...empty };

    SECTION_DEFS.forEach((section, idx) => {
        // All label alternatives after this section serve as stop-points
        const followingLabels = SECTION_DEFS.slice(idx + 1).flatMap(s => s.labels);
        const stopPattern = followingLabels.length > 0
            ? `(?:\\n\\n|\\n(?:${followingLabels.join('|')}):|$)`
            : '(?:\\n\\n|$)';
        const labelAlt = section.labels.join('|');
        const regex = new RegExp(`(?:${labelAlt}):\\s*(.+?)${stopPattern}`, 'is');
        const match = safe.match(regex);
        if (match) {
            result[section.key] = decodeHtmlEntities(match[1].trim());
        }
    });

    return result;
};

// ─── parsePlanText ──────────────────────────────────────────────────────────

/**
 * Parse numbered plan text into structured [{diagnosis, orders}] array.
 * Example input:
 *   "1. HTN\n  • Continue lisinopril\n2. DM2\n  • Check A1c"
 * Returns:
 *   [{ diagnosis: 'HTN', orders: ['Continue lisinopril'] },
 *    { diagnosis: 'DM2', orders: ['Check A1c'] }]
 */
export const parsePlanText = (planText) => {
    if (!planText || !planText.trim()) return [];
    const structured = [];
    const lines = planText.split('\n');
    let currentDiagnosis = null;
    let currentOrders = [];

    for (const rawLine of lines) {
        const line = (typeof rawLine === 'string' ? rawLine : String(rawLine || '')).trim();
        const diagMatch = line.match(/^(\d+)\.\s*(.+)$/);

        if (diagMatch) {
            if (currentDiagnosis) {
                structured.push({ diagnosis: currentDiagnosis, orders: [...currentOrders] });
            }
            currentDiagnosis = diagMatch[2].trim();
            currentOrders = [];
        } else if (line.startsWith('•') || line.startsWith('-')) {
            const orderText = line.replace(/^[•\-]\s*/, '').trim();
            if (orderText && currentDiagnosis) currentOrders.push(orderText);
        } else if (line && currentDiagnosis) {
            currentOrders.push(line);
        }
    }

    if (currentDiagnosis) {
        structured.push({ diagnosis: currentDiagnosis, orders: currentOrders });
    }

    return structured;
};

// ─── formatPlanText ─────────────────────────────────────────────────────────

/**
 * Convert structured plan array back to numbered text.
 */
export const formatPlanText = (structuredPlan) => {
    if (!structuredPlan || structuredPlan.length === 0) return '';
    return structuredPlan
        .map((item, index) => {
            const dx = `${index + 1}. ${item.diagnosis}`;
            const orders = item.orders.map(o => `  • ${o}`).join('\n');
            return orders ? `${dx}\n${orders}` : dx;
        })
        .join('\n\n');
};

// ─── combineNoteSections ────────────────────────────────────────────────────

/**
 * Combine note data object back into a single string for storage.
 */
export const combineNoteSections = (data) => {
    const sections = [];

    if (data.chiefComplaint) sections.push(`Chief Complaint: ${data.chiefComplaint}`);
    if (data.hpi) sections.push(`HPI: ${data.hpi}`);
    if (data.rosNotes) sections.push(`Review of Systems: ${data.rosNotes}`);
    if (data.peNotes) sections.push(`Physical Exam: ${data.peNotes}`);
    if (data.results) sections.push(`Results: ${data.results}`);
    if (data.assessment) sections.push(`Assessment: ${data.assessment}`);

    // Prefer structured plan over plain text
    let planText = '';
    if (data.planStructured && data.planStructured.length > 0) {
        planText = formatPlanText(data.planStructured);
    } else if (data.plan) {
        planText = data.plan;
    }
    if (planText) sections.push(`Plan: ${planText}`);

    if (data.cts) sections.push(`Caregiver Training: ${data.cts}`);
    if (data.ascvd) sections.push(`ASCVD Risk: ${data.ascvd}`);
    if (data.safetyPlan) sections.push(`Safety Plan: ${data.safetyPlan}`);
    if (data.carePlan) sections.push(`Care Plan: ${data.carePlan}`);
    if (data.followUp) sections.push(`Follow Up: ${data.followUp}`);

    return sections.join('\n\n');
};

// ─── Vitals Utilities ───────────────────────────────────────────────────────

export const convertWeight = (value, fromUnit, toUnit) => {
    if (!value) return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (fromUnit === 'lbs' && toUnit === 'kg') return (num / 2.20462).toFixed(1);
    if (fromUnit === 'kg' && toUnit === 'lbs') return (num * 2.20462).toFixed(1);
    return value;
};

export const convertHeight = (value, fromUnit, toUnit) => {
    if (!value || fromUnit === toUnit) return value;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (fromUnit === 'in' && toUnit === 'cm') return (num * 2.54).toFixed(1);
    if (fromUnit === 'cm' && toUnit === 'in') return (num / 2.54).toFixed(1);
    return value;
};

export const calculateBMI = (weight, weightUnit, height, heightUnit) => {
    const weightKg = weightUnit === 'lbs' ? parseFloat(weight) / 2.20462 : parseFloat(weight);
    const heightM = heightUnit === 'in' ? parseFloat(height) * 0.0254 : parseFloat(height) / 100;
    if (isNaN(weightKg) || isNaN(heightM) || heightM === 0) return '';
    return (weightKg / (heightM * heightM)).toFixed(1);
};

export const isAbnormalVital = (type, value) => {
    if (!value || value === '') return false;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    const ranges = {
        systolic: [90, 140],
        diastolic: [60, 90],
        temp: [97, 99.5],
        pulse: [60, 100],
        resp: [12, 20],
        o2sat: [95, Infinity],
        bmi: [18.5, 25],
    };
    const r = ranges[type];
    if (!r) return false;
    return num < r[0] || num > r[1];
};

// ─── Clinical Defaults ─────────────────────────────────────────────────────

export const rosFindings = {
    constitutional: 'No fever, chills, fatigue, or weight loss.',
    eyes: 'No vision changes, eye pain, or discharge.',
    ent: 'No hearing loss, ear pain, nasal congestion, or sore throat.',
    cardiovascular: 'No chest pain, palpitations, or shortness of breath.',
    respiratory: 'No cough, wheezing, or difficulty breathing.',
    gastrointestinal: 'No nausea, vomiting, diarrhea, or abdominal pain.',
    genitourinary: 'No dysuria, frequency, urgency, or hematuria.',
    musculoskeletal: 'No joint pain, swelling, or muscle weakness.',
    neurological: 'No headaches, dizziness, or seizures.',
    skin: 'No rashes, lesions, or changes in moles.',
};

export const peFindings = {
    general: 'Well-appearing, alert, in no acute distress.',
    headNeck: 'Normocephalic, atraumatic. No lymphadenopathy. Neck supple.',
    eyes: 'PERRLA, EOMI. No conjunctival injection.',
    ent: 'TMs clear. Oropharynx clear. Nasal mucosa normal.',
    cardiovascular: 'Regular rate and rhythm. No murmurs. Pulses intact.',
    respiratory: 'Clear to auscultation bilaterally. No wheezes or rales.',
    abdomen: 'Soft, non-tender, non-distended. Bowel sounds active.',
    extremities: 'No edema or clubbing. Full range of motion. Pulses intact.',
    neurological: 'Alert and oriented x3. Cranial nerves intact. Strength 5/5.',
    skin: 'No rashes or lesions. Good turgor.',
};

// ─── Empty State Factories ──────────────────────────────────────────────────

export const createEmptyNoteData = () => ({
    chiefComplaint: '',
    hpi: '',
    ros: {
        constitutional: false, eyes: false, ent: false, cardiovascular: false,
        respiratory: false, gastrointestinal: false, genitourinary: false,
        musculoskeletal: false, neurological: false, skin: false,
    },
    rosNotes: '',
    pe: {
        general: false, headNeck: false, eyes: false, ent: false,
        cardiovascular: false, respiratory: false, abdomen: false,
        extremities: false, neurological: false, skin: false,
    },
    peNotes: '',
    results: '',
    assessment: '',
    plan: '',
    planStructured: [],
    cts: '',
    ascvd: '',
    safetyPlan: '',
    carePlan: '',
    followUp: '',
});

export const createEmptyVitals = () => ({
    systolic: '', diastolic: '', bp: '', bpReadings: [],
    temp: '', pulse: '', resp: '', o2sat: '',
    weight: '', height: '', bmi: '',
    weightUnit: 'lbs', heightUnit: 'in',
});

/**
 * Build the vitals payload for API save.
 */
export const buildVitalsPayload = (vitals) => ({
    systolic: vitals.systolic || null,
    diastolic: vitals.diastolic || null,
    bp: vitals.bp || (vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic}` : null),
    temp: vitals.temp || null,
    pulse: vitals.pulse || null,
    resp: vitals.resp || null,
    o2sat: vitals.o2sat || null,
    weight: vitals.weight || null,
    height: vitals.height || null,
    bmi: vitals.bmi || null,
    weightUnit: vitals.weightUnit || 'lbs',
    heightUnit: vitals.heightUnit || 'in',
});

/**
 * Parse vitals from a visit response into our vitals state shape.
 */
export const parseVitalsFromVisit = (visit) => {
    if (!visit.vitals) return null;
    const v = typeof visit.vitals === 'string' ? JSON.parse(visit.vitals) : visit.vitals;
    return {
        systolic: v.systolic || '',
        diastolic: v.diastolic || '',
        bp: decodeHtmlEntities(v.bp) || (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : ''),
        bpReadings: v.bpReadings || [],
        temp: v.temp || '',
        pulse: v.pulse || '',
        resp: v.resp || '',
        o2sat: v.o2sat || '',
        weight: v.weight || '',
        height: v.height || '',
        bmi: v.bmi || '',
        weightUnit: v.weightUnit || 'lbs',
        heightUnit: v.heightUnit || 'in',
    };
};
