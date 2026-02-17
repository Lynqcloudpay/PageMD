/**
 * Echo Context Engine
 * 
 * Assembles rich patient context for every Echo interaction.
 * Phase 1: Direct SQL queries against existing PostgreSQL tables.
 * Future: pgvector semantic search over unstructured notes.
 */

const pool = require('../db');
const patientEncryptionService = require('./patientEncryptionService');

/**
 * Assemble complete patient context for Echo
 * Parallel-fetches all clinical data sources
 */
async function assemblePatientContext(patientId, tenantId) {
    const [
        demographics,
        allergies,
        medications,
        problems,
        recentVisits,
        vitalHistory,
        activeOrders,
        familyHistory,
        socialHistory,
        labs
    ] = await Promise.all([
        getPatientDemographics(patientId),
        getAllergies(patientId),
        getActiveMedications(patientId),
        getActiveProblems(patientId),
        getRecentVisits(patientId, 3), // Lean baseline
        getVitalHistory(patientId, 10), // Lean baseline
        getActiveOrders(patientId),
        getFamilyHistory(patientId),
        getSocialHistory(patientId),
        getLabResults(patientId, 20) // Lean baseline
    ]);

    return {
        demographics,
        allergies,
        medications,
        problems,
        recentVisits,
        vitalHistory,
        activeOrders,
        familyHistory,
        socialHistory,
        labs,
        assembled_at: new Date().toISOString()
    };
}

/**
 * Build a concise text summary of patient context for the LLM
 * Keeps token usage minimal while providing comprehensive clinical picture
 */
function buildContextPrompt(context) {
    const parts = [];
    const d = context.demographics;

    if (d) {
        const age = d.dob ? calculateAge(d.dob) : '?yo';
        parts.push(`Px: ${d.first_name[0]}.${d.last_name}, ${age}, ${d.sex || '?'}, MRN:${d.mrn || 'N/A'}`);
    }

    if (context.allergies?.length > 0) {
        parts.push(`ALR: ${context.allergies.map(a => `${a.allergen}${a.reaction ? `(${a.reaction})` : ''}`).join('; ')}`);
    } else {
        parts.push('ALR: NKDA');
    }

    if (context.medications?.length > 0) {
        parts.push(`MEDS: ${context.medications.map(m => `${m.medication_name}${m.dosage ? ` ${m.dosage}` : ''}`).join('; ')}`);
    }

    if (context.problems?.length > 0) {
        parts.push(`PRB: ${context.problems.map(p => `${p.problem_name}${p.code ? `(${p.code})` : ''}`).join('; ')}`);
    }

    if (context.vitalHistory?.length > 0) {
        const latest = context.vitalHistory[context.vitalHistory.length - 1];
        if (latest?.vitals) {
            const v = latest.vitals;
            const vs = [];
            if (v.systolicBp) vs.push(`${v.systolicBp}/${v.diastolicBp}`);
            if (v.heartRate) vs.push(`HR${v.heartRate}`);
            if (v.temperature) vs.push(`T${v.temperature}`);
            if (v.weight) vs.push(`${v.weight}lbs`);
            parts.push(`VS(${latest.visit_date}): ${vs.join(',')}`);
        }
    }

    if (context.recentVisits?.length > 0) {
        const visitLines = context.recentVisits.map(v => {
            const date = v.date || v.visit_date;
            const cc = extractSection(v.note_draft, 'HPI') || v.type || 'Visit';
            const ccTrunc = cc.substring(0, 40).replace(/\n/g, ' ');
            return ` •${date}: ${ccTrunc}...`;
        }).join('\n');
        parts.push(`HX:\n${visitLines}`);
    }

    if (context.activeOrders?.length > 0) {
        parts.push(`ORD: ${context.activeOrders.map(o => `${o.order_name || o.order_type}(${o.status})`).join('; ')}`);
    }

    if (context.labResults?.length > 0) {
        // Condensed lab view
        const labSummary = context.labResults.slice(0, 30).map(l =>
            `${l.test_name}:${l.value}${l.unit || ''}(${new Date(l.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})`
        ).join(', ');
        parts.push(`LABS: ${labSummary}`);
    }

    return parts.join('\n');
}

// ─── Data Fetchers ──────────────────────────────────────────────────────────

async function getPatientDemographics(patientId) {
    try {
        const res = await pool.query(
            `SELECT id, first_name, last_name, dob, sex, phone, email, mrn, encryption_metadata
             FROM patients WHERE id = $1`,
            [patientId]
        );
        if (res.rows.length === 0) return null;
        return await patientEncryptionService.decryptPatientPHI(res.rows[0]);
    } catch (err) {
        console.warn('[EchoContext] Demographics fetch failed:', err.message);
        return null;
    }
}

async function getAllergies(patientId) {
    try {
        const result = await pool.query(
            'SELECT allergen, reaction, severity, onset_date FROM allergies WHERE patient_id = $1 AND active = true ORDER BY created_at DESC',
            [patientId]
        );
        return result.rows;
    } catch (err) {
        console.warn('[EchoContext] Allergies fetch failed:', err.message);
        return [];
    }
}

