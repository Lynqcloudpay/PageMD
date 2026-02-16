/**
 * Echo Clinical Decision Support (CDS) Engine
 * 
 * Provides rule-based clinical intelligence for preventive care,
 * chronic disease management, and evidence-based alerts.
 */

const USPSTF_GUIDELINES = [
    {
        id: 'breast_cancer_screening',
        name: 'Mammogram',
        description: 'Screening mammography for women',
        ageMin: 40,
        ageMax: 74,
        sex: 'female',
        frequencyYears: 2,
        guideline: 'USPSTF Grade B (2024)'
    },
    {
        id: 'colorectal_screening',
        name: 'Colonoscopy / FIT',
        description: 'Colorectal cancer screening',
        ageMin: 45,
        ageMax: 75,
        frequencyYears: 10,
        guideline: 'USPSTF Grade A (2021)'
    },
    {
        id: 'lung_cancer_screening',
        name: 'LDCT Lung Screen',
        description: 'Annual screening for lung cancer with LDCT in high-risk adults',
        ageMin: 50,
        ageMax: 80,
        requiresRiskFactor: 'smoking_history',
        frequencyYears: 1,
        guideline: 'USPSTF Grade B (2021)'
    },
    {
        id: 'cervical_cancer_screening',
        name: 'Pap / HPV Test',
        description: 'Screening for cervical cancer',
        ageMin: 21,
        ageMax: 65,
        sex: 'female',
        frequencyYears: 3,
        guideline: 'USPSTF Grade A (2018)'
    },
    {
        id: 'osteoporosis_screening',
        name: 'DEXA Scan',
        description: 'Screening for osteoporosis',
        ageMin: 65,
        sex: 'female',
        frequencyYears: 5,
        guideline: 'USPSTF Grade B (2018)'
    },
    {
        id: 'aaa_screening',
        name: 'AAA Ultrasound',
        description: 'One-time screening for Abdominal Aortic Aneurysm',
        ageMin: 65,
        ageMax: 75,
        sex: 'male',
        requiresRiskFactor: 'smoking_history',
        frequencyYears: 50, // One-time
        guideline: 'USPSTF Grade B (2019)'
    },
    {
        id: 'hiv_screening',
        name: 'HIV Screen',
        description: 'Routine screening for HIV infection',
        ageMin: 15,
        ageMax: 65,
        frequencyYears: 50, // One-time for routine
        guideline: 'USPSTF Grade A (2019)'
    }
];

const CHRONIC_DISEASE_MEASURES = [
    {
        id: 'diabetes_a1c',
        name: 'HbA1c Monitoring',
        conditionKeywords: ['diabetes', 'dm2', 'dm1'],
        frequencyMonths: 6,
        labKey: 'a1c'
    },
    {
        id: 'diabetes_eye_exam',
        name: 'Diabetic Retinal Exam',
        conditionKeywords: ['diabetes', 'dm2', 'dm1'],
        frequencyYears: 1,
        orderType: 'referral'
    }
];

