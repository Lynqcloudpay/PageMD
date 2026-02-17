/**
 * Echo Lab Intelligence Engine (Phase 2B)
 * 
 * Auto-interprets lab results, flags abnormals, identifies trends,
 * and suggests follow-up actions based on clinical guidelines.
 */

// ─── Reference Ranges & Clinical Guidelines ────────────────────────────────

const LAB_GUIDELINES = {
    // ── Metabolic Panel ─────────────────────────────────────────────────
    glucose: {
        name: 'Glucose (Fasting)', unit: 'mg/dL',
        normal: { min: 70, max: 100 },
        borderline: { min: 100, max: 125 },
        critical: { low: 40, high: 400 },
        interpretation: {
            low: 'Hypoglycemia — assess for symptoms (shakiness, confusion, diaphoresis)',
            normal: 'Normal fasting glucose',
            borderline: 'Pre-diabetes range (IFG) — recommend HbA1c, lifestyle counseling',
            high: 'Hyperglycemia — consistent with diabetes. Confirm with HbA1c or repeat fasting glucose',
            critical_low: '⚠️ CRITICAL: Severe hypoglycemia — immediate treatment required',
            critical_high: '⚠️ CRITICAL: Severe hyperglycemia — assess for DKA/HHS'
        },
        followUp: ['HbA1c if borderline/high', 'Repeat fasting glucose in 2 weeks if borderline', 'Lipid panel', 'Renal function']
    },
    hba1c: {
        name: 'Hemoglobin A1c', unit: '%',
        normal: { min: 4.0, max: 5.6 },
        borderline: { min: 5.7, max: 6.4 },
        critical: { low: null, high: 14.0 },
        interpretation: {
            normal: 'Normal glycemic control',
            borderline: 'Pre-diabetes — consider lifestyle modifications, metformin if additional risk factors',
            high: 'Diabetes — at goal if < 7.0% for most adults (ADA). Above goal if ≥ 7.0%',
            critical_high: '⚠️ CRITICAL: Very poor glycemic control — urgent medication adjustment needed'
        },
        followUp: ['Fasting glucose', 'Lipid panel', 'Urine albumin-to-creatinine ratio', 'Eye exam referral if diabetic']
    },

    // ── Lipid Panel ─────────────────────────────────────────────────────
    total_cholesterol: {
        name: 'Total Cholesterol', unit: 'mg/dL',
        normal: { min: 0, max: 200 },
        borderline: { min: 200, max: 239 },
        critical: { low: null, high: 400 },
        interpretation: {
            normal: 'Desirable total cholesterol',
            borderline: 'Borderline high — assess ASCVD risk, lifestyle modifications',
            high: 'High — consider statin therapy based on 10-year ASCVD risk'
        },
        followUp: ['Complete lipid panel', '10-year ASCVD risk calculation', 'LFTs if starting statin']
    },
    ldl: {
        name: 'LDL Cholesterol', unit: 'mg/dL',
        normal: { min: 0, max: 100 },
        borderline: { min: 100, max: 159 },
        critical: { low: null, high: 300 },
        interpretation: {
            normal: 'Optimal LDL (< 70 mg/dL ideal for high-risk patients)',
            borderline: 'Above optimal — lifestyle changes, consider statin',
            high: 'High LDL — strong indication for statin therapy'
        }
    },
    hdl: {
        name: 'HDL Cholesterol', unit: 'mg/dL',
        normal: { min: 40, max: 200 },
        borderline: { min: 35, max: 39 },
        critical: { low: 20, high: null },
        interpretation: {
            low: 'Low HDL — increased cardiovascular risk. Recommend exercise, weight loss',
            normal: 'Acceptable HDL (> 60 mg/dL is protective)',
            borderline: 'Borderline low HDL'
        }
    },
    triglycerides: {
        name: 'Triglycerides', unit: 'mg/dL',
        normal: { min: 0, max: 150 },
        borderline: { min: 150, max: 199 },
        critical: { low: null, high: 500 },
        interpretation: {
            normal: 'Normal triglycerides',
            borderline: 'Borderline high — dietary changes recommended',
            high: 'High triglycerides — assess for secondary causes (diabetes, alcohol, medications)',
            critical_high: '⚠️ CRITICAL: Very high triglycerides — risk of pancreatitis'
        }
    },

    // ── CBC ─────────────────────────────────────────────────────────────
    wbc: {
        name: 'White Blood Cells', unit: 'K/uL',
        normal: { min: 4.5, max: 11.0 },
        borderline: { min: 3.5, max: 4.4 },
        critical: { low: 2.0, high: 30.0 },
        interpretation: {
            low: 'Leukopenia — evaluate for infection risk, medication side effects, bone marrow issues',
            normal: 'Normal WBC count',
            high: 'Leukocytosis — assess for infection, inflammation, stress response, malignancy',
            critical_low: '⚠️ CRITICAL: Severe leukopenia — infection precautions, hematology consult',
            critical_high: '⚠️ CRITICAL: Marked leukocytosis — urgent evaluation for leukemia, severe infection'
        }
    },
    hemoglobin: {
        name: 'Hemoglobin', unit: 'g/dL',
        normal: { min: 12.0, max: 17.5 },
        borderline: { min: 10.0, max: 11.9 },
        critical: { low: 7.0, high: 20.0 },
        interpretation: {
            low: 'Anemia — classify (iron-deficiency, B12/folate, chronic disease). Check iron studies, reticulocyte count',
            normal: 'Normal hemoglobin',
            high: 'Polycythemia — evaluate for dehydration, pulmonary disease, polycythemia vera',
            critical_low: '⚠️ CRITICAL: Severe anemia — consider transfusion',
            critical_high: '⚠️ CRITICAL: Marked polycythemia — risk of thrombosis'
        },
        followUp: ['Iron studies', 'Reticulocyte count', 'B12 and Folate levels', 'Peripheral smear if unexplained']
    },
    hematocrit: {
        name: 'Hematocrit', unit: '%',
        normal: { min: 36.0, max: 50.0 },
        borderline: { min: 30.0, max: 35.9 },
        critical: { low: 20.0, high: 60.0 },
        interpretation: {
            low: 'Low hematocrit — consistent with anemia',
            normal: 'Normal hematocrit',
            high: 'Elevated hematocrit — evaluate for dehydration or polycythemia'
        }
    },
    platelets: {
        name: 'Platelets', unit: 'K/uL',
        normal: { min: 150, max: 400 },
        borderline: { min: 100, max: 149 },
        critical: { low: 50, high: 1000 },
        interpretation: {
            low: 'Thrombocytopenia — assess for bleeding risk, medications, infection',
            normal: 'Normal platelet count',
            high: 'Thrombocytosis — reactive vs primary. Check iron, inflammatory markers',
            critical_low: '⚠️ CRITICAL: Severe thrombocytopenia — bleeding precautions, hematology consult',
            critical_high: '⚠️ CRITICAL: Marked thrombocytosis — risk of thrombosis'
        }
    },

    // ── Renal Function ──────────────────────────────────────────────────
    creatinine: {
        name: 'Creatinine', unit: 'mg/dL',
        normal: { min: 0.6, max: 1.2 },
        borderline: { min: 1.3, max: 1.9 },
        critical: { low: null, high: 10.0 },
        interpretation: {
            normal: 'Normal renal function',
            borderline: 'Mildly elevated — calculate GFR, assess kidney disease stage',
            high: 'Elevated creatinine — chronic kidney disease likely. Stage by GFR',
            critical_high: '⚠️ CRITICAL: Significantly elevated — assess for acute kidney injury, nephrology consult'
        },
        followUp: ['GFR calculation', 'Urine albumin-to-creatinine ratio', 'BMP', 'Renal ultrasound if new elevation']
    },
    bun: {
        name: 'BUN', unit: 'mg/dL',
        normal: { min: 7, max: 20 },
        borderline: { min: 21, max: 30 },
        critical: { low: null, high: 100 },
        interpretation: {
            normal: 'Normal BUN',
            high: 'Elevated BUN — assess for dehydration, renal dysfunction, GI bleeding'
        }
    },
    gfr: {
        name: 'eGFR', unit: 'mL/min/1.73m2',
        normal: { min: 90, max: 200 },
        borderline: { min: 60, max: 89 },
        critical: { low: 15, high: null },
        interpretation: {
            normal: 'Normal kidney function (Stage 1)',
            borderline: 'Mildly decreased GFR (Stage 2) — monitor annually',
            low: 'Moderately decreased GFR (Stage 3) — nephrology referral recommended',
            critical_low: '⚠️ CRITICAL: Severely decreased GFR (Stage 4/5) — urgent nephrology referral'
        }
    },

    // ── Liver Function ──────────────────────────────────────────────────
    alt: {
        name: 'ALT (SGPT)', unit: 'U/L',
        normal: { min: 0, max: 40 },
        borderline: { min: 41, max: 80 },
        critical: { low: null, high: 1000 },
        interpretation: {
            normal: 'Normal ALT',
            borderline: 'Mildly elevated — assess for medications, NAFLD, alcohol use',
            high: 'Significantly elevated — evaluate for hepatitis, drug-induced liver injury',
            critical_high: '⚠️ CRITICAL: Markedly elevated ALT — acute hepatocellular injury'
        }
    },
    ast: {
        name: 'AST (SGOT)', unit: 'U/L',
        normal: { min: 0, max: 40 },
        borderline: { min: 41, max: 80 },
        critical: { low: null, high: 1000 },
        interpretation: {
            normal: 'Normal AST',
            high: 'Elevated AST — liver, cardiac, or muscle origin'
        }
    },
    alkaline_phosphatase: {
        name: 'Alkaline Phosphatase', unit: 'U/L',
        normal: { min: 44, max: 147 },
        borderline: { min: 148, max: 300 },
        critical: { low: null, high: 1000 },
        interpretation: {
            normal: 'Normal alkaline phosphatase',
            high: 'Elevated — assess for biliary obstruction, bone disease'
        }
    },
    bilirubin: {
        name: 'Total Bilirubin', unit: 'mg/dL',
        normal: { min: 0.1, max: 1.2 },
        borderline: { min: 1.3, max: 2.0 },
        critical: { low: null, high: 15.0 },
        interpretation: {
            normal: 'Normal bilirubin',
            high: 'Hyperbilirubinemia — evaluate for hemolysis, liver disease, biliary obstruction'
        }
    },

    // ── Thyroid ──────────────────────────────────────────────────────────
    tsh: {
        name: 'TSH', unit: 'mIU/L',
        normal: { min: 0.4, max: 4.0 },
        borderline: { min: 4.1, max: 10.0 },
        critical: { low: 0.01, high: 100 },
        interpretation: {
            low: 'Low TSH — hyperthyroidism. Check Free T4, Free T3',
            normal: 'Normal thyroid function',
            borderline: 'Subclinical hypothyroidism — consider treatment if symptomatic or TSH > 10',
            high: 'Elevated TSH — hypothyroidism. Start levothyroxine',
            critical_low: '⚠️ CRITICAL: Severely suppressed TSH — thyrotoxicosis, urgent evaluation'
        },
        followUp: ['Free T4', 'Free T3 if TSH suppressed', 'TPO antibodies if new hypothyroidism']
    },

    // ── Electrolytes ────────────────────────────────────────────────────
    sodium: {
        name: 'Sodium', unit: 'mEq/L',
        normal: { min: 136, max: 145 },
        borderline: { min: 133, max: 135 },
        critical: { low: 120, high: 160 },
        interpretation: {
            low: 'Hyponatremia — assess volume status, medications (diuretics, SSRIs)',
            normal: 'Normal sodium',
            high: 'Hypernatremia — usually dehydration. Assess fluid intake',
            critical_low: '⚠️ CRITICAL: Severe hyponatremia — risk of seizures, cerebral edema',
            critical_high: '⚠️ CRITICAL: Severe hypernatremia — aggressive fluid resuscitation'
        }
    },
    potassium: {
        name: 'Potassium', unit: 'mEq/L',
        normal: { min: 3.5, max: 5.0 },
        borderline: { min: 3.0, max: 3.4 },
        critical: { low: 2.5, high: 6.5 },
        interpretation: {
            low: 'Hypokalemia — supplement, check magnesium. Monitor with diuretics/laxatives',
            normal: 'Normal potassium',
            high: 'Hyperkalemia — rule out hemolysis artifact. Check EKG if > 5.5',
            critical_low: '⚠️ CRITICAL: Severe hypokalemia — cardiac arrhythmia risk, IV replacement',
            critical_high: '⚠️ CRITICAL: Severe hyperkalemia — EKG immediately, emergent treatment'
        }
    },
    calcium: {
        name: 'Calcium', unit: 'mg/dL',
        normal: { min: 8.5, max: 10.5 },
        borderline: { min: 10.6, max: 11.5 },
        critical: { low: 6.0, high: 14.0 },
        interpretation: {
            low: 'Hypocalcemia — check albumin (corrected calcium), PTH, vitamin D',
            normal: 'Normal calcium',
            high: 'Hypercalcemia — evaluate for hyperparathyroidism, malignancy'
        }
    },

    // ── Urinalysis ──────────────────────────────────────────────────────
    urinary_protein: {
        name: 'Urine Protein', unit: 'mg/dL',
        normal: { min: 0, max: 15 },
        borderline: { min: 15, max: 30 },
        critical: { low: null, high: 500 },
        interpretation: {
            normal: 'No significant proteinuria',
            high: 'Proteinuria — quantify with albumin-to-creatinine ratio, assess renal function'
        }
    },

    // ── Inflammatory Markers ────────────────────────────────────────────
    crp: {
        name: 'C-Reactive Protein', unit: 'mg/L',
        normal: { min: 0, max: 3.0 },
        borderline: { min: 3.1, max: 10.0 },
        critical: { low: null, high: 200 },
        interpretation: {
            normal: 'No significant inflammation',
            borderline: 'Mild elevation — chronic inflammation, infection, cardiovascular risk',
            high: 'Elevated CRP — assess for infection, autoimmune disease'
        }
    },
    esr: {
        name: 'Erythrocyte Sedimentation Rate', unit: 'mm/hr',
        normal: { min: 0, max: 20 },
        borderline: { min: 21, max: 40 },
        critical: { low: null, high: 100 },
        interpretation: {
            normal: 'Normal ESR',
            high: 'Elevated ESR — nonspecific marker of inflammation'
        }
    },

    // ── Vitamin/Mineral ─────────────────────────────────────────────────
    vitamin_d: {
        name: 'Vitamin D (25-OH)', unit: 'ng/mL',
        normal: { min: 30, max: 100 },
        borderline: { min: 20, max: 29 },
        critical: { low: 10, high: 150 },
        interpretation: {
            low: 'Vitamin D deficiency — supplement with D3. Check calcium, PTH',
            normal: 'Sufficient vitamin D',
            borderline: 'Insufficiency — consider supplementation',
            critical_low: '⚠️ Severe vitamin D deficiency — high-dose repletion protocol'
        }
    },
    b12: {
        name: 'Vitamin B12', unit: 'pg/mL',
        normal: { min: 200, max: 900 },
        borderline: { min: 150, max: 199 },
        critical: { low: 100, high: null },
        interpretation: {
            low: 'B12 deficiency — supplement. Check methylmalonic acid, homocysteine for confirmation',
            normal: 'Normal B12',
            borderline: 'Borderline low B12 — check methylmalonic acid'
        }
    },
    iron: {
        name: 'Serum Iron', unit: 'mcg/dL',
        normal: { min: 60, max: 170 },
        borderline: { min: 40, max: 59 },
        critical: { low: 20, high: 400 },
        interpretation: {
            low: 'Low iron — iron deficiency. Check ferritin, TIBC, transferrin saturation',
            normal: 'Normal iron',
            high: 'Elevated iron — evaluate for hemochromatosis, iron overload'
        }
    },
    ferritin: {
        name: 'Ferritin', unit: 'ng/mL',
        normal: { min: 20, max: 200 },
        borderline: { min: 10, max: 19 },
        critical: { low: 5, high: 1000 },
        interpretation: {
            low: 'Low ferritin — iron deficiency confirmed. Supplement iron',
            normal: 'Normal iron stores',
            high: 'Elevated ferritin — acute phase reactant or iron overload. Check iron saturation'
        }
    },

    // ── Screening & Specialty ───────────────────────────────────────────
    psa: {
        name: 'Prostate Specific Antigen', unit: 'ng/mL',
        normal: { min: 0, max: 4.0 },
        borderline: { min: 4.0, max: 10.0 },
        critical: { low: null, high: 20.0 },
        interpretation: {
            normal: 'Normal PSA for age-appropriate screening',
            borderline: 'Mildly elevated — consider urology referral, repeat in 6 months, or check free PSA',
            high: 'Elevated PSA — urology referral recommended for further evaluation',
            critical_high: '⚠️ CRITICAL: Markedly elevated — high suspicion for malignancy'
        },
        followUp: ['Free PSA', 'Urology referral', 'Repeat PSA in 3-6 months']
    },
    microalbumin_urine: {
        name: 'Microalbumin/Creatinine Ratio', unit: 'mg/g',
        normal: { min: 0, max: 30 },
        borderline: { min: 30, max: 299 },
        critical: { low: null, high: 300 },
        interpretation: {
            normal: 'Normal albumin excretion',
            borderline: 'Microalbuminuria — early sign of diabetic nephropathy. Optmize BP and glucose',
            high: 'Macroalbuminuria — significant renal protein loss. Consider ACEi/ARB if not already on'
        },
        followUp: ['Repeat in 3 months', 'BP optimization', 'HbA1c optimization']
    },
    ua_leukocytes: {
        name: 'UA: Leukocyte Esterase', unit: '',
        normal: { min: 0, max: 0 },
        borderline: { min: 1, max: 1 }, // 1 = Trace
        critical: { low: null, high: 3 }, // 3 = Large
        interpretation: {
            normal: 'Negative for leukocyte esterase',
            borderline: 'Trace leukocytes — non-specific, correlate clinically',
            high: 'Positive for leukocytes — suggests pyuria/UTI'
        },
        followUp: ['Urine culture if symptomatic', 'Microscopic UA']
    },
    ua_nitrite: {
        name: 'UA: Nitrite', unit: '',
        normal: { min: 0, max: 0 },
        interpretation: {
            normal: 'Negative for nitrites',
            high: 'Positive for nitrites — strongly suggests Enterobacteriaceae (UTI)'
        }
    }
};

