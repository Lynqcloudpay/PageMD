/**
 * Echo Guideline Engine (Phase 4B)
 * 
 * Provides evidence-based clinical guideline citations.
 * Hardcoded references from ADA, AHA/ACC, USPSTF, and other
 * authoritative bodies. Keyword-matched for LLM retrieval.
 */

// ─── Clinical Guidelines Database ───────────────────────────────────────────

const CLINICAL_GUIDELINES = [
    // ── ADA — Diabetes ──────────────────────────────────────────────────
    {
        id: 'ada_a1c_target',
        source: 'ADA Standards of Care',
        year: 2024,
        topic: 'Diabetes — Glycemic Targets',
        keywords: ['diabetes', 'a1c', 'hba1c', 'glycemic', 'target', 'glucose', 'sugar', 'control'],
        recommendation: 'A reasonable A1c goal for many nonpregnant adults is <7% (53 mmol/mol). A less stringent goal (e.g., <8%) may be appropriate for patients with limited life expectancy, extensive comorbidities, long-standing diabetes, or history of severe hypoglycemia.',
        grade: 'Level A',
        category: 'chronic'
    },
    {
        id: 'ada_metformin',
        source: 'ADA Standards of Care',
        year: 2024,
        topic: 'Diabetes — First-Line Therapy',
        keywords: ['diabetes', 'metformin', 'first line', 'medication', 'treatment', 'dm2', 'type 2'],
        recommendation: 'Metformin is the preferred initial pharmacologic agent for type 2 diabetes. If A1c is ≥1.5% above target, consider early combination therapy. For patients with established ASCVD or high CV risk, add GLP-1 RA or SGLT2 inhibitor regardless of A1c.',
        grade: 'Level A',
        category: 'chronic'
    },
    {
        id: 'ada_screening',
        source: 'ADA Standards of Care',
        year: 2024,
        topic: 'Diabetes — Screening',
        keywords: ['diabetes', 'screening', 'prediabetes', 'fasting glucose', 'ogtt', 'risk'],
        recommendation: 'Screen for prediabetes/type 2 diabetes in adults aged ≥35, or earlier if BMI ≥25 kg/m² (≥23 in Asian Americans) with one or more additional risk factors. Use fasting plasma glucose, 2-hour OGTT, or A1c. Re-screen every 3 years if normal.',
        grade: 'Level B',
        category: 'preventive'
    },
    {
        id: 'ada_diabetic_kidney',
        source: 'ADA Standards of Care',
        year: 2024,
        topic: 'Diabetes — Kidney Disease Monitoring',
        keywords: ['diabetes', 'kidney', 'nephropathy', 'microalbumin', 'uacr', 'gfr', 'ckd', 'renal'],
        recommendation: 'At least once a year, assess urinary albumin (UACR) and eGFR in patients with type 1 diabetes duration ≥5 years and in all type 2 diabetes patients. Use ACE inhibitor or ARB for those with albuminuria. Consider SGLT2 inhibitor or finerenone for additional renal protection.',
        grade: 'Level A',
        category: 'chronic'
    },
    {
        id: 'ada_eye_exam',
        source: 'ADA Standards of Care',
        year: 2024,
        topic: 'Diabetes — Retinal Screening',
        keywords: ['diabetes', 'eye', 'retinal', 'retinopathy', 'dilated', 'ophthalmology', 'screening'],
        recommendation: 'Dilated eye exam at time of diagnosis for type 2 diabetes and within 5 years of diagnosis for type 1. Repeat annually or every 2 years if no retinopathy on prior exam.',
        grade: 'Level B',
        category: 'preventive'
    },

    // ── AHA/ACC — Blood Pressure ─────────────────────────────────────────
    {
        id: 'aha_bp_target',
        source: 'AHA/ACC Hypertension Guidelines',
        year: 2017,
        topic: 'Hypertension — BP Targets',
        keywords: ['blood pressure', 'hypertension', 'bp', 'target', 'systolic', 'diastolic', 'htn'],
        recommendation: 'BP target <130/80 mmHg for most adults with confirmed hypertension and known CVD or 10-year ASCVD risk ≥10%. For lower-risk patients, a target of <140/90 may be reasonable. Confirm diagnosis with out-of-office measurements.',
        grade: 'Level A (Class I)',
        category: 'chronic'
    },
    {
        id: 'aha_bp_lifestyle',
        source: 'AHA/ACC Hypertension Guidelines',
        year: 2017,
        topic: 'Hypertension — Lifestyle Modifications',
        keywords: ['blood pressure', 'hypertension', 'lifestyle', 'diet', 'exercise', 'salt', 'sodium', 'dash', 'weight'],
        recommendation: 'Nonpharmacologic interventions for all adults with elevated BP or hypertension: weight loss (if overweight), DASH diet, sodium reduction (<1500 mg/day ideal), potassium supplementation (3500-5000 mg/day), physical activity (90-150 min/week aerobic), moderation of alcohol.',
        grade: 'Level A (Class I)',
        category: 'chronic'
    },
    {
        id: 'aha_bp_firstline',
        source: 'AHA/ACC Hypertension Guidelines',
        year: 2017,
        topic: 'Hypertension — First-Line Medications',
        keywords: ['blood pressure', 'hypertension', 'medication', 'ace', 'arb', 'ccb', 'thiazide', 'first line', 'treatment'],
        recommendation: 'First-line agents include thiazide diuretics, ACE inhibitors, ARBs, and calcium channel blockers. For Stage 2 HTN (≥140/90), initiate with 2 agents from different classes. ACE/ARB preferred if diabetes, CKD, or heart failure. Avoid ACE+ARB combination.',
        grade: 'Level A (Class I)',
        category: 'chronic'
    },

    // ── AHA/ACC — Lipids ─────────────────────────────────────────────────
    {
        id: 'acc_statin_primary',
        source: 'AHA/ACC Cholesterol Guideline',
        year: 2018,
        topic: 'Lipids — Primary Prevention with Statins',
        keywords: ['cholesterol', 'statin', 'ldl', 'lipid', 'ascvd', 'primary prevention', 'cardiovascular'],
        recommendation: 'For primary prevention in adults 40-75 with LDL ≥70 mg/dL and 10-year ASCVD risk ≥7.5%, recommend moderate-to-high intensity statin. If risk ≥20%, high-intensity statin. For risk 5-7.5% (borderline), consider risk-enhancing factors (family history, CRP, CAC score).',
        grade: 'Level A (Class I)',
        category: 'preventive'
    },
    {
        id: 'acc_statin_secondary',
        source: 'AHA/ACC Cholesterol Guideline',
        year: 2018,
        topic: 'Lipids — Secondary Prevention (Known ASCVD)',
        keywords: ['cholesterol', 'statin', 'ascvd', 'secondary prevention', 'cad', 'stroke', 'mi', 'heart attack'],
        recommendation: 'All patients with clinical ASCVD should receive high-intensity statin therapy (atorvastatin 40-80 mg or rosuvastatin 20-40 mg). If LDL remains ≥70 mg/dL on maximally tolerated statin, add ezetimibe. If LDL still ≥70, consider PCSK9 inhibitor.',
        grade: 'Level A (Class I)',
        category: 'chronic'
    },

    // ── USPSTF — Screening ───────────────────────────────────────────────
    {
        id: 'uspstf_colon',
        source: 'USPSTF',
        year: 2021,
        topic: 'Colorectal Cancer Screening',
        keywords: ['colon', 'colorectal', 'colonoscopy', 'cancer', 'screening', 'cologuard', 'fit'],
        recommendation: 'Screen for colorectal cancer in all adults aged 45-75 years (Grade A). Methods: colonoscopy every 10 years, FIT annually, FIT-DNA (Cologuard) every 1-3 years, CT colonography every 5 years, or flexible sigmoidoscopy every 5 years. Ages 76-85: individualize (Grade C).',
        grade: 'Grade A (45-75), Grade C (76-85)',
        category: 'preventive'
    },
    {
        id: 'uspstf_breast',
        source: 'USPSTF',
        year: 2024,
        topic: 'Breast Cancer Screening',
        keywords: ['breast', 'mammogram', 'mammography', 'cancer', 'screening', 'breast cancer'],
        recommendation: 'Screening mammography every 2 years for women aged 40-74 years (Grade B). Decision to screen before 40 should be individualized. Higher risk women (family history, BRCA, prior chest radiation) may benefit from MRI in addition to mammography.',
        grade: 'Grade B',
        category: 'preventive'
    },
    {
        id: 'uspstf_cervical',
        source: 'USPSTF',
        year: 2018,
        topic: 'Cervical Cancer Screening',
        keywords: ['cervical', 'pap', 'hpv', 'screening', 'pap smear', 'cervical cancer'],
        recommendation: 'Women 21-29: Pap smear every 3 years. Women 30-65: Pap every 3 years, hrHPV every 5 years, or co-testing every 5 years. No screening needed after 65 if adequate prior screening and not high risk.',
        grade: 'Grade A',
        category: 'preventive'
    },
    {
        id: 'uspstf_lung',
        source: 'USPSTF',
        year: 2021,
        topic: 'Lung Cancer Screening',
        keywords: ['lung', 'screening', 'ldct', 'ct', 'smoker', 'tobacco', 'lung cancer', 'smoking'],
        recommendation: 'Annual low-dose CT (LDCT) for adults aged 50-80 years who have a 20 pack-year smoking history and currently smoke or have quit within the past 15 years. Discontinue once the person has not smoked for 15 years or develops a condition limiting life expectancy.',
        grade: 'Grade B',
        category: 'preventive'
    },
    {
        id: 'uspstf_osteoporosis',
        source: 'USPSTF',
        year: 2018,
        topic: 'Osteoporosis Screening',
        keywords: ['osteoporosis', 'dexa', 'bone density', 'fracture', 'screening'],
        recommendation: 'Screen with DEXA for osteoporosis in women aged ≥65 years and in younger postmenopausal women at increased risk (FRAX tool). Evidence insufficient themselves for men screening.',
        grade: 'Grade B',
        category: 'preventive'
    },
    {
        id: 'uspstf_aaa',
        source: 'USPSTF',
        year: 2019,
        topic: 'Abdominal Aortic Aneurysm Screening',
        keywords: ['aaa', 'aortic', 'aneurysm', 'ultrasound', 'screening'],
        recommendation: 'One-time screening for AAA with ultrasound in men aged 65-75 who have ever smoked.',
        grade: 'Grade B',
        category: 'preventive'
    },

    // ── AGA/ACG — GI ─────────────────────────────────────────────────────
    {
        id: 'acg_gerd',
        source: 'ACG Clinical Guideline',
        year: 2022,
        topic: 'GERD Management',
        keywords: ['gerd', 'reflux', 'heartburn', 'ppi', 'proton pump', 'acid', 'esophagitis'],
        recommendation: 'For typical GERD, trial of PPI once daily for 8 weeks. If partial response, increase to twice daily. Discontinue PPI after symptom resolution and use on-demand dosing. Long-term PPI use should be at the lowest effective dose. Consider endoscopy if alarm symptoms (dysphagia, weight loss, anemia).',
        grade: 'Strong recommendation',
        category: 'chronic'
    },

    // ── Anticoagulation ──────────────────────────────────────────────────
    {
        id: 'aha_afib_anticoag',
        source: 'AHA/ACC/HRS Atrial Fibrillation Guideline',
        year: 2023,
        topic: 'Atrial Fibrillation — Anticoagulation',
        keywords: ['afib', 'atrial fibrillation', 'anticoagulation', 'warfarin', 'doac', 'stroke', 'chads'],
        recommendation: 'Oral anticoagulation recommended for patients with AF and CHA2DS2-VASc score ≥2 in men or ≥3 in women. DOACs (apixaban, rivarelbān, edoxaban, dabigatran) are preferred over warfarin unless mechanical valve or moderate-to-severe mitral stenosis. Aspirin alone is NOT recommended for stroke prevention in AF.',
        grade: 'Level A (Class I)',
        category: 'chronic'
    },

    // ── Obesity ──────────────────────────────────────────────────────────
    {
        id: 'aha_obesity',
        source: 'AHA/ACC/TOS Obesity Guideline',
        year: 2013,
        topic: 'Obesity — Weight Management',
        keywords: ['obesity', 'bmi', 'weight', 'weight loss', 'overweight', 'diet', 'bariatric'],
        recommendation: 'For overweight/obese adults, recommend comprehensive lifestyle intervention with caloric reduction, increased physical activity, and behavioral strategies. Consider pharmacotherapy if BMI ≥30 or ≥27 with comorbidities and lifestyle alone is insufficient. Consider bariatric surgery for BMI ≥40 or ≥35 with comorbidities.',
        grade: 'Level A (Class I)',
        category: 'chronic'
    },

    // ── CKD ──────────────────────────────────────────────────────────────
    {
        id: 'kdigo_ckd',
        source: 'KDIGO CKD Guideline',
        year: 2024,
        topic: 'Chronic Kidney Disease — Management',
        keywords: ['ckd', 'kidney', 'renal', 'gfr', 'creatinine', 'proteinuria', 'nephrology'],
        recommendation: 'For CKD patients: target BP <120/80 if tolerated (with RAS inhibitor if albuminuria). SGLT2 inhibitors recommended for eGFR ≥20 with albuminuria. Statin therapy for all CKD patients ≥50 years. Referral to nephrology if eGFR <30, rapid decline (>5 mL/min/1.73m²/year), or ACR >300 mg/g.',
        grade: 'Level A (1A)',
        category: 'chronic'
    }
];

