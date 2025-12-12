// Quest Diagnostics and LabCorp Lab Test Codes
// Common lab tests with Quest and LabCorp codes

export const labTests = [
    // Comprehensive Metabolic Panel
    {
        name: 'Comprehensive Metabolic Panel (CMP)',
        questCode: '10231',
        labcorpCode: '322000',
        cpt: '80053',
        description: 'Glucose, BUN, Creatinine, eGFR, Sodium, Potassium, Chloride, CO2, Calcium, Total Protein, Albumin, Bilirubin Total, Alkaline Phosphatase, AST, ALT'
    },
    // Basic Metabolic Panel
    {
        name: 'Basic Metabolic Panel (BMP)',
        questCode: '10221',
        labcorpCode: '322758',
        cpt: '80048',
        description: 'Glucose, BUN, Creatinine, eGFR, Sodium, Potassium, Chloride, CO2'
    },
    // Complete Blood Count
    {
        name: 'Complete Blood Count (CBC)',
        questCode: '6399',
        labcorpCode: '005009',
        cpt: '85025',
        description: 'WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, Platelet Count, Differential'
    },
    // Lipid Panel
    {
        name: 'Lipid Panel',
        questCode: '37848',
        labcorpCode: '303756',
        cpt: '80061',
        description: 'Total Cholesterol, HDL, LDL, Triglycerides'
    },
    // Hemoglobin A1c
    {
        name: 'Hemoglobin A1c (HbA1c)',
        questCode: '496',
        labcorpCode: '001453',
        cpt: '83036',
        description: 'Glycated Hemoglobin'
    },
    // Thyroid Stimulating Hormone
    {
        name: 'Thyroid Stimulating Hormone (TSH)',
        questCode: '899',
        labcorpCode: '004259',
        cpt: '84443',
        description: 'TSH'
    },
    // Complete Thyroid Panel
    {
        name: 'Complete Thyroid Panel',
        questCode: '91784',
        labcorpCode: '004259',
        cpt: '84443, 84439, 84436',
        description: 'TSH, Free T4, Free T3'
    },
    // Vitamin D
    {
        name: 'Vitamin D, 25-Hydroxy',
        questCode: '17306',
        labcorpCode: '081950',
        cpt: '82306',
        description: '25-Hydroxyvitamin D'
    },
    // B12
    {
        name: 'Vitamin B12',
        questCode: '927',
        labcorpCode: '001503',
        cpt: '82607',
        description: 'Cobalamin'
    },
    // Folate
    {
        name: 'Folate, Serum',
        questCode: '928',
        labcorpCode: '001574',
        cpt: '82746',
        description: 'Folic Acid'
    },
    // Liver Function Panel
    {
        name: 'Liver Function Panel',
        questCode: '10165',
        labcorpCode: '322755',
        cpt: '80076',
        description: 'ALT, AST, Alkaline Phosphatase, Bilirubin Total, Albumin, Total Protein'
    },
    // Urinalysis
    {
        name: 'Urinalysis, Complete',
        questCode: '5463',
        labcorpCode: '010002',
        cpt: '81001',
        description: 'Physical, Chemical, Microscopic'
    },
    // Urine Culture
    {
        name: 'Urine Culture',
        questCode: '6008',
        labcorpCode: '180001',
        cpt: '87040',
        description: 'Bacterial Culture with Sensitivity'
    },
    // PSA
    {
        name: 'Prostate Specific Antigen (PSA)',
        questCode: '927',
        labcorpCode: '010369',
        cpt: '84153',
        description: 'PSA Total'
    },
    // C-Reactive Protein
    {
        name: 'C-Reactive Protein (CRP)',
        questCode: '4420',
        labcorpCode: '006025',
        cpt: '86140',
        description: 'High Sensitivity CRP'
    },
    // Hemoglobin A1c with eAG
    {
        name: 'Hemoglobin A1c with eAG',
        questCode: '496',
        labcorpCode: '001453',
        cpt: '83036',
        description: 'HbA1c with Estimated Average Glucose'
    },
    // Comprehensive Metabolic Panel with eGFR
    {
        name: 'CMP with eGFR',
        questCode: '10231',
        labcorpCode: '322000',
        cpt: '80053',
        description: 'CMP including estimated GFR'
    },
    // Lipid Panel with Non-HDL
    {
        name: 'Lipid Panel with Non-HDL',
        questCode: '37848',
        labcorpCode: '303756',
        cpt: '80061',
        description: 'Complete lipid panel including Non-HDL calculation'
    },
    // Ferritin
    {
        name: 'Ferritin',
        questCode: '7573',
        labcorpCode: '004598',
        cpt: '82728',
        description: 'Serum Ferritin'
    },
    // Iron Studies
    {
        name: 'Iron Studies',
        questCode: '7573',
        labcorpCode: '004598',
        cpt: '83540, 83550, 84466',
        description: 'Iron, TIBC, Transferrin Saturation, Ferritin'
    },
    // Hemoglobin Electrophoresis
    {
        name: 'Hemoglobin Electrophoresis',
        questCode: '36170',
        labcorpCode: '500215',
        cpt: '83020',
        description: 'Hemoglobin Variant Analysis'
    },
    // Testosterone Total
    {
        name: 'Testosterone, Total',
        questCode: '15983',
        labcorpCode: '004226',
        cpt: '84403',
        description: 'Total Testosterone'
    },
    // Testosterone Free
    {
        name: 'Testosterone, Free',
        questCode: '15984',
        labcorpCode: '070004',
        cpt: '84403',
        description: 'Free Testosterone'
    },
    // Cortisol
    {
        name: 'Cortisol, AM',
        questCode: '899',
        labcorpCode: '004259',
        cpt: '82533',
        description: 'Morning Cortisol'
    },
    // Hemoglobin A1c Point of Care
    {
        name: 'HbA1c (Point of Care)',
        questCode: '496',
        labcorpCode: '001453',
        cpt: '83036',
        description: 'Point of Care A1c'
    },
    // Comprehensive Metabolic Panel with eGFR and A1c
    {
        name: 'CMP + HbA1c',
        questCode: '10231, 496',
        labcorpCode: '322000, 001453',
        cpt: '80053, 83036',
        description: 'CMP with eGFR and Hemoglobin A1c'
    },
    // Lipid Panel + HbA1c
    {
        name: 'Lipid Panel + HbA1c',
        questCode: '37848, 496',
        labcorpCode: '303756, 001453',
        cpt: '80061, 83036',
        description: 'Complete Lipid Panel with Hemoglobin A1c'
    },
    // CBC with Differential
    {
        name: 'CBC with Differential',
        questCode: '6399',
        labcorpCode: '005009',
        cpt: '85025',
        description: 'Complete Blood Count with Manual Differential'
    },
    // Comprehensive Metabolic Panel + Lipid Panel
    {
        name: 'CMP + Lipid Panel',
        questCode: '10231, 37848',
        labcorpCode: '322000, 303756',
        cpt: '80053, 80061',
        description: 'Comprehensive Metabolic Panel and Complete Lipid Panel'
    },
    // TSH + Free T4
    {
        name: 'TSH + Free T4',
        questCode: '899, 866',
        labcorpCode: '004259, 004259',
        cpt: '84443, 84439',
        description: 'Thyroid Stimulating Hormone and Free T4'
    },
    // Hemoglobin A1c + Lipid Panel + CMP
    {
        name: 'HbA1c + Lipid + CMP',
        questCode: '496, 37848, 10231',
        labcorpCode: '001453, 303756, 322000',
        cpt: '83036, 80061, 80053',
        description: 'Hemoglobin A1c, Lipid Panel, and Comprehensive Metabolic Panel'
    },
    // Troponin I (High Sensitivity)
    {
        name: 'Troponin I, High Sensitivity',
        questCode: '34499',
        labcorpCode: '004510',
        cpt: '84484',
        description: 'High Sensitivity Troponin I for MI detection'
    },
    // Troponin T
    {
        name: 'Troponin T',
        questCode: '34499',
        labcorpCode: '004510',
        cpt: '84484',
        description: 'Troponin T for cardiac injury'
    },
    // BNP (Brain Natriuretic Peptide)
    {
        name: 'BNP (Brain Natriuretic Peptide)',
        questCode: '91797',
        labcorpCode: '004510',
        cpt: '83880',
        description: 'BNP for heart failure evaluation'
    },
    // NT-proBNP
    {
        name: 'NT-proBNP',
        questCode: '91797',
        labcorpCode: '004510',
        cpt: '83880',
        description: 'N-terminal pro-BNP for heart failure'
    },
    // D-Dimer
    {
        name: 'D-Dimer',
        questCode: '34499',
        labcorpCode: '004510',
        cpt: '85379',
        description: 'D-Dimer for thrombosis/PE evaluation'
    },
    // Prothrombin Time (PT/INR)
    {
        name: 'Prothrombin Time (PT/INR)',
        questCode: '590',
        labcorpCode: '003009',
        cpt: '85610',
        description: 'PT/INR for anticoagulation monitoring'
    },
    // PTT (Partial Thromboplastin Time)
    {
        name: 'PTT (Partial Thromboplastin Time)',
        questCode: '16401',
        labcorpCode: '004510',
        cpt: '85730',
        description: 'PTT for coagulation assessment'
    },
    // Comprehensive Metabolic Panel + Troponin
    {
        name: 'CMP + Troponin',
        questCode: '10231, 34499',
        labcorpCode: '322000, 004510',
        cpt: '80053, 84484',
        description: 'CMP with Troponin for cardiac workup'
    },
    // BNP + Troponin
    {
        name: 'BNP + Troponin',
        questCode: '91797, 34499',
        labcorpCode: '004510, 004510',
        cpt: '83880, 84484',
        description: 'BNP and Troponin for cardiac evaluation'
    },
    // Lipid Panel + CRP
    {
        name: 'Lipid Panel + CRP',
        questCode: '37848, 4420',
        labcorpCode: '303756, 006025',
        cpt: '80061, 86140',
        description: 'Lipid Panel with C-Reactive Protein'
    },
    // Comprehensive Metabolic Panel + BNP
    {
        name: 'CMP + BNP',
        questCode: '10231, 91797',
        labcorpCode: '322000, 004510',
        cpt: '80053, 83880',
        description: 'CMP with BNP for heart failure workup'
    }
];