// ─── Nickname-to-Guideline Mapping ──────────────────────────────────────────

const LAB_ALIASES = {
    // Glucose
    'fasting glucose': 'glucose', 'blood sugar': 'glucose', 'fbs': 'glucose', 'fbg': 'glucose',
    'glucose fasting': 'glucose', 'blood glucose': 'glucose',
    'a1c': 'hba1c', 'hemoglobin a1c': 'hba1c', 'glycohemoglobin': 'hba1c', 'hgba1c': 'hba1c',
    // Lipids
    'cholesterol': 'total_cholesterol', 'total cholesterol': 'total_cholesterol', 'chol': 'total_cholesterol',
    'ldl cholesterol': 'ldl', 'ldl-c': 'ldl', 'low density lipoprotein': 'ldl',
    'hdl cholesterol': 'hdl', 'hdl-c': 'hdl', 'high density lipoprotein': 'hdl',
    'trig': 'triglycerides', 'trigs': 'triglycerides',
    // CBC
    'white blood cells': 'wbc', 'white count': 'wbc', 'leukocytes': 'wbc',
    'hgb': 'hemoglobin', 'hb': 'hemoglobin',
    'hct': 'hematocrit',
    'plt': 'platelets', 'platelet count': 'platelets',
    // Renal
    'cr': 'creatinine', 'serum creatinine': 'creatinine',
    'blood urea nitrogen': 'bun', 'urea': 'bun',
    'estimated gfr': 'gfr', 'egfr': 'gfr', 'glomerular filtration rate': 'gfr',
    // Liver
    'sgpt': 'alt', 'alanine aminotransferase': 'alt', 'alanine transaminase': 'alt',
    'sgot': 'ast', 'aspartate aminotransferase': 'ast', 'aspartate transaminase': 'ast',
    'alk phos': 'alkaline_phosphatase', 'alp': 'alkaline_phosphatase',
    'total bilirubin': 'bilirubin', 'tbili': 'bilirubin',
    // Thyroid
    'thyroid stimulating hormone': 'tsh',
    // Electrolytes
    'na': 'sodium', 'na+': 'sodium',
    'k': 'potassium', 'k+': 'potassium',
    'ca': 'calcium', 'ca++': 'calcium',
    // Inflammatory
    'c-reactive protein': 'crp', 'hs-crp': 'crp', 'high sensitivity crp': 'crp',
    'sed rate': 'esr', 'sedimentation rate': 'esr',
    // Vitamins
    '25-oh vitamin d': 'vitamin_d', 'vit d': 'vitamin_d', '25-hydroxy': 'vitamin_d',
    'vitamin b12': 'b12', 'cobalamin': 'b12',
    'serum iron': 'iron', 'fe': 'iron',
    // Specialty
    'prostate antigen': 'psa', 'psa level': 'psa',
    'microalbumin': 'microalbumin_urine', 'uacr': 'microalbumin_urine', 'urine albumin': 'microalbumin_urine',
    'leukocyte esterase': 'ua_leukocytes', 'ua leukocytes': 'ua_leukocytes',
    'nitrite': 'ua_nitrite', 'ua nitrite': 'ua_nitrite'
};