// ─── Search Functions ───────────────────────────────────────────────────────

/**
 * Search clinical guidelines by keyword or topic
 * Returns ranked results with relevance scoring
 */
function searchGuidelines(query, category = 'all', maxResults = 5) {
    if (!query) return { results: [], query: '' };

    const lower = query.toLowerCase();
    const queryWords = lower.split(/\s+/).filter(w => w.length > 2);

    const scored = CLINICAL_GUIDELINES
        .filter(g => category === 'all' || g.category === category)
        .map(g => {
            let score = 0;

            // Keyword matching
            for (const kw of g.keywords) {
                if (lower.includes(kw)) score += 3;
                for (const word of queryWords) {
                    if (kw.includes(word) || word.includes(kw)) score += 1;
                }
            }

            // Topic matching
            const topicLower = g.topic.toLowerCase();
            for (const word of queryWords) {
                if (topicLower.includes(word)) score += 2;
            }

            // Source matching
            if (lower.includes(g.source.toLowerCase().split(' ')[0])) score += 2;

            return { ...g, relevance: score };
        })
        .filter(g => g.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, maxResults);

    return {
        query,
        count: scored.length,
        results: scored.map(g => ({
            id: g.id,
            source: g.source,
            year: g.year,
            topic: g.topic,
            recommendation: g.recommendation,
            grade: g.grade,
            category: g.category
        }))
    };
}

/**
 * Get a specific guideline by ID
 */
function getGuideline(id) {
    return CLINICAL_GUIDELINES.find(g => g.id === id) || null;
}

/**
 * Get all guidelines for a specific category
 */
function getByCategory(category) {
    return CLINICAL_GUIDELINES.filter(g => g.category === category);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    CLINICAL_GUIDELINES,
    searchGuidelines,
    getGuideline,
    getByCategory
};