async function getActiveMedications(patientId) {
    try {
        const result = await pool.query(
            'SELECT medication_name, dosage, frequency, route, start_date FROM medications WHERE patient_id = $1 AND active = true ORDER BY created_at DESC',
            [patientId]
        );
        return result.rows;
    } catch (err) {
        console.warn('[EchoContext] Medications fetch failed:', err.message);
        return [];
    }
}

async function getActiveProblems(patientId) {
    try {
        const res = await pool.query(
            `SELECT id, problem_name as name, icd10_code as code, onset_date, status
             FROM problems 
             WHERE patient_id = $1 AND status = 'active'
             ORDER BY onset_date DESC`,
            [patientId]
        );
        return res.rows;
    } catch (err) {
        console.warn('[EchoContext] Problems fetch failed:', err.message);
        return [];
    }
}

async function getRecentVisits(patientId, limit = 5) {
    try {
        const res = await pool.query(
            `SELECT id, visit_date as date, visit_type as type, vitals, note_draft
             FROM visits 
             WHERE patient_id = $1 
             ORDER BY visit_date DESC LIMIT $2`,
            [patientId, limit]
        );
        // Normalize vitals in recent visits
        return res.rows.map(row => ({
            ...row,
            vitals: normalizeVitals(row.vitals)
        }));
    } catch (err) {
        console.warn('[EchoContext] Visits fetch failed:', err.message);
        return [];
    }
}

async function getVitalHistory(patientId, limit = 20) {
    try {
        const result = await pool.query(
            `SELECT visit_date, vitals FROM visits 
             WHERE patient_id = $1 AND vitals IS NOT NULL 
             ORDER BY visit_date ASC LIMIT $2`,
            [patientId, limit]
        );
        return result.rows.map(row => ({
            ...row,
            vitals: normalizeVitals(row.vitals)
        }));
    } catch (err) {
        console.warn('[EchoContext] Vital history fetch failed:', err.message);
        return [];
    }
}

async function getActiveOrders(patientId) {
    try {
        const res = await pool.query(
            `SELECT id, order_type as type, test_name as name, status, created_at
             FROM orders 
             WHERE patient_id = $1 AND status IN ('pending', 'sent')
             ORDER BY created_at DESC`,
            [patientId]
        );
        return res.rows;
    } catch (err) {
        console.warn('[EchoContext] Orders fetch failed:', err.message);
        return [];
    }
}

async function getFamilyHistory(patientId) {
    try {
        const res = await pool.query(
            `SELECT id, condition, relationship, age_at_diagnosis as age
             FROM family_history 
             WHERE patient_id = $1`,
            [patientId]
        );
        return res.rows;
    } catch (err) {
        console.warn('[EchoContext] Family history fetch failed:', err.message);
        return [];
    }
}

async function getSocialHistory(patientId) {
    try {
        const result = await pool.query(
            'SELECT smoking_status, alcohol_use, occupation, exercise_frequency FROM social_history WHERE patient_id = $1 LIMIT 1',
            [patientId]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.warn('[EchoContext] Social history fetch failed:', err.message);
        return null;
    }
}

async function getLabResults(patientId, limit = 50) {
    try {
        const res = await pool.query(
            `SELECT test_name, result_value as value, result_units as unit, created_at as date
             FROM orders 
             WHERE patient_id = $1 AND result_value IS NOT NULL 
             ORDER BY created_at DESC LIMIT $2`,
            [patientId, limit]
        );
        return res.rows || [];
    } catch (err) {
        console.warn('[EchoContext] Lab results fetch failed:', err.message);
        return [];
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateAge(dob) {
    if (!dob) return null;
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
        age--;
    }
    return `${age}yo`;
}

/**
 * Simple parser to extract sections from note_draft strings
 */
function extractSection(note, sectionName) {
    if (!note) return null;
    const regex = new RegExp(`${sectionName}:?\\s*([\\s\\S]*?)(?=\\n[A-Z][a-z]+:|$)`, 'i');
    const match = note.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * Normalizes vitals from raw database format to Echo standard format
 */
function normalizeVitals(vitals) {
    if (!vitals) return null;
    const v = typeof vitals === 'string' ? JSON.parse(vitals) : vitals;

    // Mapping: DB Key -> Echo Key
    return {
        ...v,
        systolicBp: v.systolicBp || v.systolic,
        diastolicBp: v.diastolicBp || v.diastolic,
        heartRate: v.heartRate || v.pulse || v.pulseRate,
        temperature: v.temperature || v.temp,
        oxygenSaturation: v.oxygenSaturation || v.o2sat || v.spo2,
        respiratoryRate: v.respiratoryRate || v.resp || v.rr,
        weight: v.weight,
        bmi: v.bmi
    };
}

module.exports = {
    assemblePatientContext,
    buildContextPrompt,
    getVitalHistory,
    extractSection,
    normalizeVitals
};