// ─── Core Functions ─────────────────────────────────────────────────────────

function resolveTestKey(testName) {
    if (!testName) return null;
    const lower = testName.toLowerCase().trim();

    // Direct match
    if (LAB_GUIDELINES[lower]) return lower;

    // Alias match
    if (LAB_ALIASES[lower]) return LAB_ALIASES[lower];

    // Fuzzy match
    for (const [alias, key] of Object.entries(LAB_ALIASES)) {
        if (lower.includes(alias) || alias.includes(lower)) return key;
    }
    for (const key of Object.keys(LAB_GUIDELINES)) {
        if (lower.includes(key) || key.includes(lower)) return key;
    }

    return null;
}

function interpretValue(testKey, value) {
    const guideline = LAB_GUIDELINES[testKey];
    if (!guideline) return { status: 'unknown', message: 'No reference range available for this test' };

    const numVal = parseFloat(value);
    if (isNaN(numVal)) return { status: 'non_numeric', message: `Value "${value}" cannot be interpreted numerically` };

    let status = 'normal';
    let severity = 'normal';
    let message = guideline.interpretation?.normal || 'Within normal limits';

    // Critical ranges first
    if (guideline.critical?.low != null && numVal <= guideline.critical.low) {
        status = 'critical_low';
        severity = 'critical';
        message = guideline.interpretation?.critical_low || `Critically low ${guideline.name}`;
    } else if (guideline.critical?.high != null && numVal >= guideline.critical.high) {
        status = 'critical_high';
        severity = 'critical';
        message = guideline.interpretation?.critical_high || `Critically high ${guideline.name}`;
    }
    // Then abnormal
    else if (numVal < guideline.normal.min) {
        if (guideline.borderline && numVal >= guideline.borderline.min) {
            status = 'borderline_low';
            severity = 'moderate';
            message = guideline.interpretation?.borderline || `Borderline low ${guideline.name}`;
        } else {
            status = 'low';
            severity = 'high';
            message = guideline.interpretation?.low || `Low ${guideline.name}`;
        }
    } else if (numVal > guideline.normal.max) {
        if (guideline.borderline && numVal <= guideline.borderline.max) {
            status = 'borderline_high';
            severity = 'moderate';
            message = guideline.interpretation?.borderline || `Borderline high ${guideline.name}`;
        } else {
            status = 'high';
            severity = 'high';
            message = guideline.interpretation?.high || `Elevated ${guideline.name}`;
        }
    }

    return {
        testName: guideline.name,
        value: numVal,
        unit: guideline.unit,
        status,
        severity,
        message,
        normalRange: `${guideline.normal.min}–${guideline.normal.max} ${guideline.unit}`,
        followUp: guideline.followUp || [],
        delta: null // Will be populated when comparing trends
    };
}