// --- Drug-Drug Interaction manifested rules ---
const INTERACTION_PAIRS = [
    {
        med1: ['warfarin', 'coumadin', 'eliquis', 'xarelto'],
        med2: ['aspirin', 'ibuprofen', 'naproxen', 'advil', 'motrin', 'diclofenac'],
        severity: 'high',
        message: 'Increased bleeding risk. Combining anticoagulants with NSAIDs requires careful monitoring.',
        risk: 'Bleeding Risk'
    },
    {
        med1: ['lisinopril', 'losartan', 'valsartan', 'enalapril', 'ramipril'],
        med2: ['spironolactone', 'eplerenone'],
        severity: 'medium',
        message: 'Hyperkalemia risk. Monitor serum potassium closely when combining ACE/ARB with K-sparing diuretics.',
        risk: 'Potassium Elevation'
    },
    {
        med1: ['simvastatin', 'atorvastatin', 'rosuvastatin'],
        med2: ['gemfibrozil', 'clarithromycin', 'ketoconazole'],
        severity: 'medium',
        message: 'Increased myopathy/rhabdomyolysis risk. Review statin dose or switch medications.',
        risk: 'Muscle Damage'
    },
    {
        med1: ['fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'lexapro', 'zoloft'],
        med2: ['tramadol', 'sumatriptan', 'st. john\'s wort'],
        severity: 'high',
        message: 'Serotonin Syndrome risk. Monitor for agitation, fever, or tremors.',
        risk: 'Serotonin Syndrome'
    },
    {
        med1: ['metformin'],
        med2: ['contrast', 'iodinated dye'],
        severity: 'medium',
        message: 'Lactic acidosis risk. Hold metformin before and for 48 hours after contrast imaging.',
        risk: 'Lactic Acidosis'
    }
];

/**
 * Analyze clinical gaps based on patient context
 */
async function analyzeClinicalGaps(patientContext) {
    if (!patientContext || !patientContext.demographics) return { gaps: [] };

    const gaps = [];
    const d = patientContext.demographics;
    const age = calculateAge(d.dob);
    const sex = d.sex?.toLowerCase();

    // 1. USPSTF Preventive Gaps
    for (const rule of USPSTF_GUIDELINES) {
        // Sex check
        if (rule.sex && sex && rule.sex !== sex) continue;

        // Age check
        if (rule.ageMin && age < rule.ageMin) continue;
        if (rule.ageMax && age > rule.ageMax) continue;

        // Check for risk factors (e.g. smoking)
        if (rule.requiresRiskFactor === 'smoking_history') {
            const history = patientContext.socialHistory?.smoking_status?.toLowerCase() || '';
            const isSmoker = history.includes('former') || history.includes('current');
            if (!isSmoker) continue;
        }

        // Logic to check if already done (simplified for now: check recent orders/visits)
        const lastPerformed = findLastPerformedDate(rule.id, patientContext);

        if (!lastPerformed) {
            gaps.push({
                type: 'preventive',
                id: rule.id,
                name: rule.name,
                severity: 'medium',
                message: `Recommended ${rule.name} (Age ${age} ${sex || 'patient'}). ${rule.guideline}.`,
                guideline: rule.guideline
            });
        } else {
            const yearsSince = (new Date() - new Date(lastPerformed)) / (1000 * 60 * 60 * 24 * 365.25);
            if (yearsSince >= rule.frequencyYears) {
                gaps.push({
                    type: 'preventive',
                    id: rule.id,
                    name: rule.name,
                    severity: 'medium',
                    message: `Overdue for ${rule.name} (Last: ${new Date(lastPerformed).toLocaleDateString()}).`,
                    guideline: rule.guideline
                });
            }
        }
    }

    // 2. Chronic Disease Gaps
    const problems = (patientContext.problems || []).map(p => (p.problem_name || '').toLowerCase());
    for (const measure of CHRONIC_DISEASE_MEASURES) {
        const hasCondition = measure.conditionKeywords.some(kw =>
            problems.some(p => p.includes(kw))
        );

        if (hasCondition) {
            const lastData = findLastData(measure, patientContext);
            if (!lastData) {
                gaps.push({
                    type: 'chronic',
                    id: measure.id,
                    name: measure.name,
                    severity: 'high',
                    message: `Missing ${measure.name} for chronic condition (Diabetes).`
                });
            } else {
                const monthsSince = (new Date() - new Date(lastData)) / (1000 * 60 * 60 * 24 * 30.44);
                if (measure.frequencyMonths && monthsSince >= measure.frequencyMonths) {
                    gaps.push({
                        type: 'chronic',
                        id: measure.id,
                        name: measure.name,
                        severity: 'high',
                        message: `Overdue for ${measure.name} (Last: ${new Date(lastData).toLocaleDateString()}).`
                    });
                } else if (measure.frequencyYears && monthsSince >= (measure.frequencyYears * 12)) {
                    gaps.push({
                        type: 'chronic',
                        id: measure.id,
                        name: measure.name,
                        severity: 'high',
                        message: `Overdue for ${measure.name} (Last: ${new Date(lastData).toLocaleDateString()}).`
                    });
                }
            }
        }
    }

    return {
        summary: gaps.length > 0 ? `Identified ${gaps.length} clinical gaps.` : 'No critical clinical gaps identified.',
        gaps,
        count: gaps.length
    };
}

function findLastPerformedDate(ruleId, context) {
    // Check orders
    const orders = context.activeOrders || [];
    const matches = orders.filter(o => {
        const name = (o.test_name || o.order_payload?.test_name || '').toLowerCase();
        if (ruleId === 'breast_cancer_screening') return name.includes('mammogram');
        if (ruleId === 'colorectal_screening') return name.includes('colonoscopy') || name.includes('fit test');
        if (ruleId === 'lung_cancer_screening') return name.includes('ldct') || name.includes('lung screen');
        if (ruleId === 'cervical_cancer_screening') return name.includes('pap') || name.includes('hpv');
        if (ruleId === 'osteoporosis_screening') return name.includes('dexa') || name.includes('bone density');
        if (ruleId === 'aaa_screening') return name.includes('aaa') || name.includes('abdominal aortic');
        if (ruleId === 'hiv_screening') return name.includes('hiv');
        return false;
    });

    if (matches.length > 0) {
        const sorted = matches.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
        return sorted[0].created_at || sorted[0].date;
    }

    return null;
}

function findLastData(measure, context) {
    if (measure.labKey) {
        const results = context.labs || []; // Assuming labs added to context
        const labs = results.filter(l => (l.test_name || '').toLowerCase().includes(measure.labKey));
        if (labs.length > 0) return labs[0].date || labs[0].created_at;
    }

    // Check orders for referrals
    if (measure.orderType === 'referral') {
        const orders = context.activeOrders || [];
        const matches = orders.filter(o =>
            o.order_type === 'referral' &&
            (o.test_name || '').toLowerCase().includes('eye exam')
        );
        if (matches.length > 0) return matches[0].created_at;
    }

    return null;
}

function calculateAge(dob) {
    if (!dob) return 0;
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
    return age;
}

/**
 * Check for interactions between a new medication and existing list
 */
function checkMedicationInteractions(newMedName, currentMeds = []) {
    if (!newMedName) return null;

    const newMed = newMedName.toLowerCase();
    const activeMeds = currentMeds.map(m => (m.medication_name || '').toLowerCase());

    for (const rule of INTERACTION_PAIRS) {
        const isNewMedInGroup1 = rule.med1.some(m => newMed.includes(m));
        const isNewMedInGroup2 = rule.med2.some(m => newMed.includes(m));

        if (isNewMedInGroup1 || isNewMedInGroup2) {
            const groupToCheck = isNewMedInGroup1 ? rule.med2 : rule.med1;
            const interactionFound = groupToCheck.filter(m => activeMeds.some(am => am.includes(m)));

            if (interactionFound.length > 0) {
                return {
                    severity: rule.severity,
                    risk: rule.risk,
                    message: rule.message,
                    interactsWith: interactionFound[0]
                };
            }
        }
    }

    return null;
}

module.exports = {
    analyzeClinicalGaps,
    checkMedicationInteractions
};
