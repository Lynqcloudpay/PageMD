/**
 * Echo Clinical Score Engine (Phase 5)
 * 
 * Implements standardized clinical risk models:
 * - ASCVD (10-Year Cardiovascular Risk) — ACC/AHA 2013 Pooled Cohort Equations
 * - CHA2DS2-VASc (Stroke risk in Atrial Fibrillation)
 * - MELD 3.0 (End-stage Liver Disease)
 * 
 * Phase 5: All scores are calculated on-demand when explicitly requested,
 * regardless of whether the patient has qualifying conditions.
 * Missing data is filled with defaults and flagged as assumptions.
 */

// ─── ASCVD Pooled Cohort Equations (ACC/AHA 2013) ───────────────────────────

function calculateASCVD(params) {
    const { age, totalChol, hdl, sbp, isSmoker, isDiabetic, isMale, isWhite, treatsBP } = params;

    let score = 0;
    let baselineSurvival;

    if (isMale) {
        if (isWhite) {
            // White Male coefficients
            const lnAge = Math.log(age);
            const lnTC = Math.log(totalChol);
            const lnHDL = Math.log(hdl);
            const lnSBP = Math.log(sbp);
            score = 12.344 * lnAge + 11.853 * lnTC - 2.664 * (lnAge * lnTC) -
                7.990 * lnHDL + 1.769 * (lnAge * lnHDL) +
                (treatsBP ? 1.797 * lnSBP : 1.764 * lnSBP) +
                (isSmoker ? 7.837 - 1.795 * lnAge : 0) +
                (isDiabetic ? 0.658 : 0);
            baselineSurvival = 0.9144;
            score = 1 - Math.pow(baselineSurvival, Math.exp(score - 61.18));
        } else {
            // African-American Male coefficients
            const lnAge = Math.log(age);
            const lnTC = Math.log(totalChol);
            const lnHDL = Math.log(hdl);
            const lnSBP = Math.log(sbp);
            score = 2.469 * lnAge + 0.302 * lnTC - 0.307 * lnHDL +
                (treatsBP ? 1.916 * lnSBP : 1.809 * lnSBP) +
                (isSmoker ? 0.549 : 0) +
                (isDiabetic ? 0.645 : 0);
            baselineSurvival = 0.8954;
            score = 1 - Math.pow(baselineSurvival, Math.exp(score - 19.54));
        }
    } else {
        if (isWhite) {
            // White Female coefficients
            const lnAge = Math.log(age);
            const lnTC = Math.log(totalChol);
            const lnHDL = Math.log(hdl);
            const lnSBP = Math.log(sbp);
            score = -29.799 * lnAge + 4.884 * (lnAge * lnAge) +
                13.540 * lnTC - 3.114 * (lnAge * lnTC) -
                13.578 * lnHDL + 3.149 * (lnAge * lnHDL) +
                (treatsBP ? 2.019 * lnSBP : 1.957 * lnSBP) +
                (isSmoker ? 7.574 - 1.665 * lnAge : 0) +
                (isDiabetic ? 0.661 : 0);
            baselineSurvival = 0.9665;
            score = 1 - Math.pow(baselineSurvival, Math.exp(score + 29.18));
        } else {
            // African-American Female coefficients
            const lnAge = Math.log(age);
            const lnTC = Math.log(totalChol);
            const lnHDL = Math.log(hdl);
            const lnSBP = Math.log(sbp);
            score = 17.114 * lnAge + 0.940 * lnTC - 18.920 * lnHDL +
                4.475 * (lnAge * lnHDL) +
                (treatsBP ? 29.291 * lnSBP - 6.432 * (lnAge * lnSBP) : 27.820 * lnSBP - 6.087 * (lnAge * lnSBP)) +
                (isSmoker ? 0.691 : 0) +
                (isDiabetic ? 0.874 : 0);
            baselineSurvival = 0.9533;
            score = 1 - Math.pow(baselineSurvival, Math.exp(score - 86.61));
        }
    }

    const result = Math.min(100, Math.max(0, score * 100));

    return {
        score: Math.round(result * 10) / 10,
        unit: '%',
        level: result < 5 ? 'low' : result < 7.5 ? 'borderline' : result < 20 ? 'intermediate' : 'high',
        interpretation: `10-year ASCVD risk: ${Math.round(result * 10) / 10}%`,
        recommendation: result >= 20 ? 'High-intensity statin therapy recommended (ACC/AHA).'
            : result >= 7.5 ? 'Moderate-to-high intensity statin therapy recommended (ACC/AHA).'
                : result >= 5 ? 'Statin therapy may be considered with risk-enhancing factors.'
                    : 'Lifestyle modifications recommended. Reassess in 5 years.'
    };
}