/**
 * Interpret a full lab panel from an order record
 */
function interpretLabPanel(order) {
    const results = [];

    // Check top-level result_value + test_name
    if (order.test_name && order.result_value) {
        const testKey = resolveTestKey(order.test_name);
        if (testKey) {
            const interp = interpretValue(testKey, order.result_value);
            interp.rawTestName = order.test_name;
            results.push(interp);
        } else {
            results.push({
                rawTestName: order.test_name,
                value: order.result_value,
                unit: order.result_units || '',
                status: 'unmatched',
                severity: 'unknown',
                message: `No guideline match for "${order.test_name}"`,
                normalRange: order.reference_range || 'N/A',
                followUp: []
            });
        }
    }

    // Check order_payload.results array
    const payload = typeof order.order_payload === 'string'
        ? JSON.parse(order.order_payload || '{}')
        : (order.order_payload || {});

    if (Array.isArray(payload.results)) {
        for (const r of payload.results) {
            const name = r.test || r.name || r.testName;
            const val = r.value || r.result;
            if (!name || val == null) continue;

            const testKey = resolveTestKey(name);
            if (testKey) {
                const interp = interpretValue(testKey, val);
                interp.rawTestName = name;
                results.push(interp);
            } else {
                results.push({
                    rawTestName: name,
                    value: val,
                    unit: r.unit || '',
                    status: r.flag ? (r.flag.toLowerCase() === 'normal' ? 'normal' : 'abnormal') : 'unknown',
                    severity: r.flag && r.flag.toLowerCase() !== 'normal' ? 'moderate' : 'normal',
                    message: r.flag ? `Flag: ${r.flag}` : `Result: ${val} ${r.unit || ''}`,
                    normalRange: r.referenceRange || r.reference_range || 'N/A',
                    followUp: []
                });
            }
        }
    }

    return results;
}

