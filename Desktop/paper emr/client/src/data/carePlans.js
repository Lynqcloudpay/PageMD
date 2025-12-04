// Care Plan Templates based on clinical guidelines
// Inspired by Epic Care Everywhere and eClinicalWorks Care Management

export const carePlanTemplates = {
  // Diabetes Management (based on ADA Guidelines)
  'diabetes_type2': {
    name: 'Type 2 Diabetes Management',
    icd10: 'E11.9',
    goals: [
      { id: 1, goal: 'Achieve A1c target of <7% (individualize based on patient)', metric: 'A1c', target: '<7%', frequency: 'Every 3 months' },
      { id: 2, goal: 'Maintain fasting glucose 80-130 mg/dL', metric: 'Fasting glucose', target: '80-130 mg/dL', frequency: 'Daily' },
      { id: 3, goal: 'Blood pressure <140/90 mmHg', metric: 'Blood pressure', target: '<140/90 mmHg', frequency: 'Each visit' },
      { id: 4, goal: 'LDL cholesterol <100 mg/dL', metric: 'LDL', target: '<100 mg/dL', frequency: 'Annually' },
      { id: 5, goal: 'Weight loss of 5-7% if overweight', metric: 'Weight', target: '5-7% reduction', frequency: 'Each visit' },
    ],
    monitoring: [
      { test: 'Hemoglobin A1c', frequency: 'Every 3 months until at goal, then every 6 months', cpt: '83036' },
      { test: 'Fasting Lipid Panel', frequency: 'Annually', cpt: '80061' },
      { test: 'Comprehensive Metabolic Panel', frequency: 'Annually', cpt: '80053' },
      { test: 'Urine Microalbumin/Creatinine Ratio', frequency: 'Annually', cpt: '82043' },
      { test: 'Foot Exam', frequency: 'Each visit', cpt: '99173' },
      { test: 'Dilated Eye Exam', frequency: 'Annually (refer to ophthalmology)', cpt: '92014' },
    ],
    interventions: [
      'Diabetes self-management education (DSME)',
      'Medical nutrition therapy referral',
      'Exercise: 150 min/week moderate-intensity aerobic activity',
      'Daily foot self-examination',
      'Smoking cessation if applicable',
      'Statin therapy for cardiovascular risk reduction',
      'ACE inhibitor or ARB for nephropathy prevention',
    ],
    patientEducation: [
      'Understanding diabetes and blood sugar management',
      'Carbohydrate counting and healthy eating',
      'Blood glucose monitoring technique',
      'Hypoglycemia recognition and treatment',
      'Sick day management',
      'Importance of medication adherence',
      'Foot care and daily inspection',
    ],
    medications: [
      { name: 'Metformin', firstLine: true, notes: 'Start 500mg daily, titrate to 1000mg BID' },
      { name: 'SGLT2 Inhibitor', notes: 'Consider for CV/renal benefit (empagliflozin, canagliflozin)' },
      { name: 'GLP-1 Agonist', notes: 'Consider for weight management (semaglutide, liraglutide)' },
      { name: 'Statin', notes: 'Moderate to high intensity for ASCVD risk reduction' },
      { name: 'ACE Inhibitor/ARB', notes: 'For hypertension or albuminuria' },
    ],
  },

  // Hypertension Management (based on ACC/AHA Guidelines)
  'hypertension': {
    name: 'Hypertension Management',
    icd10: 'I10',
    goals: [
      { id: 1, goal: 'Blood pressure <130/80 mmHg', metric: 'Blood pressure', target: '<130/80 mmHg', frequency: 'Each visit' },
      { id: 2, goal: 'Reduce sodium intake to <2300mg/day', metric: 'Dietary sodium', target: '<2300mg/day', frequency: 'Ongoing' },
      { id: 3, goal: 'Weight management (BMI <25)', metric: 'BMI', target: '<25', frequency: 'Each visit' },
    ],
    monitoring: [
      { test: 'Blood Pressure', frequency: 'Each visit, home monitoring recommended', cpt: '99473' },
      { test: 'Comprehensive Metabolic Panel', frequency: 'Annually or as needed', cpt: '80053' },
      { test: 'Lipid Panel', frequency: 'Annually', cpt: '80061' },
      { test: 'Urinalysis', frequency: 'Annually', cpt: '81003' },
      { test: 'EKG', frequency: 'Baseline, then as indicated', cpt: '93000' },
    ],
    interventions: [
      'DASH diet counseling',
      'Sodium restriction (<2300mg/day, ideally <1500mg/day)',
      'Regular aerobic exercise (90-150 min/week)',
      'Weight reduction if overweight',
      'Limit alcohol (≤2 drinks/day men, ≤1 drink/day women)',
      'Smoking cessation',
      'Stress management techniques',
    ],
    patientEducation: [
      'Understanding blood pressure numbers',
      'Home blood pressure monitoring technique',
      'DASH diet principles',
      'Reading nutrition labels for sodium content',
      'Importance of medication adherence',
      'Signs of hypertensive emergency',
    ],
    medications: [
      { name: 'ACE Inhibitor', notes: 'Lisinopril, start 10mg daily' },
      { name: 'ARB', notes: 'Alternative to ACE-I if cough develops' },
      { name: 'Calcium Channel Blocker', notes: 'Amlodipine 5-10mg daily' },
      { name: 'Thiazide Diuretic', notes: 'HCTZ 12.5-25mg or chlorthalidone 12.5-25mg' },
      { name: 'Beta Blocker', notes: 'If compelling indication (CAD, HF, arrhythmia)' },
    ],
  },

  // Heart Failure Management (based on ACC/AHA Guidelines)
  'heart_failure': {
    name: 'Heart Failure Management (HFrEF)',
    icd10: 'I50.9',
    goals: [
      { id: 1, goal: 'Optimize GDMT to target doses', metric: 'Medication doses', target: 'Target doses reached', frequency: 'Each visit' },
      { id: 2, goal: 'Maintain daily weight within 3 lbs of dry weight', metric: 'Weight', target: '±3 lbs of dry weight', frequency: 'Daily' },
      { id: 3, goal: 'NYHA Class I-II symptoms', metric: 'Functional status', target: 'NYHA I-II', frequency: 'Each visit' },
      { id: 4, goal: 'Reduce hospital readmissions', metric: 'Hospitalizations', target: '0 in 12 months', frequency: 'Annually' },
    ],
    monitoring: [
      { test: 'BNP or NT-proBNP', frequency: 'Every 3-6 months', cpt: '83880' },
      { test: 'Comprehensive Metabolic Panel', frequency: 'Every 3-6 months', cpt: '80053' },
      { test: 'Echocardiogram', frequency: 'Annually or with clinical change', cpt: '93306' },
      { test: 'Daily Weight', frequency: 'Daily', cpt: 'Patient self-monitoring' },
    ],
    interventions: [
      'Sodium restriction (<2000mg/day)',
      'Fluid restriction if hyponatremic',
      'Daily weight monitoring',
      'Cardiac rehabilitation referral',
      'Influenza and pneumococcal vaccination',
      'Avoid NSAIDs and COX-2 inhibitors',
      'ICD evaluation if EF ≤35%',
    ],
    patientEducation: [
      'Heart failure zones (green, yellow, red)',
      'Daily weight monitoring and recording',
      'Low sodium diet education',
      'Medication adherence importance',
      'When to call the office vs go to ER',
      'Activity and exercise recommendations',
    ],
    medications: [
      { name: 'ACE Inhibitor/ARB/ARNI', notes: 'ARNI preferred if tolerated (sacubitril/valsartan)' },
      { name: 'Beta Blocker', notes: 'Carvedilol, metoprolol succinate, or bisoprolol' },
      { name: 'MRA', notes: 'Spironolactone or eplerenone' },
      { name: 'SGLT2 Inhibitor', notes: 'Dapagliflozin or empagliflozin' },
      { name: 'Loop Diuretic', notes: 'Furosemide for congestion' },
    ],
  },

  // COPD Management (based on GOLD Guidelines)
  'copd': {
    name: 'COPD Management',
    icd10: 'J44.9',
    goals: [
      { id: 1, goal: 'Reduce exacerbation frequency', metric: 'Exacerbations', target: '<2 per year', frequency: 'Annually' },
      { id: 2, goal: 'Improve dyspnea (mMRC scale)', metric: 'mMRC score', target: '<2', frequency: 'Each visit' },
      { id: 3, goal: 'Smoking cessation', metric: 'Tobacco use', target: 'None', frequency: 'Each visit' },
      { id: 4, goal: 'Maintain optimal O2 saturation', metric: 'SpO2', target: '≥88%', frequency: 'Each visit' },
    ],
    monitoring: [
      { test: 'Spirometry', frequency: 'Annually', cpt: '94010' },
      { test: 'Pulse Oximetry', frequency: 'Each visit', cpt: '94760' },
      { test: 'Arterial Blood Gas', frequency: 'As indicated', cpt: '82803' },
      { test: 'Chest X-Ray', frequency: 'Annually or as indicated', cpt: '71046' },
      { test: 'Alpha-1 Antitrypsin', frequency: 'Once if not done', cpt: '82103' },
    ],
    interventions: [
      'Smoking cessation (most important intervention)',
      'Pulmonary rehabilitation referral',
      'Annual influenza vaccination',
      'Pneumococcal vaccination (PPSV23 and PCV13)',
      'COVID-19 vaccination',
      'Oxygen therapy if qualifying hypoxemia',
      'Action plan for exacerbations',
    ],
    patientEducation: [
      'Proper inhaler technique',
      'Recognizing and treating exacerbations early',
      'Smoking cessation resources',
      'Energy conservation techniques',
      'When to seek emergency care',
      'Supplemental oxygen use if prescribed',
    ],
    medications: [
      { name: 'SABA', notes: 'Albuterol inhaler PRN for rescue' },
      { name: 'LAMA', notes: 'Tiotropium daily for maintenance' },
      { name: 'LABA', notes: 'Consider LAMA/LABA combination' },
      { name: 'ICS/LABA', notes: 'If frequent exacerbations or asthma overlap' },
      { name: 'Roflumilast', notes: 'For severe COPD with chronic bronchitis phenotype' },
    ],
  },

  // Chronic Kidney Disease Management
  'ckd': {
    name: 'Chronic Kidney Disease Management',
    icd10: 'N18.9',
    goals: [
      { id: 1, goal: 'Slow CKD progression', metric: 'eGFR decline', target: '<5 mL/min/year', frequency: 'Every 3-6 months' },
      { id: 2, goal: 'Blood pressure <130/80 mmHg', metric: 'Blood pressure', target: '<130/80 mmHg', frequency: 'Each visit' },
      { id: 3, goal: 'Reduce proteinuria', metric: 'UACR', target: '<30 mg/g', frequency: 'Every 6 months' },
      { id: 4, goal: 'Manage anemia if present', metric: 'Hemoglobin', target: '10-12 g/dL', frequency: 'Every 3 months' },
    ],
    monitoring: [
      { test: 'Comprehensive Metabolic Panel', frequency: 'Every 3-6 months', cpt: '80053' },
      { test: 'eGFR', frequency: 'Every 3-6 months', cpt: '82565' },
      { test: 'Urine Albumin/Creatinine Ratio', frequency: 'Every 6 months', cpt: '82043' },
      { test: 'CBC', frequency: 'Every 6-12 months', cpt: '85025' },
      { test: 'PTH, Calcium, Phosphorus', frequency: 'Annually for Stage 3+', cpt: '83970' },
      { test: 'Vitamin D', frequency: 'Annually', cpt: '82306' },
    ],
    interventions: [
      'ACE inhibitor or ARB therapy',
      'SGLT2 inhibitor if appropriate',
      'Blood pressure control',
      'Avoid nephrotoxins (NSAIDs, contrast)',
      'Dietary protein and sodium restriction',
      'Nephrology referral for Stage 4 or rapidly progressing',
      'Preparation for RRT if Stage 4-5',
    ],
    patientEducation: [
      'Understanding kidney function and stages of CKD',
      'Medications to avoid (OTC NSAIDs)',
      'Low sodium and protein diet',
      'Importance of blood pressure control',
      'Signs of worsening kidney function',
      'Dialysis options if progressing',
    ],
    medications: [
      { name: 'ACE Inhibitor/ARB', notes: 'Cornerstone therapy for proteinuria' },
      { name: 'SGLT2 Inhibitor', notes: 'Dapagliflozin or empagliflozin for renal protection' },
      { name: 'Statin', notes: 'For cardiovascular risk reduction' },
      { name: 'Phosphate Binder', notes: 'If hyperphosphatemia in advanced CKD' },
      { name: 'Vitamin D', notes: 'Ergocalciferol or cholecalciferol for deficiency' },
    ],
  },

  // Depression Management
  'depression': {
    name: 'Major Depressive Disorder Management',
    icd10: 'F32.9',
    goals: [
      { id: 1, goal: 'Achieve remission (PHQ-9 <5)', metric: 'PHQ-9', target: '<5', frequency: 'Every 2-4 weeks initially' },
      { id: 2, goal: 'Improve functional status', metric: 'Functional assessment', target: 'Return to baseline', frequency: 'Each visit' },
      { id: 3, goal: 'Minimize medication side effects', metric: 'Side effect assessment', target: 'Tolerable', frequency: 'Each visit' },
      { id: 4, goal: 'Prevent relapse', metric: 'Symptom recurrence', target: 'No relapse', frequency: 'Ongoing' },
    ],
    monitoring: [
      { test: 'PHQ-9', frequency: 'Every 2-4 weeks until stable, then monthly', cpt: '96127' },
      { test: 'Suicide Risk Assessment', frequency: 'Each visit', cpt: '96130' },
      { test: 'GAD-7 (for comorbid anxiety)', frequency: 'Baseline and as needed', cpt: '96127' },
      { test: 'Metabolic panel, TSH', frequency: 'Baseline', cpt: '80053' },
    ],
    interventions: [
      'Psychotherapy referral (CBT, IPT)',
      'Medication management with close follow-up',
      'Regular physical exercise',
      'Sleep hygiene education',
      'Social support and engagement',
      'Crisis resources and safety planning',
      'Consider psychiatric referral for severe/refractory',
    ],
    patientEducation: [
      'Understanding depression as a medical condition',
      'Medication expectations (4-6 weeks for full effect)',
      'Importance of medication adherence',
      'Warning signs of worsening',
      'Crisis resources and hotlines',
      'Lifestyle factors affecting mood',
    ],
    medications: [
      { name: 'SSRI', notes: 'First-line: sertraline, escitalopram, or fluoxetine' },
      { name: 'SNRI', notes: 'Alternative: venlafaxine or duloxetine' },
      { name: 'Bupropion', notes: 'Good for fatigue, weight concerns, or smoking' },
      { name: 'Mirtazapine', notes: 'Good for insomnia, appetite issues' },
      { name: 'Augmentation', notes: 'Consider aripiprazole or bupropion if partial response' },
    ],
  },

  // Asthma Management (based on GINA Guidelines)
  'asthma': {
    name: 'Asthma Management',
    icd10: 'J45.909',
    goals: [
      { id: 1, goal: 'Achieve asthma control (ACT ≥20)', metric: 'ACT score', target: '≥20', frequency: 'Each visit' },
      { id: 2, goal: 'Reduce exacerbation frequency', metric: 'Exacerbations', target: '<2 per year', frequency: 'Annually' },
      { id: 3, goal: 'Minimize rescue inhaler use', metric: 'SABA use', target: '≤2 times/week', frequency: 'Each visit' },
      { id: 4, goal: 'Maintain normal activity level', metric: 'Activity limitation', target: 'None', frequency: 'Each visit' },
    ],
    monitoring: [
      { test: 'Spirometry', frequency: 'Annually or as indicated', cpt: '94010' },
      { test: 'Peak Flow', frequency: 'Daily for moderate-severe', cpt: 'Patient self-monitoring' },
      { test: 'Asthma Control Test (ACT)', frequency: 'Each visit', cpt: '96127' },
      { test: 'Allergy Testing', frequency: 'Once if not done', cpt: '86003' },
    ],
    interventions: [
      'Identify and avoid triggers',
      'Annual influenza vaccination',
      'Asthma action plan',
      'Allergy management if applicable',
      'Consider immunotherapy for allergic asthma',
      'Smoking/vaping cessation',
      'Treat comorbidities (GERD, rhinitis)',
    ],
    patientEducation: [
      'Proper inhaler technique (demonstrate)',
      'Asthma action plan zones',
      'Peak flow monitoring',
      'Trigger avoidance strategies',
      'When to use rescue vs controller inhalers',
      'When to seek emergency care',
    ],
    medications: [
      { name: 'SABA', notes: 'Albuterol PRN (should not need >2x/week)' },
      { name: 'ICS', notes: 'First-line controller (fluticasone, budesonide)' },
      { name: 'ICS/LABA', notes: 'Step up if not controlled on ICS alone' },
      { name: 'LTRA', notes: 'Montelukast as add-on or alternative' },
      { name: 'Biologics', notes: 'Consider for severe uncontrolled asthma' },
    ],
  },
};

// Search care plans
export const searchCarePlans = (query) => {
  if (!query) return Object.entries(carePlanTemplates).map(([key, plan]) => ({ key, ...plan }));
  const searchLower = query.toLowerCase();
  return Object.entries(carePlanTemplates)
    .filter(([key, plan]) => 
      plan.name.toLowerCase().includes(searchLower) ||
      plan.icd10.toLowerCase().includes(searchLower) ||
      key.toLowerCase().includes(searchLower)
    )
    .map(([key, plan]) => ({ key, ...plan }));
};

export default carePlanTemplates;