// Imaging Studies
export const imagingStudies = [
    {
        name: 'Chest X-Ray (2 views)',
        cpt: '71020',
        description: 'Chest X-Ray PA and Lateral'
    },
    {
        name: 'Chest X-Ray (1 view)',
        cpt: '71010',
        description: 'Chest X-Ray Single View'
    },
    {
        name: 'CT Head without Contrast',
        cpt: '70450',
        description: 'CT Head/Brain without Contrast'
    },
    {
        name: 'CT Head with Contrast',
        cpt: '70460',
        description: 'CT Head/Brain with Contrast'
    },
    {
        name: 'CT Chest without Contrast',
        cpt: '71250',
        description: 'CT Chest without Contrast'
    },
    {
        name: 'CT Chest with Contrast',
        cpt: '71260',
        description: 'CT Chest with Contrast'
    },
    {
        name: 'CT Abdomen/Pelvis without Contrast',
        cpt: '74150',
        description: 'CT Abdomen and Pelvis without Contrast'
    },
    {
        name: 'CT Abdomen/Pelvis with Contrast',
        cpt: '74177',
        description: 'CT Abdomen and Pelvis with Contrast'
    },
    {
        name: 'MRI Brain without Contrast',
        cpt: '70551',
        description: 'MRI Brain without Contrast'
    },
    {
        name: 'MRI Brain with Contrast',
        cpt: '70553',
        description: 'MRI Brain with Contrast'
    },
    {
        name: 'MRI Spine Cervical without Contrast',
        cpt: '72141',
        description: 'MRI Cervical Spine without Contrast'
    },
    {
        name: 'MRI Spine Lumbar without Contrast',
        cpt: '72148',
        description: 'MRI Lumbar Spine without Contrast'
    },
    {
        name: 'Ultrasound Abdomen Complete',
        cpt: '76700',
        description: 'Ultrasound Abdomen Complete'
    },
    {
        name: 'Ultrasound Pelvis',
        cpt: '76856',
        description: 'Ultrasound Pelvis Complete'
    },
    {
        name: 'Mammography Screening',
        cpt: '77067',
        description: 'Screening Mammography Bilateral'
    },
    {
        name: 'Mammography Diagnostic',
        cpt: '77065',
        description: 'Diagnostic Mammography Unilateral'
    },
    {
        name: 'Bone Density Scan (DEXA)',
        cpt: '77080',
        description: 'Dual-Energy X-Ray Absorptiometry (DEXA)'
    },
    {
        name: 'Echocardiogram',
        cpt: '93306',
        description: 'Echocardiogram Complete'
    },
    {
        name: 'EKG (12-lead)',
        cpt: '93000',
        description: 'Electrocardiogram Routine 12-lead'
    }
];

// Search function
export const searchLabTests = (query) => {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    return labTests.filter(test => 
        test.name.toLowerCase().includes(lowerQuery) ||
        test.questCode.includes(query) ||
        test.labcorpCode.includes(query) ||
        test.cpt.includes(query) ||
        test.description.toLowerCase().includes(lowerQuery)
    );
};

export const searchImaging = (query) => {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    return imagingStudies.filter(study => 
        study.name.toLowerCase().includes(lowerQuery) ||
        study.cpt.includes(query) ||
        study.description.toLowerCase().includes(lowerQuery)
    );
};
