/**
 * Analyze all labs for a patient and generate a comprehensive report
 */
function analyzePatientLabs(orders) {
    if (!orders?.length) return { summary: 'No lab results found.', results: [], abnormals: [], criticals: [] };

    const allResults = [];
    const abnormals = [];
    const criticals = [];

    for (const order of orders) {
        const interpretations = interpretLabPanel(order);
        for (const interp of interpretations) {
            interp.orderDate = order.created_at;
            interp.orderId = order.id;
            allResults.push(interp);

            if (interp.severity === 'critical') criticals.push(interp);
            else if (interp.severity === 'high' || interp.severity === 'moderate') abnormals.push(interp);
        }
    }

    // Group by test for trend detection
    const byTest = {};
    for (const r of allResults) {
        const key = r.testName || r.rawTestName;
        if (!byTest[key]) byTest[key] = [];
        byTest[key].push(r);
    }

    // Detect trends
    const trends = [];
    for (const [testName, results] of Object.entries(byTest)) {
        if (results.length < 2) continue;
        const sorted = results
            .filter(r => typeof r.value === 'number')
            .sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));

        if (sorted.length < 2) continue;

        const first = sorted[0].value;
        const last = sorted[sorted.length - 1].value;
        const pctChange = ((last - first) / first) * 100;
        const direction = pctChange > 5 ? 'rising' : pctChange < -5 ? 'falling' : 'stable';

        trends.push({
            testName,
            direction,
            percentChange: Math.round(pctChange * 10) / 10,
            firstValue: first,
            lastValue: last,
            dataPoints: sorted.length,
            period: `${new Date(sorted[0].orderDate).toLocaleDateString()} → ${new Date(sorted[sorted.length - 1].orderDate).toLocaleDateString()}`
        });
    }

    // Build summary
    const parts = [];
    if (criticals.length > 0) {
        parts.push(`🔴 **${criticals.length} CRITICAL** result(s) requiring immediate attention`);
    }
    if (abnormals.length > 0) {
        parts.push(`🟡 **${abnormals.length} abnormal** result(s) flagged`);
    }
    const normalCount = allResults.length - criticals.length - abnormals.length;
    if (normalCount > 0) {
        parts.push(`🟢 **${normalCount}** result(s) within normal limits`);
    }
    if (trends.length > 0) {
        const concerning = trends.filter(t => t.direction !== 'stable');
        if (concerning.length > 0) {
            parts.push(`📈 **${concerning.length}** trend(s) detected`);
        }
    }

    return {
        summary: parts.join('\n'),
        totalResults: allResults.length,
        results: allResults,
        abnormals,
        criticals,
        trends
    };
}

/**
 * Get a focused interpretation for a specific test
 */
function interpretSpecificTest(testName, value) {
    const testKey = resolveTestKey(testName);
    if (!testKey) {
        return {
            success: false,
            message: `No reference guidelines found for "${testName}". Available tests include: ${Object.keys(LAB_GUIDELINES).slice(0, 10).join(', ')}...`
        };
    }

    const interp = interpretValue(testKey, value);
    interp.rawTestName = testName;
    return { success: true, ...interp };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    LAB_GUIDELINES,
    LAB_ALIASES,
    resolveTestKey,
    interpretValue,
    interpretLabPanel,
    analyzePatientLabs,
    interpretSpecificTest
};