// ─── CHA2DS2-VASc (Stroke Risk in Afib) ─────────────────────────────────────

function calculateCHADS(params) {
    const { age, sex, hasCHF, hasHTN, hasStroke, hasVascular, hasDiabetes } = params;

    let score = 0;
    const breakdown = [];

    if (hasCHF) { score += 1; breakdown.push('CHF (+1)'); }
    if (hasHTN) { score += 1; breakdown.push('Hypertension (+1)'); }
    if (age >= 75) { score += 2; breakdown.push('Age ≥75 (+2)'); }
    else if (age >= 65) { score += 1; breakdown.push('Age 65-74 (+1)'); }
    if (hasDiabetes) { score += 1; breakdown.push('Diabetes (+1)'); }
    if (hasStroke) { score += 2; breakdown.push('Stroke/TIA (+2)'); }
    if (hasVascular) { score += 1; breakdown.push('Vascular disease (+1)'); }
    if (sex === 'female') { score += 1; breakdown.push('Female sex (+1)'); }

    const strokeRisk = [0, 1.3, 2.2, 3.2, 4.0, 6.7, 9.8, 9.6, 12.5, 15.2][Math.min(score, 9)] || 15.2;

    return {
        score,
        unit: 'points',
        breakdown,
        interpretation: `CHA₂DS₂-VASc Score: ${score}`,
        risk: `${strokeRisk}% annual stroke risk`,
        recommendation: score >= 2 ? 'Oral anticoagulation strongly recommended.'
            : score === 1 ? 'Consider anticoagulation (weigh bleeding risk).'
                : 'No anticoagulation needed.'
    };
}

// ─── MELD 3.0 (Liver Disease) ────────────────────────────────────────────────

function calculateMELD(params) {
    const { bilirubin, creatinine, inr, sodium, isFemale, albumin } = params;

    // MELD 3.0 Formula (2023)
    let meld = 1.33 * (isFemale ? 1 : 0) +
        4.56 * Math.log(Math.max(bilirubin, 1)) +
        0.82 * (137 - Math.min(Math.max(sodium, 125), 137)) -
        0.24 * (137 - Math.min(Math.max(sodium, 125), 137)) * Math.log(Math.max(bilirubin, 1)) +
        9.09 * Math.log(Math.max(inr, 1)) +
        11.14 * Math.log(Math.max(creatinine, 1)) +
        1.85 * (3.5 - Math.min(albumin, 3.5)) -
        1.83 * (3.5 - Math.min(albumin, 3.5)) * Math.log(Math.max(creatinine, 1)) + 6;

    meld = Math.min(40, Math.max(6, Math.round(meld)));

    return {
        score: meld,
        unit: 'points',
        interpretation: `MELD 3.0 Score: ${meld}`,
        mortality: meld > 35 ? '>50% 90-day mortality' : meld > 25 ? '20-30% 90-day mortality' : '<10% 90-day mortality'
    };
}

/**
 * Orchestrates scoring based on available patient data.
 * Phase 5: Always calculates requested scores (no auto-detection gates).
 * @param {object} patientContext - Full patient context from echoContextEngine
 * @param {string} scoreType - 'ascvd', 'chads', 'meld', or 'all' (default: 'all')
 */
