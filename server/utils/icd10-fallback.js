
const commonICD10 = [
    // ========== HYPERTENSIVE DISEASES ==========
    { code: 'I10', description: 'Essential (primary) hypertension', billable: true, valid: true },
    { code: 'I11.0', description: 'Hypertensive heart disease with heart failure', billable: true, valid: true },
    { code: 'I11.9', description: 'Hypertensive heart disease without heart failure', billable: true, valid: true },
    { code: 'I12.0', description: 'Hypertensive chronic kidney disease with stage 5 CKD or ESRD', billable: true, valid: true },
    { code: 'I12.9', description: 'Hypertensive chronic kidney disease with stage 1-4 CKD', billable: true, valid: true },
    { code: 'I15.0', description: 'Renovascular hypertension', billable: true, valid: true },
    { code: 'I15.9', description: 'Secondary hypertension, unspecified', billable: true, valid: true },

    // ========== ISCHEMIC HEART DISEASES ==========
    { code: 'I20.0', description: 'Unstable angina', billable: true, valid: true },
    { code: 'I20.9', description: 'Angina pectoris, unspecified', billable: true, valid: true },
    { code: 'I21.3', description: 'STEMI of unspecified site', billable: true, valid: true },
    { code: 'I21.4', description: 'Non-ST elevation (NSTEMI) myocardial infarction', billable: true, valid: true },
    { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', billable: true, valid: true },
    { code: 'I25.10', description: 'ASHD of native coronary artery without angina pectoris', billable: true, valid: true },
    { code: 'I25.110', description: 'ASHD of native coronary artery with unstable angina pectoris', billable: true, valid: true },
    { code: 'I25.2', description: 'Old myocardial infarction', billable: true, valid: true },
    { code: 'I25.5', description: 'Ischemic cardiomyopathy', billable: true, valid: true },

    // ========== HEART FAILURE ==========
    { code: 'I50.9', description: 'Heart failure, unspecified', billable: true, valid: true },
    { code: 'I50.21', description: 'Acute systolic heart failure', billable: true, valid: true },
    { code: 'I50.22', description: 'Chronic systolic heart failure', billable: true, valid: true },
    { code: 'I50.23', description: 'Acute on chronic systolic heart failure', billable: true, valid: true },
    { code: 'I50.31', description: 'Acute diastolic heart failure', billable: true, valid: true },
    { code: 'I50.32', description: 'Chronic diastolic heart failure', billable: true, valid: true },
    { code: 'I50.33', description: 'Acute on chronic diastolic heart failure', billable: true, valid: true },

    // ========== CARDIAC ARRHYTHMIAS ==========
    { code: 'I48.0', description: 'Paroxysmal atrial fibrillation', billable: true, valid: true },
    { code: 'I48.11', description: 'Longstanding persistent atrial fibrillation', billable: true, valid: true },
    { code: 'I48.20', description: 'Chronic atrial fibrillation, unspecified', billable: true, valid: true },
    { code: 'I48.91', description: 'Unspecified atrial fibrillation', billable: true, valid: true },
    { code: 'I47.1', description: 'Supraventricular tachycardia', billable: true, valid: true },
    { code: 'I47.2', description: 'Ventricular tachycardia', billable: true, valid: true },
    { code: 'I49.9', description: 'Cardiac arrhythmia, unspecified', billable: true, valid: true },

    // ========== SYMPTOMS AND SIGNS ==========
    { code: 'R00.2', description: 'Palpitations', billable: true, valid: true },
    { code: 'R06.02', description: 'Shortness of breath', billable: true, valid: true },
    { code: 'R07.9', description: 'Chest pain, unspecified', billable: true, valid: true },
    { code: 'R07.89', description: 'Other chest pain', billable: true, valid: true },
    { code: 'R55', description: 'Syncope and collapse', billable: true, valid: true },
    { code: 'R94.31', description: 'Abnormal EKG', billable: true, valid: true },

    // ========== DIABETES & METABOLIC ==========
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', billable: true, valid: true },
    { code: 'E78.5', description: 'Hyperlipidemia, unspecified', billable: true, valid: true },
    { code: 'E66.9', description: 'Obesity, unspecified', billable: true, valid: true }
];

module.exports = {
    commonICD10,
    searchFallback: (q) => {
        if (!q) return commonICD10.slice(0, 20);
        const searchLower = q.toLowerCase();
        return commonICD10.filter(c =>
            c.code.toLowerCase().includes(searchLower) ||
            c.description.toLowerCase().includes(searchLower)
        ).slice(0, 20);
    }
};