async function generatePredictiveInsights(patientContext, scoreType = 'all') {
    const insights = [];
    const assumptions = [];
    const { demographics, vitalHistory, labs, problems = [] } = patientContext;
    const age = calculateAge(demographics?.dob);
    const sex = (demographics?.sex || '').toLowerCase();

    const wantASCVD = scoreType === 'all' || scoreType === 'ascvd';
    const wantCHADS = scoreType === 'all' || scoreType === 'chads';
    const wantMELD = scoreType === 'all' || scoreType === 'meld';

    // Helper: search problems list with strict word boundary matching to avoid partial matches (e.g., 'mi' in 'migraine')
    const hasProblem = (keywords) => problems.some(p => {
        const name = (p.problem_name || p.name || '').toLowerCase();

        // Skip if it looks like a family history or negative mention
        if (name.includes('denies') || name.includes('negative for') || name.includes('no history of') || name.includes('no ') || name.includes('hx of')) {
            if (name.includes('family')) return false;
        }

        return keywords.some(kw => {
            const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, 'i');
            return regex.test(name);
        });
    });

    // ── 1. ASCVD ────────────────────────────────────────────────────────
    if (wantASCVD) {
        // Extract SBP from vitalHistory (normalized by echoContextEngine)
        let sbp = null;
        if (Array.isArray(vitalHistory) && vitalHistory.length > 0) {
            for (let i = vitalHistory.length - 1; i >= 0; i--) {
                const vs = vitalHistory[i].vitals;
                if (vs && vs.systolicBp) {
                    sbp = parseFloat(vs.systolicBp);
                    break;
                }
            }
        }

        const findLabValue = (keywords) => {
            if (!labs || !Array.isArray(labs)) return null;
            for (const l of labs) {
                const name = (l.test_name || l.name || '').toLowerCase();
                if (keywords.some(kw => name.includes(kw))) {
                    const val = parseFloat(l.result_value || l.value);
                    if (!isNaN(val)) return val;
                }
            }
            return null;
        };

        let totalChol = findLabValue(['total cholesterol', 'total chol']);
        let hdl = findLabValue(['hdl']);

        // Check if we have enough to even try
        const missing = [];
        if (!totalChol) missing.push('Total Cholesterol');
        if (!hdl) missing.push('HDL');
        if (!sbp) missing.push('Systolic BP');

        if (missing.length > 0) {
            if (!totalChol && !hdl && !sbp) {
                insights.push({
                    type: 'ascvd',
                    score: null,
                    interpretation: 'ASCVD 10-Year Risk: Cannot calculate — missing lipid panel and blood pressure data.',
                    missing
                });
            } else if (!totalChol && !hdl) {
                insights.push({
                    type: 'ascvd',
                    score: null,
                    interpretation: 'ASCVD 10-Year Risk: Cannot calculate — missing lipid panel (Total Cholesterol and HDL).',
                    missing
                });
            } else {
                // Partial data - calculate with defaults but flag
                const tcVal = totalChol || 200;
                const hdlVal = hdl || 50;
                const sbpVal = sbp || 120;

                if (!totalChol) assumptions.push('Total cholesterol omitted (using default 200 mg/dL for estimate)');
                if (!hdl) assumptions.push('HDL omitted (using default 50 mg/dL for estimate)');
                if (!sbp) assumptions.push('SBP omitted (using default 120 mmHg for estimate)');

                const params = {
                    age: Math.max(age, 20),
                    totalChol: tcVal,
                    hdl: hdlVal,
                    sbp: sbpVal,
                    isSmoker: (patientContext.socialHistory?.smoking_status || '').toLowerCase().includes('current'),
                    isDiabetic: hasProblem(['diabetes']),
                    isMale: sex === 'male',
                    isWhite: demographics?.race ? demographics.race.toLowerCase().includes('white') : true,
                    treatsBP: hasProblem(['hypertension', 'htn'])
                };

                const result = calculateASCVD(params);
                if (age < 40 || age > 79) {
                    result.caveat = `ACC/AHA Pooled Cohort Equations are officially validated for ages 40-79. At age ${age}, this result is an extrapolation.`;
                }
                insights.push({ type: 'ascvd', ...result });
            }
        } else {
            const params = {
                age,
                totalChol,
                hdl,
                sbp,
                isSmoker: (patientContext.socialHistory?.smoking_status || '').toLowerCase().includes('current'),
                isDiabetic: hasProblem(['diabetes']),
                isMale: sex === 'male',
                isWhite: demographics?.race ? demographics.race.toLowerCase().includes('white') : true,
                treatsBP: hasProblem(['hypertension', 'htn'])
            };
            const result = calculateASCVD(params);
            if (age < 40 || age > 79) {
                result.caveat = `ASCVD Pooled Cohort Equations validated for ages 40-79. Patient age is ${age}. Interpret with caution.`;
            }
            insights.push({ type: 'ascvd', ...result });
        }
    }

    // ── 2. CHA2DS2-VASc ─────────────────────────────────────────────────
    if (wantCHADS) {
        const hasAfib = hasProblem(['atrial fibrillation', 'afib', 'a-fib', 'a fib']);

        const params = {
            age,
            sex,
            hasCHF: hasProblem(['heart failure', 'chf', 'hfref', 'hfpef']),
            hasHTN: hasProblem(['hypertension', 'htn']),
            hasStroke: hasProblem(['stroke', 'tia', 'cerebrovascular', 'cva']),
            hasVascular: hasProblem(['vascular', 'pad', 'peripheral arterial', 'aortic', 'coronary artery disease', 'cad', 'mi', 'myocardial infarction']),
            hasDiabetes: hasProblem(['diabetes'])
        };

        const result = calculateCHADS(params);
        if (!hasAfib) {
            result.caveat = 'CHA₂DS₂-VASc is validated for patients with atrial fibrillation. Clinical afib not found in active problems.';
        }
        insights.push({ type: 'chads', ...result });
    }

    // ── 3. MELD 3.0 ─────────────────────────────────────────────────────
    if (wantMELD) {
        const findLabValue = (keywords) => {
            if (!labs || !Array.isArray(labs)) return null;
            for (const l of labs) {
                const name = (l.test_name || l.name || '').toLowerCase();
                if (keywords.some(kw => name.includes(kw))) {
                    const val = parseFloat(l.result_value || l.value);
                    if (!isNaN(val)) return val;
                }
            }
            return null;
        };

        const bilirubin = findLabValue(['bilirubin']);
        const creatinine = findLabValue(['creatinine']);
        const inr = findLabValue(['inr']);
        const sodium = findLabValue(['sodium', 'na']);
        const albumin = findLabValue(['albumin']);

        if (bilirubin && creatinine && inr) {
            const result = calculateMELD({
                bilirubin,
                creatinine,
                inr,
                sodium: sodium || 140,
                isFemale: sex === 'female',
                albumin: albumin || 3.5
            });
            if (!sodium) assumptions.push('Sodium assumed 140 mEq/L');
            if (!albumin) assumptions.push('Albumin assumed 3.5 g/dL');
            insights.push({ type: 'meld', ...result });
        } else {
            insights.push({
                type: 'meld',
                score: null,
                interpretation: 'MELD 3.0: Cannot calculate — requires bilirubin, creatinine, and INR lab results.',
                missing: [
                    !bilirubin ? 'Bilirubin' : null,
                    !creatinine ? 'Creatinine' : null,
                    !inr ? 'INR' : null
                ].filter(Boolean)
            });
        }
    }

    return {
        scores: insights,
        assumptions: assumptions.length > 0 ? assumptions : undefined,
        summary: insights.length > 0
            ? `Calculated ${insights.filter(i => i.score !== null).length} clinical risk score(s).`
            : 'Unable to calculate scores with available data.'
    };
}

function calculateAge(dob) {
    if (!dob) return 45; // Default for logic if missing
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
    return age;
}

module.exports = {
    calculateASCVD,
    calculateCHADS,
    calculateMELD,
    generatePredictiveInsights
};
