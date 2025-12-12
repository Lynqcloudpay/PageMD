const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Top 100 Cardiology Ordersets
const cardiologyOrdersets = [
  {
    name: 'Acute Coronary Syndrome (ACS)',
    description: 'Standard orders for suspected or confirmed ACS including labs, imaging, and medications',
    specialty: 'cardiology',
    category: 'acute_care',
    tags: ['chest pain', 'MI', 'STEMI', 'NSTEMI', 'ACS'],
    orders: [
      { type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'CK-MB', cpt: '82550', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'aPTT', cpt: '85730', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'prescription', payload: { medication: 'Aspirin 81mg', sig: 'Take 1 tablet by mouth daily', quantity: 90 } },
      { type: 'prescription', payload: { medication: 'Atorvastatin 80mg', sig: 'Take 1 tablet by mouth at bedtime', quantity: 30 } },
      { type: 'prescription', payload: { medication: 'Clopidogrel 75mg', sig: 'Take 1 tablet by mouth daily', quantity: 30 } }
    ]
  },
  {
    name: 'Heart Failure Admission',
    description: 'Comprehensive orders for heart failure management including labs, imaging, and medications',
    specialty: 'cardiology',
    category: 'inpatient',
    tags: ['heart failure', 'CHF', 'admission', 'inpatient'],
    orders: [
      { type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'NT-proBNP', cpt: '83880', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Comprehensive Metabolic Panel', cpt: '80053', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'TSH', cpt: '84443', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } },
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'prescription', payload: { medication: 'Lisinopril 10mg', sig: 'Take 1 tablet by mouth daily', quantity: 30 } },
      { type: 'prescription', payload: { medication: 'Furosemide 40mg', sig: 'Take 1 tablet by mouth twice daily', quantity: 60 } },
      { type: 'prescription', payload: { medication: 'Metoprolol Succinate 25mg', sig: 'Take 1 tablet by mouth twice daily', quantity: 60 } }
    ]
  },
  {
    name: 'Atrial Fibrillation Management',
    description: 'Orders for AFib workup and management including rate control, rhythm control, and anticoagulation',
    specialty: 'cardiology',
    category: 'arrhythmia',
    tags: ['atrial fibrillation', 'AFib', 'arrhythmia', 'anticoagulation'],
    orders: [
      { type: 'lab', payload: { testName: 'TSH', cpt: '84443', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Comprehensive Metabolic Panel', cpt: '80053', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
      { type: 'imaging', payload: { studyName: 'Holter Monitor 24-Hour', cpt: '93224' } },
      { type: 'prescription', payload: { medication: 'Metoprolol Tartrate 25mg', sig: 'Take 1 tablet by mouth twice daily', quantity: 60 } },
      { type: 'prescription', payload: { medication: 'Apixaban 5mg', sig: 'Take 1 tablet by mouth twice daily', quantity: 60 } }
    ]
  },
  {
    name: 'Chest Pain Workup',
    description: 'Standard chest pain evaluation including cardiac markers, imaging, and ECG',
    specialty: 'cardiology',
    category: 'diagnostic',
    tags: ['chest pain', 'workup', 'diagnostic'],
    orders: [
      { type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'CK-MB', cpt: '82550', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
    ]
  },
  {
    name: 'Hypertension Initial Workup',
    description: 'Comprehensive evaluation for newly diagnosed or uncontrolled hypertension',
    specialty: 'cardiology',
    category: 'diagnostic',
    tags: ['hypertension', 'HTN', 'workup', 'diagnostic'],
    orders: [
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Comprehensive Metabolic Panel', cpt: '80053', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'TSH', cpt: '84443', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Urinalysis', cpt: '81001', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } }
    ]
  },
  {
    name: 'Pre-Cardiac Catheterization',
    description: 'Pre-procedure orders for cardiac catheterization including labs and medications',
    specialty: 'cardiology',
    category: 'procedure',
    tags: ['cardiac cath', 'angiography', 'pre-procedure'],
    orders: [
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'aPTT', cpt: '85730', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } }
    ]
  },
  {
    name: 'Post-Cardiac Catheterization',
    description: 'Post-procedure orders following cardiac catheterization',
    specialty: 'cardiology',
    category: 'procedure',
    tags: ['cardiac cath', 'post-procedure', 'angiography'],
    orders: [
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'prescription', payload: { medication: 'Aspirin 81mg', sig: 'Take 1 tablet by mouth daily', quantity: 90 } },
      { type: 'prescription', payload: { medication: 'Clopidogrel 75mg', sig: 'Take 1 tablet by mouth daily', quantity: 30 } }
    ]
  },
  {
    name: 'Syncope Workup',
    description: 'Comprehensive evaluation for syncope including cardiac and neurological workup',
    specialty: 'cardiology',
    category: 'diagnostic',
    tags: ['syncope', 'workup', 'diagnostic'],
    orders: [
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
      { type: 'imaging', payload: { studyName: 'Holter Monitor 24-Hour', cpt: '93224' } },
      { type: 'imaging', payload: { studyName: 'Tilt Table Test', cpt: '93660' } }
    ]
  },
  {
    name: 'Palpitations Workup',
    description: 'Evaluation for palpitations including arrhythmia monitoring',
    specialty: 'cardiology',
    category: 'diagnostic',
    tags: ['palpitations', 'arrhythmia', 'workup'],
    orders: [
      { type: 'lab', payload: { testName: 'TSH', cpt: '84443', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Holter Monitor 24-Hour', cpt: '93224' } },
      { type: 'imaging', payload: { studyName: 'Event Monitor 30-Day', cpt: '93228' } }
    ]
  },
  {
    name: 'Dyspnea Cardiac Workup',
    description: 'Cardiac evaluation for shortness of breath',
    specialty: 'cardiology',
    category: 'diagnostic',
    tags: ['dyspnea', 'SOB', 'shortness of breath', 'workup'],
    orders: [
      { type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Comprehensive Metabolic Panel', cpt: '80053', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } }
    ]
  }
];

// Generate additional ordersets programmatically to reach 100
const generateAdditionalOrdersets = () => {
  const additional = [];
  const categories = ['diagnostic', 'acute_care', 'inpatient', 'outpatient', 'procedure', 'monitoring'];
  const commonTests = [
    { name: 'Complete Blood Count (CBC)', cpt: '85025', type: 'lab' },
    { name: 'Basic Metabolic Panel', cpt: '80048', type: 'lab' },
    { name: 'Comprehensive Metabolic Panel', cpt: '80053', type: 'lab' },
    { name: 'Lipid Panel', cpt: '80061', type: 'lab' },
    { name: 'Troponin I', cpt: '84484', type: 'lab' },
    { name: 'BNP', cpt: '83880', type: 'lab' },
    { name: 'TSH', cpt: '84443', type: 'lab' },
    { name: 'ECG 12-Lead', cpt: '93000', type: 'imaging' },
    { name: 'Echocardiogram Complete', cpt: '93306', type: 'imaging' },
    { name: 'Chest X-Ray PA and Lateral', cpt: '71020', type: 'imaging' }
  ];

  const conditions = [
    { name: 'Cardiomyopathy Evaluation', tags: ['cardiomyopathy', 'workup'] },
    { name: 'Valvular Heart Disease Workup', tags: ['valvular', 'heart disease'] },
    { name: 'Pericarditis Evaluation', tags: ['pericarditis', 'workup'] },
    { name: 'Endocarditis Workup', tags: ['endocarditis', 'infection'] },
    { name: 'Pulmonary Hypertension Workup', tags: ['pulmonary HTN', 'PH'] },
    { name: 'Cardiac Risk Assessment', tags: ['risk assessment', 'prevention'] },
    { name: 'Pre-Operative Cardiac Clearance', tags: ['pre-op', 'clearance'] },
    { name: 'Post-Operative Cardiac Monitoring', tags: ['post-op', 'monitoring'] },
    { name: 'Cardiac Rehabilitation Referral', tags: ['rehab', 'referral'] },
    { name: 'Anticoagulation Monitoring', tags: ['anticoagulation', 'monitoring'] }
  ];

  conditions.forEach((condition, idx) => {
    const orders = [];
    // Add standard cardiac workup
    orders.push({ type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } });
    orders.push({ type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } });
    orders.push({ type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } });
    
    // Add condition-specific tests
    if (condition.name.includes('Cardiomyopathy') || condition.name.includes('Valvular')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
    }
    if (condition.name.includes('Pulmonary')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } });
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
    }
    if (condition.name.includes('Endocarditis')) {
      orders.push({ type: 'lab', payload: { testName: 'Blood Culture', cpt: '87040', lab: 'Quest' } });
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
    }
    if (condition.name.includes('Anticoagulation')) {
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
    }

    additional.push({
      name: condition.name,
      description: `Standard orders for ${condition.name.toLowerCase()}`,
      specialty: 'cardiology',
      category: categories[idx % categories.length],
      tags: condition.tags,
      orders
    });
  });

  // Add more specific ordersets
  const specificOrdersets = [
    {
      name: 'Statin Initiation Monitoring',
      description: 'Baseline labs before starting statin therapy',
      specialty: 'cardiology',
      category: 'monitoring',
      tags: ['statin', 'cholesterol', 'monitoring'],
      orders: [
        { type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } },
        { type: 'lab', payload: { testName: 'Liver Function Panel', cpt: '80076', lab: 'Quest' } },
        { type: 'lab', payload: { testName: 'CK', cpt: '82550', lab: 'Quest' } }
      ]
    },
    {
      name: 'Warfarin Initiation',
      description: 'Orders for starting warfarin therapy',
      specialty: 'cardiology',
      category: 'monitoring',
      tags: ['warfarin', 'anticoagulation', 'initiation'],
      orders: [
        { type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } },
        { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
        { type: 'prescription', payload: { medication: 'Warfarin 5mg', sig: 'Take 1 tablet by mouth daily', quantity: 30 } }
      ]
    },
    {
      name: 'Cardiac Stress Test',
      description: 'Pre-stress test orders',
      specialty: 'cardiology',
      category: 'diagnostic',
      tags: ['stress test', 'exercise', 'diagnostic'],
      orders: [
        { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
        { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
        { type: 'imaging', payload: { studyName: 'Exercise Stress Test', cpt: '93015' } }
      ]
    },
    {
      name: 'Cardiac CT Angiography',
      description: 'Pre-CT angiography orders',
      specialty: 'cardiology',
      category: 'diagnostic',
      tags: ['CTA', 'angiography', 'diagnostic'],
      orders: [
        { type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } },
        { type: 'lab', payload: { testName: 'eGFR', cpt: '82565', lab: 'Quest' } },
        { type: 'imaging', payload: { studyName: 'CT Angiography Coronary', cpt: '75574' } }
      ]
    },
    {
      name: 'Cardiac MRI',
      description: 'Pre-cardiac MRI orders',
      specialty: 'cardiology',
      category: 'diagnostic',
      tags: ['MRI', 'cardiac', 'diagnostic'],
      orders: [
        { type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } },
        { type: 'lab', payload: { testName: 'eGFR', cpt: '82565', lab: 'Quest' } },
        { type: 'imaging', payload: { studyName: 'Cardiac MRI', cpt: '75557' } }
      ]
    }
  ];

  // Generate 500 more comprehensive cardiology ordersets
  const comprehensiveCardiologyOrdersets = [];
  
  // Arrhythmia ordersets (50)
  const arrhythmias = [
    'Atrial Flutter', 'Ventricular Tachycardia', 'Supraventricular Tachycardia', 'Bradycardia',
    'Sick Sinus Syndrome', 'AV Block First Degree', 'AV Block Second Degree Type I', 'AV Block Second Degree Type II',
    'AV Block Third Degree', 'Wolff-Parkinson-White', 'Long QT Syndrome', 'Brugada Syndrome',
    'Premature Ventricular Contractions', 'Premature Atrial Contractions', 'Multifocal Atrial Tachycardia',
    'Atrial Tachycardia', 'Junctional Rhythm', 'Idioventricular Rhythm', 'Torsades de Pointes',
    'Ventricular Fibrillation', 'Asystole', 'Pulseless Electrical Activity', 'Sinus Tachycardia',
    'Sinus Bradycardia', 'Sinus Arrhythmia', 'Atrial Fibrillation with RVR', 'Atrial Fibrillation Rate Controlled',
    'Atrial Fibrillation Rhythm Controlled', 'Paroxysmal Atrial Fibrillation', 'Persistent Atrial Fibrillation',
    'Permanent Atrial Fibrillation', 'Atrial Fibrillation Post-Ablation', 'Atrial Fibrillation Post-Cardioversion',
    'Ventricular Ectopy', 'Bigeminy', 'Trigeminy', 'Couplets', 'Triplets', 'Non-Sustained VT',
    'Sustained VT', 'Polymorphic VT', 'Monomorphic VT', 'Right Bundle Branch Block',
    'Left Bundle Branch Block', 'Incomplete Right Bundle Branch Block', 'Incomplete Left Bundle Branch Block',
    'Bifascicular Block', 'Trifascicular Block', 'Fascicular Block', 'Hemiblock'
  ];
  
  arrhythmias.forEach((arrhythmia, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
    ];
    
    if (arrhythmia.includes('Atrial') || arrhythmia.includes('SVT') || arrhythmia.includes('Flutter')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Holter Monitor 24-Hour', cpt: '93224' } });
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
      orders.push({ type: 'lab', payload: { testName: 'TSH', cpt: '84443', lab: 'Quest' } });
    }
    
    if (arrhythmia.includes('Ventricular') || arrhythmia.includes('VT') || arrhythmia.includes('VF')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
      orders.push({ type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Electrolyte Panel', cpt: '80051', lab: 'Quest' } });
    }
    
    if (arrhythmia.includes('Bradycardia') || arrhythmia.includes('Block') || arrhythmia.includes('Sick Sinus')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Event Monitor 30-Day', cpt: '93228' } });
      orders.push({ type: 'lab', payload: { testName: 'TSH', cpt: '84443', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: `${arrhythmia} Workup`,
      description: `Evaluation and management of ${arrhythmia.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'arrhythmia',
      tags: [arrhythmia.toLowerCase().replace(/\s+/g, '-'), 'arrhythmia', 'workup'],
      orders
    });
  });
  
  // Heart Failure variants (40)
  const heartFailureTypes = [
    'Heart Failure with Reduced Ejection Fraction', 'Heart Failure with Preserved Ejection Fraction',
    'Heart Failure with Mid-Range Ejection Fraction', 'Acute Decompensated Heart Failure',
    'Chronic Heart Failure', 'Right Heart Failure', 'Left Heart Failure', 'Biventricular Heart Failure',
    'Diastolic Heart Failure', 'Systolic Heart Failure', 'High Output Heart Failure',
    'Low Output Heart Failure', 'Heart Failure NYHA Class I', 'Heart Failure NYHA Class II',
    'Heart Failure NYHA Class III', 'Heart Failure NYHA Class IV', 'Heart Failure Post-MI',
    'Heart Failure Post-CABG', 'Heart Failure Post-Valve Surgery', 'Heart Failure with Cardiomyopathy',
    'Heart Failure with Valvular Disease', 'Heart Failure with Atrial Fibrillation',
    'Heart Failure with Hypertension', 'Heart Failure with Diabetes', 'Heart Failure with CKD',
    'Heart Failure with Anemia', 'Heart Failure with COPD', 'Heart Failure with Sleep Apnea',
    'Heart Failure Optimization', 'Heart Failure Medication Titration', 'Heart Failure Follow-up',
    'Heart Failure Readmission Prevention', 'Heart Failure Device Evaluation', 'Heart Failure Transplant Evaluation',
    'Heart Failure LVAD Evaluation', 'Heart Failure Palliative Care', 'Heart Failure End-of-Life',
    'Heart Failure Family Counseling', 'Heart Failure Dietary Counseling', 'Heart Failure Exercise Prescription'
  ];
  
  heartFailureTypes.forEach((hfType, idx) => {
    const orders = [
      { type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'NT-proBNP', cpt: '83880', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Comprehensive Metabolic Panel', cpt: '80053', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } }
    ];
    
    if (hfType.includes('Acute') || hfType.includes('Decompensated')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } });
      orders.push({ type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } });
    }
    
    if (hfType.includes('Optimization') || hfType.includes('Titration')) {
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Potassium', cpt: '84132', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: hfType,
      description: `Management and evaluation of ${hfType.toLowerCase()}`,
      specialty: 'cardiology',
      category: idx < 5 ? 'acute_care' : 'outpatient',
      tags: ['heart-failure', 'CHF', hfType.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Coronary Artery Disease variants (35)
  const cadVariants = [
    'Stable Angina', 'Unstable Angina', 'Prinzmetal Angina', 'Microvascular Angina',
    'Coronary Artery Disease Single Vessel', 'Coronary Artery Disease Two Vessel',
    'Coronary Artery Disease Three Vessel', 'Coronary Artery Disease Left Main',
    'Coronary Artery Disease Post-PCI', 'Coronary Artery Disease Post-CABG',
    'Coronary Artery Disease Post-Stent', 'Coronary Artery Disease with Heart Failure',
    'Coronary Artery Disease with Arrhythmia', 'Coronary Artery Disease with Diabetes',
    'Coronary Artery Disease with Hypertension', 'Coronary Artery Disease with CKD',
    'Coronary Artery Disease Medical Management', 'Coronary Artery Disease Pre-Cath',
    'Coronary Artery Disease Post-Cath', 'Coronary Artery Disease Follow-up',
    'Acute MI STEMI', 'Acute MI NSTEMI', 'Acute MI Post-PCI', 'Acute MI Post-Thrombolytics',
    'Acute MI Complications', 'Acute MI Follow-up', 'Silent Myocardial Ischemia',
    'Ischemic Cardiomyopathy', 'Hibernating Myocardium', 'Stunned Myocardium',
    'Coronary Artery Spasm', 'Coronary Artery Dissection', 'Coronary Artery Aneurysm',
    'Coronary Artery Fistula', 'Coronary Artery Anomaly'
  ];
  
  cadVariants.forEach((cad, idx) => {
    const orders = [
      { type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
    ];
    
    if (cad.includes('Acute') || cad.includes('Unstable')) {
      orders.push({ type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'CK-MB', cpt: '82550', lab: 'Quest' } });
      orders.push({ type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } });
    }
    
    if (cad.includes('Pre-Cath') || cad.includes('Post-Cath')) {
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: `${cad} Management`,
      description: `Evaluation and management of ${cad.toLowerCase()}`,
      specialty: 'cardiology',
      category: cad.includes('Acute') ? 'acute_care' : 'outpatient',
      tags: ['CAD', 'coronary-artery-disease', cad.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Valvular Heart Disease (40)
  const valvularDiseases = [
    'Aortic Stenosis', 'Aortic Regurgitation', 'Aortic Stenosis and Regurgitation',
    'Mitral Stenosis', 'Mitral Regurgitation', 'Mitral Stenosis and Regurgitation',
    'Mitral Valve Prolapse', 'Tricuspid Stenosis', 'Tricuspid Regurgitation',
    'Pulmonic Stenosis', 'Pulmonic Regurgitation', 'Aortic Valve Replacement Follow-up',
    'Mitral Valve Replacement Follow-up', 'Tricuspid Valve Replacement Follow-up',
    'Aortic Valve Repair Follow-up', 'Mitral Valve Repair Follow-up',
    'Bioprosthetic Valve', 'Mechanical Valve', 'Valve Thrombosis',
    'Prosthetic Valve Endocarditis', 'Native Valve Endocarditis',
    'Rheumatic Heart Disease', 'Bicuspid Aortic Valve', 'Quadricuspid Aortic Valve',
    'Ebstein Anomaly', 'Tricuspid Atresia', 'Pulmonary Atresia', 'Aortic Atresia',
    'Mitral Atresia', 'Valvular Heart Disease Pre-Surgery', 'Valvular Heart Disease Post-Surgery',
    'Valvular Heart Disease with Heart Failure', 'Valvular Heart Disease with Arrhythmia',
    'Severe Aortic Stenosis', 'Moderate Aortic Stenosis', 'Mild Aortic Stenosis',
    'Severe Mitral Regurgitation', 'Moderate Mitral Regurgitation', 'Mild Mitral Regurgitation',
    'Valvular Heart Disease Surveillance'
  ];
  
  valvularDiseases.forEach((valve, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } }
    ];
    
    if (valve.includes('Endocarditis')) {
      orders.push({ type: 'lab', payload: { testName: 'Blood Culture', cpt: '87040', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'ESR', cpt: '85652', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'CRP', cpt: '86140', lab: 'Quest' } });
    }
    
    if (valve.includes('Post-Surgery') || valve.includes('Replacement') || valve.includes('Repair')) {
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: `${valve} Evaluation`,
      description: `Evaluation and management of ${valve.toLowerCase()}`,
      specialty: 'cardiology',
      category: valve.includes('Endocarditis') ? 'acute_care' : 'outpatient',
      tags: ['valvular', 'valve-disease', valve.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Cardiomyopathy types (30)
  const cardiomyopathies = [
    'Dilated Cardiomyopathy', 'Hypertrophic Cardiomyopathy', 'Restrictive Cardiomyopathy',
    'Arrhythmogenic Right Ventricular Cardiomyopathy', 'Takotsubo Cardiomyopathy',
    'Peripartum Cardiomyopathy', 'Alcoholic Cardiomyopathy', 'Chemotherapy-Induced Cardiomyopathy',
    'Ischemic Cardiomyopathy', 'Non-Ischemic Cardiomyopathy', 'Idiopathic Cardiomyopathy',
    'Familial Cardiomyopathy', 'Genetic Cardiomyopathy', 'Inflammatory Cardiomyopathy',
    'Viral Cardiomyopathy', 'Autoimmune Cardiomyopathy', 'Metabolic Cardiomyopathy',
    'Toxic Cardiomyopathy', 'Stress-Induced Cardiomyopathy', 'Tachycardia-Induced Cardiomyopathy',
    'Obesity-Related Cardiomyopathy', 'Diabetic Cardiomyopathy', 'Hypertensive Cardiomyopathy',
    'Cardiomyopathy with Heart Failure', 'Cardiomyopathy with Arrhythmia',
    'Cardiomyopathy Family Screening', 'Cardiomyopathy Genetic Testing',
    'Cardiomyopathy Pre-Transplant', 'Cardiomyopathy LVAD Evaluation',
    'Cardiomyopathy Medication Optimization'
  ];
  
  cardiomyopathies.forEach((cm, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Comprehensive Metabolic Panel', cpt: '80053', lab: 'Quest' } }
    ];
    
    if (cm.includes('Genetic') || cm.includes('Familial') || cm.includes('Family Screening')) {
      orders.push({ type: 'lab', payload: { testName: 'Genetic Testing Panel', cpt: '81479', lab: 'Quest' } });
    }
    
    if (cm.includes('Inflammatory') || cm.includes('Viral')) {
      orders.push({ type: 'lab', payload: { testName: 'ESR', cpt: '85652', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'CRP', cpt: '86140', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: `${cm} Workup`,
      description: `Comprehensive evaluation of ${cm.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'diagnostic',
      tags: ['cardiomyopathy', cm.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Pericardial diseases (20)
  const pericardialDiseases = [
    'Acute Pericarditis', 'Chronic Pericarditis', 'Recurrent Pericarditis',
    'Constrictive Pericarditis', 'Effusive-Constrictive Pericarditis',
    'Pericardial Effusion', 'Large Pericardial Effusion', 'Cardiac Tamponade',
    'Post-Pericardiotomy Syndrome', 'Post-MI Pericarditis', 'Dressler Syndrome',
    'Uremic Pericarditis', 'Malignant Pericardial Effusion',
    'Idiopathic Pericarditis', 'Viral Pericarditis', 'Bacterial Pericarditis',
    'Tuberculous Pericarditis', 'Autoimmune Pericarditis', 'Radiation Pericarditis',
    'Pericardial Cyst'
  ];
  
  pericardialDiseases.forEach((pericardial, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'ESR', cpt: '85652', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'CRP', cpt: '86140', lab: 'Quest' } }
    ];
    
    if (pericardial.includes('Tamponade') || pericardial.includes('Large Effusion')) {
      orders.push({ type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: `${pericardial} Evaluation`,
      description: `Evaluation and management of ${pericardial.toLowerCase()}`,
      specialty: 'cardiology',
      category: pericardial.includes('Acute') || pericardial.includes('Tamponade') ? 'acute_care' : 'outpatient',
      tags: ['pericarditis', 'pericardial', pericardial.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Pulmonary hypertension (25)
  const phTypes = [
    'Pulmonary Arterial Hypertension', 'Pulmonary Hypertension Group 1',
    'Pulmonary Hypertension Group 2', 'Pulmonary Hypertension Group 3',
    'Pulmonary Hypertension Group 4', 'Pulmonary Hypertension Group 5',
    'Idiopathic Pulmonary Hypertension', 'Familial Pulmonary Hypertension',
    'Pulmonary Hypertension with Connective Tissue Disease', 'Pulmonary Hypertension with Portal Hypertension',
    'Pulmonary Hypertension with Congenital Heart Disease', 'Pulmonary Hypertension with Left Heart Disease',
    'Pulmonary Hypertension with Lung Disease', 'Pulmonary Hypertension with Chronic Thromboembolism',
    'Pulmonary Hypertension with Sarcoidosis', 'Pulmonary Hypertension with HIV',
    'Pulmonary Hypertension with Schistosomiasis', 'Pulmonary Hypertension with Hemolytic Anemia',
    'Chronic Thromboembolic Pulmonary Hypertension', 'Pulmonary Hypertension Pre-Transplant',
    'Pulmonary Hypertension Medication Initiation', 'Pulmonary Hypertension Follow-up',
    'Pulmonary Hypertension Right Heart Catheterization', 'Pulmonary Hypertension 6-Minute Walk Test',
    'Pulmonary Hypertension Functional Assessment'
  ];
  
  phTypes.forEach((ph, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } },
      { type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } }
    ];
    
    if (ph.includes('Catheterization')) {
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: `${ph} Workup`,
      description: `Evaluation and management of ${ph.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'diagnostic',
      tags: ['pulmonary-hypertension', 'PH', ph.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Congenital heart disease (30)
  const congenitalHeartDiseases = [
    'Atrial Septal Defect', 'Ventricular Septal Defect', 'Patent Ductus Arteriosus',
    'Atrioventricular Septal Defect', 'Tetralogy of Fallot', 'Transposition of Great Arteries',
    'Truncus Arteriosus', 'Hypoplastic Left Heart Syndrome', 'Coarctation of Aorta',
    'Aortic Stenosis Congenital', 'Pulmonary Stenosis Congenital', 'Ebstein Anomaly',
    'Double Outlet Right Ventricle', 'Double Outlet Left Ventricle', 'Single Ventricle',
    'Total Anomalous Pulmonary Venous Return', 'Partial Anomalous Pulmonary Venous Return',
    'Anomalous Coronary Artery', 'Coronary Artery Fistula', 'Kawasaki Disease',
    'Marfan Syndrome Cardiac', 'Ehlers-Danlos Vascular Type', 'Loeys-Dietz Syndrome',
    'Congenital Heart Disease Adult', 'Congenital Heart Disease Pediatric',
    'Congenital Heart Disease Post-Repair', 'Congenital Heart Disease Follow-up',
    'Congenital Heart Disease Pregnancy', 'Congenital Heart Disease Family Screening',
    'Congenital Heart Disease Genetic Testing'
  ];
  
  congenitalHeartDiseases.forEach((chd, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
    ];
    
    if (chd.includes('Genetic') || chd.includes('Family Screening')) {
      orders.push({ type: 'lab', payload: { testName: 'Genetic Testing Panel', cpt: '81479', lab: 'Quest' } });
    }
    
    if (chd.includes('Marfan') || chd.includes('Ehlers-Danlos') || chd.includes('Loeys-Dietz')) {
      orders.push({ type: 'imaging', payload: { studyName: 'CT Angiography Aorta', cpt: '71275' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: `${chd} Evaluation`,
      description: `Evaluation and management of ${chd.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'diagnostic',
      tags: ['congenital-heart-disease', 'CHD', chd.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Cardiac procedures and device management (40)
  const procedures = [
    'Pacemaker Implantation Pre-Op', 'Pacemaker Implantation Post-Op',
    'Pacemaker Interrogation', 'Pacemaker Programming', 'Pacemaker Battery Check',
    'ICD Implantation Pre-Op', 'ICD Implantation Post-Op', 'ICD Interrogation',
    'ICD Programming', 'ICD Shock Analysis', 'ICD Battery Check',
    'CRT-P Implantation', 'CRT-D Implantation', 'CRT Interrogation',
    'CRT Optimization', 'Cardiac Catheterization Left Heart', 'Cardiac Catheterization Right Heart',
    'Cardiac Catheterization Both', 'Coronary Angiography', 'PCI Single Vessel',
    'PCI Multi-Vessel', 'PCI Left Main', 'PCI Post-Procedure', 'CABG Pre-Op',
    'CABG Post-Op', 'Valve Replacement Aortic', 'Valve Replacement Mitral',
    'Valve Replacement Tricuspid', 'Valve Repair Mitral', 'Valve Repair Tricuspid',
    'TAVR Pre-Procedure', 'TAVR Post-Procedure', 'MitraClip Pre-Procedure',
    'MitraClip Post-Procedure', 'Cardiac Ablation Atrial Fibrillation',
    'Cardiac Ablation SVT', 'Cardiac Ablation VT', 'Cardiac Ablation Post-Procedure',
    'Cardiac Biopsy', 'Pericardiocentesis', 'Cardiac Resynchronization Therapy'
  ];
  
  procedures.forEach((procedure, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
    ];
    
    if (procedure.includes('Pre-Op') || procedure.includes('Pre-Procedure')) {
      orders.push({ type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
    }
    
    if (procedure.includes('Post-Op') || procedure.includes('Post-Procedure')) {
      orders.push({ type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } });
      orders.push({ type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } });
    }
    
    if (procedure.includes('Pacemaker') || procedure.includes('ICD') || procedure.includes('CRT')) {
      if (procedure.includes('Interrogation') || procedure.includes('Programming') || procedure.includes('Battery')) {
        // Device check - minimal orders
      } else {
        orders.push({ type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } });
      }
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: procedure,
      description: `Orders for ${procedure.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'procedure',
      tags: ['procedure', procedure.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Diagnostic tests and monitoring (50)
  const diagnosticTests = [
    'Exercise Stress Test', 'Pharmacologic Stress Test', 'Dobutamine Stress Echo',
    'Exercise Stress Echo', 'Nuclear Stress Test', 'Cardiac PET Scan',
    'Cardiac CT Calcium Score', 'Cardiac CT Angiography', 'Cardiac MRI',
    'Cardiac MRI with Contrast', 'Transesophageal Echocardiogram', 'Stress Echocardiogram',
    '3D Echocardiogram', 'Contrast Echocardiogram', 'Tissue Doppler Echocardiogram',
    'Strain Echocardiogram', 'Holter Monitor 24-Hour', 'Holter Monitor 48-Hour',
    'Event Monitor 7-Day', 'Event Monitor 14-Day', 'Event Monitor 30-Day',
    'Loop Recorder Implantation', 'Loop Recorder Interrogation', 'Zio Patch',
    'Tilt Table Test', 'Electrophysiology Study', 'Ablation Mapping',
    'Fractional Flow Reserve', 'Instantaneous Wave-Free Ratio', 'Optical Coherence Tomography',
    'Intravascular Ultrasound', 'Coronary Angioscopy', 'Cardiac Catheterization Hemodynamics',
    'Right Heart Catheterization', 'Left Heart Catheterization', 'Endomyocardial Biopsy',
    'Pericardial Biopsy', 'Cardiac Biomarker Panel', 'High-Sensitivity Troponin',
    'BNP Serial Monitoring', 'NT-proBNP Serial Monitoring', 'Lipid Panel Advanced',
    'Lipoprotein(a)', 'Apolipoprotein B', 'Homocysteine', 'C-Reactive Protein High Sensitivity',
    'Cardiac Genetic Panel', 'Pharmacogenetic Testing', 'Warfarin Sensitivity Testing',
    'Clopidogrel Resistance Testing', 'Platelet Function Testing'
  ];
  
  diagnosticTests.forEach((test, idx) => {
    const orders = [];
    
    if (test.includes('Stress') || test.includes('Exercise')) {
      orders.push({ type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } });
      orders.push({ type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } });
    }
    
    if (test.includes('Echo') || test.includes('Echocardiogram')) {
      orders.push({ type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } });
    }
    
    if (test.includes('CT') || test.includes('MRI') || test.includes('Angiography')) {
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'eGFR', cpt: '82565', lab: 'Quest' } });
    }
    
    if (test.includes('Catheterization') || test.includes('Biopsy')) {
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } });
    }
    
    if (test.includes('Monitor') || test.includes('Recorder')) {
      orders.push({ type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } });
    }
    
    if (test.includes('Biomarker') || test.includes('Troponin') || test.includes('BNP')) {
      orders.push({ type: 'lab', payload: { testName: test.includes('BNP') ? 'BNP' : 'Troponin I', cpt: test.includes('BNP') ? '83880' : '84484', lab: 'Quest' } });
    }
    
    if (orders.length === 0) {
      orders.push({ type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: test,
      description: `Orders for ${test.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'diagnostic',
      tags: ['diagnostic', 'testing', test.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Medication management (40)
  const medicationScenarios = [
    'Anticoagulation Initiation', 'Anticoagulation Monitoring', 'Warfarin Dosing',
    'DOAC Initiation', 'DOAC Monitoring', 'Dual Antiplatelet Therapy',
    'Triple Therapy Anticoagulation', 'Statin Initiation', 'Statin Monitoring',
    'Statin Intolerance Workup', 'ACE Inhibitor Initiation', 'ACE Inhibitor Titration',
    'ARB Initiation', 'ARB Titration', 'Beta Blocker Initiation',
    'Beta Blocker Titration', 'Calcium Channel Blocker Initiation', 'Diuretic Initiation',
    'Diuretic Titration', 'Digoxin Initiation', 'Digoxin Monitoring',
    'Amiodarone Initiation', 'Amiodarone Monitoring', 'Sotalol Initiation',
    'Flecainide Initiation', 'Propafenone Initiation', 'Dofetilide Initiation',
    'Ivabradine Initiation', 'Sacubitril-Valsartan Initiation', 'Sacubitril-Valsartan Titration',
    'Entresto Optimization', 'SGLT2 Inhibitor Initiation', 'Eplerenone Initiation',
    'Spironolactone Initiation', 'Hydralazine-Nitrate Initiation', 'Ivabradine Titration',
    'Heart Failure Medication Optimization', 'Hypertension Medication Optimization',
    'Arrhythmia Medication Optimization', 'Medication Reconciliation'
  ];
  
  medicationScenarios.forEach((med, idx) => {
    const orders = [];
    
    if (med.includes('Anticoagulation') || med.includes('Warfarin') || med.includes('DOAC')) {
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } });
    }
    
    if (med.includes('Statin')) {
      orders.push({ type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Liver Function Panel', cpt: '80076', lab: 'Quest' } });
      if (med.includes('Initiation')) {
        orders.push({ type: 'lab', payload: { testName: 'CK', cpt: '82550', lab: 'Quest' } });
      }
    }
    
    if (med.includes('ACE') || med.includes('ARB') || med.includes('Sacubitril')) {
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Potassium', cpt: '84132', lab: 'Quest' } });
    }
    
    if (med.includes('Digoxin')) {
      orders.push({ type: 'lab', payload: { testName: 'Digoxin Level', cpt: '80162', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Potassium', cpt: '84132', lab: 'Quest' } });
    }
    
    if (med.includes('Amiodarone')) {
      orders.push({ type: 'lab', payload: { testName: 'TSH', cpt: '84443', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Liver Function Panel', cpt: '80076', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Chest X-Ray PA and Lateral', cpt: '71020' } });
    }
    
    if (med.includes('Dofetilide') || med.includes('Sotalol')) {
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Electrolyte Panel', cpt: '80051', lab: 'Quest' } });
      orders.push({ type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } });
    }
    
    if (med.includes('Eplerenone') || med.includes('Spironolactone')) {
      orders.push({ type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Potassium', cpt: '84132', lab: 'Quest' } });
    }
    
    if (orders.length === 0) {
      orders.push({ type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: med,
      description: `Orders for ${med.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'monitoring',
      tags: ['medication', 'management', med.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Risk assessment and prevention (25)
  const riskAssessments = [
    'Cardiovascular Risk Assessment', '10-Year ASCVD Risk Calculation',
    'Lifetime ASCVD Risk', 'Coronary Calcium Score Screening', 'Lipid Screening',
    'Hypertension Screening', 'Diabetes Cardiovascular Risk', 'Metabolic Syndrome Evaluation',
    'Obesity Cardiovascular Risk', 'Smoking Cessation Cardiac', 'Exercise Prescription',
    'Cardiac Rehabilitation Referral', 'Nutrition Counseling Cardiac',
    'Weight Management Cardiac', 'Sleep Apnea Cardiac Screening', 'Depression Cardiac Screening',
    'Anxiety Cardiac Screening', 'Stress Management Cardiac', 'Medication Adherence Assessment',
    'Fall Risk Assessment Cardiac', 'Frailty Assessment Cardiac', 'Cognitive Assessment Cardiac',
    'Quality of Life Assessment', 'Functional Capacity Assessment', 'Preventive Cardiology Visit'
  ];
  
  riskAssessments.forEach((risk, idx) => {
    const orders = [
      { type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
    ];
    
    if (risk.includes('Calcium Score') || risk.includes('Screening')) {
      orders.push({ type: 'lab', payload: { testName: 'HbA1c', cpt: '83036', lab: 'Quest' } });
    }
    
    if (risk.includes('Sleep Apnea')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Sleep Study', cpt: '95810' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: risk,
      description: `Evaluation for ${risk.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'prevention',
      tags: ['risk-assessment', 'prevention', risk.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Special populations (30)
  const specialPopulations = [
    'Pregnancy Cardiac Evaluation', 'Postpartum Cardiac Evaluation',
    'Cardiac Disease in Pregnancy', 'Peripartum Cardiomyopathy',
    'Cardiac Disease Postpartum', 'Elderly Cardiac Evaluation',
    'Geriatric Cardiology', 'Cardiac Disease Elderly', 'Frailty Cardiac',
    'Pediatric Cardiology', 'Adolescent Cardiology', 'Young Adult Cardiac',
    'Athlete Cardiac Screening', 'Athlete Pre-Participation', 'Athlete Arrhythmia',
    'Athlete Sudden Death Risk', 'Female Cardiac Disease', 'Women Heart Disease',
    'Menopause Cardiac', 'Hormone Replacement Cardiac', 'Pregnancy Hypertension',
    'Pregnancy Preeclampsia Cardiac', 'Cancer Cardiac', 'Cardio-Oncology',
    'Chemotherapy Cardiac Monitoring', 'Radiation Cardiac Monitoring',
    'Transplant Cardiac Evaluation', 'ESRD Cardiac', 'Dialysis Cardiac',
    'Liver Disease Cardiac', 'Thyroid Cardiac'
  ];
  
  specialPopulations.forEach((pop, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
    ];
    
    if (pop.includes('Pregnancy') || pop.includes('Postpartum') || pop.includes('Peripartum')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
      orders.push({ type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } });
    }
    
    if (pop.includes('Athlete')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
      orders.push({ type: 'imaging', payload: { studyName: 'Exercise Stress Test', cpt: '93015' } });
    }
    
    if (pop.includes('Cancer') || pop.includes('Oncology') || pop.includes('Chemotherapy')) {
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
      orders.push({ type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: `${pop} Workup`,
      description: `Cardiac evaluation for ${pop.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'outpatient',
      tags: ['special-population', pop.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Emergency and acute care (30)
  const acuteCare = [
    'Chest Pain ER', 'Acute MI ER', 'STEMI Activation', 'NSTEMI Management',
    'Unstable Angina ER', 'Cardiac Arrest', 'Ventricular Fibrillation ER',
    'Pulseless VT ER', 'Bradycardia ER', 'Tachycardia ER', 'Atrial Fibrillation RVR ER',
    'Heart Failure Acute ER', 'Cardiac Tamponade ER', 'Aortic Dissection',
    'Aortic Aneurysm Rupture', 'Pulmonary Embolism Cardiac', 'Massive PE',
    'Hypertensive Emergency', 'Hypertensive Urgency', 'Cardiogenic Shock',
    'Cardiac Arrest Post-ROSC', 'Takotsubo ER', 'Myocarditis Acute',
    'Pericarditis Acute ER', 'Endocarditis Acute', 'Valve Thrombosis Acute',
    'Prosthetic Valve Dysfunction', 'Device Malfunction', 'Lead Failure',
    'Infection Cardiac Device', 'Cardiac Trauma'
  ];
  
  acuteCare.forEach((acute, idx) => {
    const orders = [
      { type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
      { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
      { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } }
    ];
    
    if (acute.includes('MI') || acute.includes('STEMI') || acute.includes('NSTEMI')) {
      orders.push({ type: 'lab', payload: { testName: 'CK-MB', cpt: '82550', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
    }
    
    if (acute.includes('Heart Failure') || acute.includes('Shock')) {
      orders.push({ type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } });
      orders.push({ type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } });
    }
    
    if (acute.includes('Aortic') || acute.includes('Dissection')) {
      orders.push({ type: 'imaging', payload: { studyName: 'CT Angiography Aorta', cpt: '71275' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: acute,
      description: `Emergency management of ${acute.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'acute_care',
      tags: ['acute', 'emergency', 'ER', acute.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  // Follow-up and routine care (30)
  const followUps = [
    'Post-MI 1-Week Follow-up', 'Post-MI 1-Month Follow-up', 'Post-MI 3-Month Follow-up',
    'Post-MI 6-Month Follow-up', 'Post-MI 1-Year Follow-up', 'Post-PCI Follow-up',
    'Post-CABG Follow-up', 'Post-Valve Surgery Follow-up', 'Post-Ablation Follow-up',
    'Heart Failure Routine Follow-up', 'Hypertension Follow-up', 'Atrial Fibrillation Follow-up',
    'Anticoagulation Follow-up', 'Statin Follow-up', 'Device Follow-up',
    'Cardiac Rehabilitation Follow-up', 'Transplant Follow-up', 'LVAD Follow-up',
    'Routine Cardiology Visit', 'Annual Cardiac Check', 'Cardiac Clearance',
    'Pre-Surgery Cardiac Clearance', 'Pre-Procedure Cardiac Clearance',
    'Cardiac Second Opinion', 'Cardiac Consultation', 'Telemedicine Cardiac',
    'Cardiac Nurse Visit', 'Cardiac Education', 'Medication Review Cardiac',
    'Cardiac Care Plan Review'
  ];
  
  followUps.forEach((followup, idx) => {
    const orders = [
      { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
    ];
    
    if (followup.includes('Post-MI') || followup.includes('Post-PCI') || followup.includes('Post-CABG')) {
      orders.push({ type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } });
      orders.push({ type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } });
    }
    
    if (followup.includes('Heart Failure')) {
      orders.push({ type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } });
    }
    
    if (followup.includes('Anticoagulation')) {
      orders.push({ type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } });
    }
    
    comprehensiveCardiologyOrdersets.push({
      name: followup,
      description: `Follow-up visit for ${followup.toLowerCase()}`,
      specialty: 'cardiology',
      category: 'outpatient',
      tags: ['follow-up', 'routine', followup.toLowerCase().replace(/\s+/g, '-')],
      orders
    });
  });
  
  return [...additional, ...specificOrdersets, ...comprehensiveCardiologyOrdersets];
};

async function seedOrdersets() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const allOrdersets = [...cardiologyOrdersets, ...generateAdditionalOrdersets()];
    
    // Add more unique ordersets to reach 100
    const moreOrdersets = [
      { name: 'Acute MI Post-PCI', description: 'Post-PCI orders for acute MI', specialty: 'cardiology', category: 'procedure', tags: ['MI', 'PCI', 'post-procedure'], orders: [
        { type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } },
        { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
        { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
        { type: 'prescription', payload: { medication: 'Aspirin 81mg', sig: 'Take 1 tablet by mouth daily', quantity: 90 } },
        { type: 'prescription', payload: { medication: 'Clopidogrel 75mg', sig: 'Take 1 tablet by mouth daily', quantity: 30 } }
      ]},
      { name: 'Cardiac Transplant Evaluation', description: 'Pre-transplant cardiac evaluation', specialty: 'cardiology', category: 'diagnostic', tags: ['transplant', 'evaluation'], orders: [
        { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
        { type: 'lab', payload: { testName: 'Comprehensive Metabolic Panel', cpt: '80053', lab: 'Quest' } },
        { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
        { type: 'imaging', payload: { studyName: 'Cardiac Catheterization', cpt: '93458' } }
      ]},
      { name: 'Cardiac Device Follow-up', description: 'Routine follow-up for pacemaker/ICD', specialty: 'cardiology', category: 'monitoring', tags: ['pacemaker', 'ICD', 'device'], orders: [
        { type: 'imaging', payload: { studyName: 'Device Interrogation', cpt: '93279' } },
        { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
      ]},
      { name: 'Cardiac Rehabilitation Initial', description: 'Initial cardiac rehab evaluation', specialty: 'cardiology', category: 'outpatient', tags: ['rehab', 'exercise'], orders: [
        { type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } },
        { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
        { type: 'imaging', payload: { studyName: 'Exercise Stress Test', cpt: '93015' } }
      ]},
      { name: 'Hypertensive Urgency', description: 'Orders for hypertensive urgency management', specialty: 'cardiology', category: 'acute_care', tags: ['hypertension', 'urgency'], orders: [
        { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
        { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
        { type: 'prescription', payload: { medication: 'Lisinopril 10mg', sig: 'Take 1 tablet by mouth daily', quantity: 30 } }
      ]}
    ];
    
    allOrdersets.push(...moreOrdersets);
    
    // Generate remaining unique ordersets
    const baseNames = [
      'Cardiac Arrhythmia Workup', 'Pericardial Effusion Evaluation', 'Cardiac Tamponade',
      'Myocarditis Workup', 'Cardiac Sarcoidosis Evaluation', 'Amyloidosis Cardiac Workup',
      'Takotsubo Cardiomyopathy', 'Stress Cardiomyopathy', 'Peripartum Cardiomyopathy',
      'Dilated Cardiomyopathy Follow-up', 'Hypertrophic Cardiomyopathy Evaluation',
      'Restrictive Cardiomyopathy Workup', 'Arrhythmogenic Right Ventricular Dysplasia',
      'Cardiac Amyloidosis', 'Fabry Disease Cardiac', 'Cardiac Iron Overload',
      'Chagas Disease Cardiac', 'Lyme Carditis', 'Rheumatic Heart Disease',
      'Marfan Syndrome Cardiac', 'Ehlers-Danlos Cardiac', 'Loeys-Dietz Cardiac',
      'Cardiac Tumor Evaluation', 'Cardiac Metastasis Workup', 'Primary Cardiac Tumor',
      'Cardiac Trauma Evaluation', 'Blunt Cardiac Injury', 'Penetrating Cardiac Injury',
      'Cardiac Contusion', 'Aortic Dissection Type A', 'Aortic Dissection Type B',
      'Aortic Aneurysm Surveillance', 'Thoracic Aortic Aneurysm', 'Abdominal Aortic Aneurysm',
      'Carotid Artery Disease', 'Peripheral Artery Disease', 'Renal Artery Stenosis',
      'Mesenteric Ischemia', 'Acute Limb Ischemia', 'Chronic Limb Ischemia',
      'Venous Thromboembolism', 'Deep Vein Thrombosis', 'Pulmonary Embolism',
      'Superior Vena Cava Syndrome', 'Inferior Vena Cava Syndrome', 'Cardiac Cachexia',
      'Cardiac Depression Screening', 'Cardiac Anxiety Evaluation', 'Cardiac Sleep Apnea',
      'Obesity Cardiomyopathy', 'Diabetic Cardiomyopathy', 'Alcoholic Cardiomyopathy',
      'Chemotherapy Cardiotoxicity', 'Radiation Cardiotoxicity', 'Drug-Induced Cardiomyopathy',
      'Cardiac Allograft Rejection', 'Cardiac Allograft Vasculopathy', 'Post-Transplant Infection',
      'Cardiac Device Infection', 'Endocarditis Prophylaxis', 'Rheumatic Fever Prophylaxis',
      'Infective Endocarditis', 'Non-Infective Endocarditis', 'Libman-Sacks Endocarditis',
      'Cardiac Biopsy', 'Cardiac Catheterization Right Heart', 'Cardiac Catheterization Left Heart',
      'Intracardiac Pressure Monitoring', 'Cardiac Output Measurement', 'Swan-Ganz Catheter',
      'Intra-Aortic Balloon Pump', 'ECMO Evaluation', 'LVAD Evaluation',
      'Heart Transplant Candidate', 'Heart-Lung Transplant', 'Cardiac Resynchronization Therapy',
      'Ablation Pre-Procedure', 'Ablation Post-Procedure', 'Cardiac Defibrillator Implant',
      'Pacemaker Implant', 'Lead Extraction', 'Device Upgrade',
      'Cardiac Genetic Testing', 'Familial Cardiomyopathy', 'Inherited Arrhythmia',
      'Long QT Syndrome', 'Brugada Syndrome', 'Catecholaminergic Polymorphic VT',
      'Short QT Syndrome', 'Early Repolarization', 'Idiopathic Ventricular Fibrillation'
    ];
    
    baseNames.forEach((baseName, idx) => {
      if (allOrdersets.length >= 100) return;
      allOrdersets.push({
        name: baseName,
        description: `Standard orders for ${baseName.toLowerCase()}`,
        specialty: 'cardiology',
        category: ['diagnostic', 'acute_care', 'inpatient', 'outpatient', 'procedure', 'monitoring'][idx % 6],
        tags: [baseName.toLowerCase().split(' ')[0], 'cardiology'],
        orders: [
          { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
          { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
          { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } }
        ]
      });
    });
    
    // Generate 500 additional common cardiology ordersets
    const generate500CardiologyOrdersets = () => {
      const additionalOrdersets = [];
      const categories = ['diagnostic', 'acute_care', 'inpatient', 'outpatient', 'procedure', 'monitoring'];
      
      // Common cardiology conditions and scenarios
      const commonScenarios = [
        // Heart Failure variations
        { name: 'Heart Failure with Reduced EF', tags: ['HFrEF', 'heart failure'], orders: ['BNP', 'Echo', 'ECG', 'CMP'] },
        { name: 'Heart Failure with Preserved EF', tags: ['HFpEF', 'heart failure'], orders: ['BNP', 'Echo', 'ECG', 'CMP'] },
        { name: 'Heart Failure with Mid-Range EF', tags: ['HFmrEF', 'heart failure'], orders: ['BNP', 'Echo', 'ECG', 'CMP'] },
        { name: 'Acute Decompensated Heart Failure', tags: ['ADHF', 'heart failure'], orders: ['BNP', 'Troponin', 'Chest X-Ray', 'ECG'] },
        { name: 'Chronic Heart Failure Follow-up', tags: ['CHF', 'follow-up'], orders: ['BNP', 'CMP', 'ECG'] },
        { name: 'Heart Failure Medication Adjustment', tags: ['CHF', 'medication'], orders: ['CMP', 'Creatinine', 'BNP', 'ECG'] },
        
        // Arrhythmias
        { name: 'Atrial Fibrillation Rate Control', tags: ['AFib', 'rate control'], orders: ['ECG', 'TSH', 'CMP', 'PT/INR'] },
        { name: 'Atrial Fibrillation Rhythm Control', tags: ['AFib', 'rhythm control'], orders: ['ECG', 'Echo', 'Holter', 'TSH'] },
        { name: 'Atrial Flutter Workup', tags: ['atrial flutter', 'arrhythmia'], orders: ['ECG', 'Echo', 'Holter'] },
        { name: 'Supraventricular Tachycardia', tags: ['SVT', 'arrhythmia'], orders: ['ECG', 'Echo', 'Holter', 'TSH'] },
        { name: 'Ventricular Tachycardia Evaluation', tags: ['VT', 'arrhythmia'], orders: ['ECG', 'Echo', 'Holter', 'Troponin'] },
        { name: 'Bradycardia Workup', tags: ['bradycardia', 'arrhythmia'], orders: ['ECG', 'TSH', 'CMP', 'Holter'] },
        { name: 'Sick Sinus Syndrome', tags: ['SSS', 'arrhythmia'], orders: ['ECG', 'Holter', 'Echo'] },
        { name: 'AV Block Evaluation', tags: ['AV block', 'arrhythmia'], orders: ['ECG', 'Holter', 'Echo'] },
        { name: 'Wolff-Parkinson-White Syndrome', tags: ['WPW', 'arrhythmia'], orders: ['ECG', 'Echo', 'EP Study'] },
        { name: 'Long QT Syndrome Monitoring', tags: ['LQTS', 'arrhythmia'], orders: ['ECG', 'QTc', 'Genetic Test'] },
        
        // Coronary Artery Disease
        { name: 'Stable Angina Management', tags: ['angina', 'CAD'], orders: ['ECG', 'Lipid Panel', 'Stress Test'] },
        { name: 'Unstable Angina Workup', tags: ['unstable angina', 'CAD'], orders: ['Troponin', 'ECG', 'Chest X-Ray'] },
        { name: 'Post-MI Follow-up', tags: ['MI', 'follow-up'], orders: ['Lipid Panel', 'ECG', 'Echo'] },
        { name: 'Post-PCI Follow-up', tags: ['PCI', 'follow-up'], orders: ['Lipid Panel', 'ECG', 'CBC'] },
        { name: 'Post-CABG Follow-up', tags: ['CABG', 'follow-up'], orders: ['Lipid Panel', 'ECG', 'Echo'] },
        { name: 'Coronary Artery Disease Screening', tags: ['CAD', 'screening'], orders: ['Lipid Panel', 'ECG', 'Calcium Score'] },
        
        // Hypertension
        { name: 'Hypertension Follow-up', tags: ['HTN', 'follow-up'], orders: ['CMP', 'ECG'] },
        { name: 'Resistant Hypertension Workup', tags: ['resistant HTN', 'hypertension'], orders: ['CMP', 'Aldosterone', 'Renin', 'Echo'] },
        { name: 'Secondary Hypertension Workup', tags: ['secondary HTN', 'hypertension'], orders: ['CMP', 'Aldosterone', 'Renin', 'TSH'] },
        { name: 'Hypertensive Emergency', tags: ['HTN emergency', 'hypertension'], orders: ['CMP', 'ECG', 'Chest X-Ray'] },
        
        // Valvular Heart Disease
        { name: 'Aortic Stenosis Evaluation', tags: ['AS', 'valvular'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Aortic Regurgitation Evaluation', tags: ['AR', 'valvular'], orders: ['Echo', 'ECG'] },
        { name: 'Mitral Stenosis Evaluation', tags: ['MS', 'valvular'], orders: ['Echo', 'ECG'] },
        { name: 'Mitral Regurgitation Evaluation', tags: ['MR', 'valvular'], orders: ['Echo', 'ECG'] },
        { name: 'Tricuspid Regurgitation Evaluation', tags: ['TR', 'valvular'], orders: ['Echo', 'ECG'] },
        { name: 'Pulmonic Stenosis Evaluation', tags: ['PS', 'valvular'], orders: ['Echo', 'ECG'] },
        { name: 'Prosthetic Valve Follow-up', tags: ['prosthetic valve', 'valvular'], orders: ['Echo', 'ECG', 'PT/INR'] },
        { name: 'Endocarditis Workup', tags: ['endocarditis', 'infection'], orders: ['Blood Culture', 'Echo', 'CBC', 'ECG'] },
        
        // Cardiomyopathies
        { name: 'Dilated Cardiomyopathy Initial', tags: ['DCM', 'cardiomyopathy'], orders: ['Echo', 'ECG', 'BNP', 'CMP'] },
        { name: 'Hypertrophic Cardiomyopathy Evaluation', tags: ['HCM', 'cardiomyopathy'], orders: ['Echo', 'ECG', 'Genetic Test'] },
        { name: 'Restrictive Cardiomyopathy Workup', tags: ['RCM', 'cardiomyopathy'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        { name: 'Takotsubo Cardiomyopathy', tags: ['takotsubo', 'cardiomyopathy'], orders: ['Echo', 'ECG', 'Troponin', 'Cath'] },
        
        // Pericardial Disease
        { name: 'Pericarditis Evaluation', tags: ['pericarditis', 'pericardial'], orders: ['ECG', 'Echo', 'Chest X-Ray', 'Troponin'] },
        { name: 'Pericardial Effusion Evaluation', tags: ['pericardial effusion', 'pericardial'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Cardiac Tamponade', tags: ['tamponade', 'pericardial'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Constrictive Pericarditis', tags: ['constrictive', 'pericardial'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        
        // Aortic Disease
        { name: 'Aortic Aneurysm Surveillance', tags: ['aortic aneurysm', 'aorta'], orders: ['Echo', 'CT Aorta'] },
        { name: 'Aortic Dissection Type A', tags: ['aortic dissection', 'aorta'], orders: ['CT Aorta', 'ECG', 'Chest X-Ray'] },
        { name: 'Aortic Dissection Type B', tags: ['aortic dissection', 'aorta'], orders: ['CT Aorta', 'ECG', 'Chest X-Ray'] },
        { name: 'Marfan Syndrome Cardiac', tags: ['Marfan', 'aorta'], orders: ['Echo', 'CT Aorta', 'ECG'] },
        
        // Procedures - Pre/Post
        { name: 'Pre-Stress Test', tags: ['stress test', 'pre-procedure'], orders: ['ECG', 'BMP'] },
        { name: 'Post-Stress Test', tags: ['stress test', 'post-procedure'], orders: ['ECG'] },
        { name: 'Pre-Echocardiogram', tags: ['echo', 'pre-procedure'], orders: ['ECG'] },
        { name: 'Pre-Cardiac Catheterization', tags: ['cath', 'pre-procedure'], orders: ['CBC', 'BMP', 'PT/INR', 'Creatinine'] },
        { name: 'Post-Cardiac Catheterization', tags: ['cath', 'post-procedure'], orders: ['CBC', 'ECG', 'Chest X-Ray'] },
        { name: 'Pre-PCI', tags: ['PCI', 'pre-procedure'], orders: ['CBC', 'BMP', 'PT/INR', 'aPTT'] },
        { name: 'Post-PCI', tags: ['PCI', 'post-procedure'], orders: ['CBC', 'ECG', 'Troponin'] },
        { name: 'Pre-Ablation', tags: ['ablation', 'pre-procedure'], orders: ['ECG', 'Echo', 'CBC', 'BMP'] },
        { name: 'Post-Ablation', tags: ['ablation', 'post-procedure'], orders: ['ECG', 'Holter'] },
        { name: 'Pre-Pacemaker Implant', tags: ['pacemaker', 'pre-procedure'], orders: ['ECG', 'CBC', 'BMP'] },
        { name: 'Post-Pacemaker Implant', tags: ['pacemaker', 'post-procedure'], orders: ['ECG', 'Chest X-Ray', 'Device Check'] },
        { name: 'Pre-ICD Implant', tags: ['ICD', 'pre-procedure'], orders: ['ECG', 'Echo', 'CBC', 'BMP'] },
        { name: 'Post-ICD Implant', tags: ['ICD', 'post-procedure'], orders: ['ECG', 'Chest X-Ray', 'Device Check'] },
        { name: 'Pre-Cardiac Surgery', tags: ['surgery', 'pre-procedure'], orders: ['CBC', 'CMP', 'PT/INR', 'Chest X-Ray', 'ECG', 'Echo'] },
        { name: 'Post-Cardiac Surgery', tags: ['surgery', 'post-procedure'], orders: ['CBC', 'CMP', 'ECG', 'Chest X-Ray'] },
        
        // Monitoring
        { name: 'Anticoagulation Monitoring', tags: ['anticoagulation', 'monitoring'], orders: ['PT/INR', 'CBC'] },
        { name: 'Warfarin Monitoring', tags: ['warfarin', 'monitoring'], orders: ['PT/INR', 'CBC'] },
        { name: 'DOAC Monitoring', tags: ['DOAC', 'monitoring'], orders: ['CBC', 'CMP', 'Creatinine'] },
        { name: 'Statin Monitoring', tags: ['statin', 'monitoring'], orders: ['Lipid Panel', 'LFT', 'CK'] },
        { name: 'ACE Inhibitor Monitoring', tags: ['ACE inhibitor', 'monitoring'], orders: ['CMP', 'Creatinine', 'Potassium'] },
        { name: 'ARB Monitoring', tags: ['ARB', 'monitoring'], orders: ['CMP', 'Creatinine', 'Potassium'] },
        { name: 'Beta Blocker Monitoring', tags: ['beta blocker', 'monitoring'], orders: ['ECG', 'Heart Rate'] },
        { name: 'Diuretic Monitoring', tags: ['diuretic', 'monitoring'], orders: ['CMP', 'Creatinine', 'Electrolytes'] },
        { name: 'Digoxin Monitoring', tags: ['digoxin', 'monitoring'], orders: ['Digoxin Level', 'CMP', 'ECG'] },
        { name: 'Amiodarone Monitoring', tags: ['amiodarone', 'monitoring'], orders: ['TSH', 'LFT', 'Chest X-Ray', 'ECG'] },
        
        // Risk Assessment
        { name: 'Cardiovascular Risk Assessment', tags: ['risk assessment', 'prevention'], orders: ['Lipid Panel', 'CMP', 'ECG'] },
        { name: 'Pre-Operative Cardiac Clearance', tags: ['pre-op', 'clearance'], orders: ['ECG', 'Echo', 'Stress Test'] },
        { name: 'Cardiac Risk Stratification', tags: ['risk', 'stratification'], orders: ['Lipid Panel', 'ECG', 'Calcium Score'] },
        
        // Special Populations
        { name: 'Pregnancy Cardiac Evaluation', tags: ['pregnancy', 'cardiac'], orders: ['Echo', 'ECG', 'CMP'] },
        { name: 'Athlete Cardiac Screening', tags: ['athlete', 'screening'], orders: ['ECG', 'Echo'] },
        { name: 'Pediatric Cardiac Evaluation', tags: ['pediatric', 'cardiac'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Elderly Cardiac Assessment', tags: ['elderly', 'cardiac'], orders: ['ECG', 'Echo', 'BNP', 'CMP'] },
        
        // Symptoms
        { name: 'Dizziness Cardiac Workup', tags: ['dizziness', 'symptom'], orders: ['ECG', 'Holter', 'Echo', 'TSH'] },
        { name: 'Fatigue Cardiac Workup', tags: ['fatigue', 'symptom'], orders: ['ECG', 'Echo', 'TSH', 'CBC', 'BNP'] },
        { name: 'Leg Swelling Cardiac', tags: ['edema', 'symptom'], orders: ['Echo', 'BNP', 'CMP', 'ECG'] },
        { name: 'Exercise Intolerance', tags: ['exercise', 'symptom'], orders: ['Echo', 'Stress Test', 'BNP', 'ECG'] },
        
        // Imaging Studies
        { name: 'Cardiac CT Angiography', tags: ['CTA', 'imaging'], orders: ['Creatinine', 'eGFR', 'CT Angio'] },
        { name: 'Cardiac MRI', tags: ['MRI', 'imaging'], orders: ['Creatinine', 'eGFR', 'Cardiac MRI'] },
        { name: 'Nuclear Stress Test', tags: ['nuclear', 'stress test'], orders: ['ECG', 'BMP', 'Nuclear Stress'] },
        { name: 'Echo Stress Test', tags: ['echo stress', 'stress test'], orders: ['ECG', 'Echo Stress'] },
        { name: 'PET Cardiac', tags: ['PET', 'imaging'], orders: ['Creatinine', 'eGFR', 'PET Scan'] },
        
        // Device Management
        { name: 'Pacemaker Interrogation', tags: ['pacemaker', 'device'], orders: ['Device Check', 'ECG'] },
        { name: 'ICD Interrogation', tags: ['ICD', 'device'], orders: ['Device Check', 'ECG'] },
        { name: 'CRT Device Check', tags: ['CRT', 'device'], orders: ['Device Check', 'ECG', 'Echo'] },
        { name: 'Device Lead Evaluation', tags: ['device', 'lead'], orders: ['Device Check', 'Chest X-Ray'] },
        { name: 'Battery Replacement Planning', tags: ['device', 'battery'], orders: ['Device Check', 'ECG'] },
        
        // Genetic/Congenital
        { name: 'Familial Hypercholesterolemia', tags: ['genetic', 'cholesterol'], orders: ['Lipid Panel', 'Genetic Test', 'ECG'] },
        { name: 'Brugada Syndrome Evaluation', tags: ['Brugada', 'genetic'], orders: ['ECG', 'Genetic Test', 'Echo'] },
        { name: 'Catecholaminergic VT', tags: ['CPVT', 'genetic'], orders: ['ECG', 'Genetic Test', 'Echo'] },
        { name: 'Arrhythmogenic RV Dysplasia', tags: ['ARVD', 'genetic'], orders: ['ECG', 'Echo', 'Cardiac MRI', 'Genetic Test'] },
        
        // Specialized Conditions
        { name: 'Cardiac Sarcoidosis', tags: ['sarcoidosis', 'cardiac'], orders: ['Echo', 'Cardiac MRI', 'PET', 'Biopsy'] },
        { name: 'Cardiac Amyloidosis', tags: ['amyloidosis', 'cardiac'], orders: ['Echo', 'Cardiac MRI', 'Biopsy', 'Genetic Test'] },
        { name: 'Cardiac Iron Overload', tags: ['hemochromatosis', 'cardiac'], orders: ['Echo', 'Ferritin', 'Iron Studies', 'Cardiac MRI'] },
        { name: 'Chagas Disease Cardiac', tags: ['Chagas', 'infection'], orders: ['Echo', 'ECG', 'Serology'] },
        { name: 'Lyme Carditis', tags: ['Lyme', 'infection'], orders: ['ECG', 'Echo', 'Serology'] },
        
        // Vascular
        { name: 'Peripheral Artery Disease', tags: ['PAD', 'vascular'], orders: ['ABI', 'Lipid Panel', 'ECG'] },
        { name: 'Carotid Artery Disease', tags: ['carotid', 'vascular'], orders: ['Carotid US', 'Lipid Panel', 'ECG'] },
        { name: 'Renal Artery Stenosis', tags: ['renal artery', 'vascular'], orders: ['Renal US', 'CMP', 'Renin', 'Aldosterone'] },
        { name: 'Aortic Coarctation', tags: ['coarctation', 'vascular'], orders: ['Echo', 'CT Aorta', 'ECG'] },
        
        // Pulmonary
        { name: 'Pulmonary Hypertension Workup', tags: ['pulmonary HTN', 'PH'], orders: ['Echo', 'Chest X-Ray', 'BNP', 'Right Heart Cath'] },
        { name: 'Pulmonary Embolism Cardiac', tags: ['PE', 'pulmonary'], orders: ['CT PE', 'ECG', 'Troponin', 'BNP'] },
        { name: 'Cor Pulmonale', tags: ['cor pulmonale', 'pulmonary'], orders: ['Echo', 'Chest X-Ray', 'ECG', 'BNP'] },
        
        // Emergency/Urgent
        { name: 'Cardiac Arrest Survivor', tags: ['arrest', 'emergency'], orders: ['ECG', 'Echo', 'Cardiac Cath', 'Genetic Test'] },
        { name: 'Cardiogenic Shock', tags: ['shock', 'emergency'], orders: ['Echo', 'Swan-Ganz', 'ECG', 'Troponin'] },
        { name: 'Acute Heart Failure', tags: ['acute HF', 'emergency'], orders: ['BNP', 'Troponin', 'Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Hypertensive Crisis', tags: ['HTN crisis', 'emergency'], orders: ['CMP', 'ECG', 'Chest X-Ray'] },
        
        // Follow-up Routines
        { name: 'Routine Cardiac Follow-up', tags: ['follow-up', 'routine'], orders: ['ECG', 'Lipid Panel'] },
        { name: 'Post-MI 3 Month', tags: ['MI', 'follow-up'], orders: ['Lipid Panel', 'ECG', 'Echo'] },
        { name: 'Post-MI 6 Month', tags: ['MI', 'follow-up'], orders: ['Lipid Panel', 'ECG'] },
        { name: 'Post-MI 1 Year', tags: ['MI', 'follow-up'], orders: ['Lipid Panel', 'ECG', 'Stress Test'] },
        { name: 'Heart Failure 3 Month', tags: ['HF', 'follow-up'], orders: ['BNP', 'CMP', 'ECG'] },
        { name: 'Heart Failure 6 Month', tags: ['HF', 'follow-up'], orders: ['BNP', 'CMP', 'ECG', 'Echo'] },
        { name: 'AFib 3 Month Follow-up', tags: ['AFib', 'follow-up'], orders: ['ECG', 'PT/INR', 'CMP'] },
        { name: 'AFib 6 Month Follow-up', tags: ['AFib', 'follow-up'], orders: ['ECG', 'PT/INR', 'Holter'] },
        
        // Medication Management
        { name: 'Statin Initiation', tags: ['statin', 'medication'], orders: ['Lipid Panel', 'LFT', 'CK'] },
        { name: 'Statin Titration', tags: ['statin', 'medication'], orders: ['Lipid Panel', 'LFT'] },
        { name: 'ACE Inhibitor Initiation', tags: ['ACE', 'medication'], orders: ['CMP', 'Creatinine'] },
        { name: 'ARB Initiation', tags: ['ARB', 'medication'], orders: ['CMP', 'Creatinine'] },
        { name: 'Beta Blocker Initiation', tags: ['beta blocker', 'medication'], orders: ['ECG', 'Heart Rate'] },
        { name: 'Calcium Channel Blocker Initiation', tags: ['CCB', 'medication'], orders: ['ECG', 'Heart Rate'] },
        { name: 'Diuretic Initiation', tags: ['diuretic', 'medication'], orders: ['CMP', 'Creatinine'] },
        { name: 'Anticoagulation Initiation', tags: ['anticoagulation', 'medication'], orders: ['PT/INR', 'CBC', 'CMP'] },
        { name: 'Antiarrhythmic Initiation', tags: ['antiarrhythmic', 'medication'], orders: ['ECG', 'TSH', 'CMP'] },
        
        // Lab Panels
        { name: 'Complete Cardiac Panel', tags: ['panel', 'comprehensive'], orders: ['CBC', 'CMP', 'Lipid Panel', 'BNP', 'Troponin', 'TSH'] },
        { name: 'Cardiac Enzyme Panel', tags: ['enzymes', 'panel'], orders: ['Troponin', 'CK-MB', 'BNP'] },
        { name: 'Lipid Comprehensive', tags: ['lipid', 'panel'], orders: ['Lipid Panel', 'ApoB', 'Lp(a)'] },
        { name: 'Coagulation Panel', tags: ['coagulation', 'panel'], orders: ['PT/INR', 'aPTT', 'CBC'] },
        { name: 'Electrolyte Panel', tags: ['electrolytes', 'panel'], orders: ['CMP', 'Magnesium', 'Phosphorus'] },
        
        // Referrals
        { name: 'Cardiac Surgery Referral', tags: ['surgery', 'referral'], orders: ['Echo', 'Cardiac Cath', 'ECG'] },
        { name: 'EP Consultation', tags: ['EP', 'referral'], orders: ['ECG', 'Holter', 'Echo'] },
        { name: 'Heart Failure Specialist', tags: ['HF', 'referral'], orders: ['BNP', 'Echo', 'ECG'] },
        { name: 'Cardiac Rehab Referral', tags: ['rehab', 'referral'], orders: ['ECG', 'Stress Test'] },
        { name: 'Transplant Evaluation', tags: ['transplant', 'referral'], orders: ['Echo', 'Cardiac Cath', 'CMP', 'CBC'] },
        
        // Screening
        { name: 'Cardiac Screening Age 40', tags: ['screening', 'prevention'], orders: ['Lipid Panel', 'ECG', 'CMP'] },
        { name: 'Cardiac Screening Age 50', tags: ['screening', 'prevention'], orders: ['Lipid Panel', 'ECG', 'Calcium Score'] },
        { name: 'Family History Screening', tags: ['screening', 'family history'], orders: ['Lipid Panel', 'ECG', 'Echo'] },
        { name: 'Diabetes Cardiac Screening', tags: ['diabetes', 'screening'], orders: ['Lipid Panel', 'ECG', 'Echo', 'BNP'] },
        
        // Comorbidities
        { name: 'Diabetes Cardiac Complication', tags: ['diabetes', 'cardiac'], orders: ['Lipid Panel', 'ECG', 'Echo', 'BNP', 'A1C'] },
        { name: 'CKD Cardiac Evaluation', tags: ['CKD', 'cardiac'], orders: ['CMP', 'eGFR', 'ECG', 'Echo', 'BNP'] },
        { name: 'Obesity Cardiac Assessment', tags: ['obesity', 'cardiac'], orders: ['Lipid Panel', 'ECG', 'Echo', 'BNP'] },
        { name: 'Sleep Apnea Cardiac', tags: ['sleep apnea', 'cardiac'], orders: ['ECG', 'Echo', 'Sleep Study'] },
        { name: 'Thyroid Cardiac', tags: ['thyroid', 'cardiac'], orders: ['TSH', 'ECG', 'Echo'] },
        { name: 'Anemia Cardiac', tags: ['anemia', 'cardiac'], orders: ['CBC', 'ECG', 'Echo', 'BNP'] },
        
        // Age-Specific
        { name: 'Young Adult Chest Pain', tags: ['young adult', 'chest pain'], orders: ['ECG', 'Echo', 'Troponin'] },
        { name: 'Middle Age Risk Assessment', tags: ['middle age', 'risk'], orders: ['Lipid Panel', 'ECG', 'Calcium Score'] },
        { name: 'Elderly Cardiac Comprehensive', tags: ['elderly', 'comprehensive'], orders: ['ECG', 'Echo', 'BNP', 'CMP', 'CBC'] },
        
        // Gender-Specific
        { name: 'Women Cardiac Risk', tags: ['women', 'risk'], orders: ['Lipid Panel', 'ECG', 'Echo'] },
        { name: 'Men Cardiac Risk', tags: ['men', 'risk'], orders: ['Lipid Panel', 'ECG', 'Calcium Score'] },
        
        // Lifestyle
        { name: 'Smoking Cessation Cardiac', tags: ['smoking', 'cessation'], orders: ['Lipid Panel', 'ECG', 'Chest X-Ray'] },
        { name: 'Exercise Prescription', tags: ['exercise', 'prescription'], orders: ['ECG', 'Stress Test'] },
        { name: 'Diet Cardiac Counseling', tags: ['diet', 'counseling'], orders: ['Lipid Panel', 'CMP'] },
        
        // Quality Measures
        { name: 'HFrEF Medication Optimization', tags: ['HFrEF', 'medication'], orders: ['BNP', 'CMP', 'ECG'] },
        { name: 'Post-MI Medication Optimization', tags: ['MI', 'medication'], orders: ['Lipid Panel', 'CMP', 'ECG'] },
        { name: 'AFib Anticoagulation Check', tags: ['AFib', 'anticoagulation'], orders: ['PT/INR', 'CBC', 'CHADS2'] },
        
        // Advanced
        { name: 'LVAD Candidate Evaluation', tags: ['LVAD', 'advanced'], orders: ['Echo', 'Right Heart Cath', 'CMP', 'CBC'] },
        { name: 'ECMO Evaluation', tags: ['ECMO', 'advanced'], orders: ['Echo', 'ECG', 'CMP', 'CBC'] },
        { name: 'Heart Transplant Listing', tags: ['transplant', 'advanced'], orders: ['Echo', 'Right Heart Cath', 'CMP', 'CBC', 'Psych Eval'] },
        { name: 'Mechanical Support Evaluation', tags: ['mechanical', 'advanced'], orders: ['Echo', 'Right Heart Cath', 'CMP'] },
        
        // Complications
        { name: 'Post-MI Complications', tags: ['MI', 'complications'], orders: ['Echo', 'ECG', 'Troponin', 'Chest X-Ray'] },
        { name: 'Post-PCI Complications', tags: ['PCI', 'complications'], orders: ['ECG', 'Troponin', 'CBC', 'Chest X-Ray'] },
        { name: 'Device Complications', tags: ['device', 'complications'], orders: ['Device Check', 'Chest X-Ray', 'ECG'] },
        { name: 'Medication Side Effects', tags: ['medication', 'side effects'], orders: ['CMP', 'CBC', 'ECG', 'LFT'] },
        
        // Research/Studies
        { name: 'Clinical Trial Screening', tags: ['trial', 'research'], orders: ['ECG', 'Echo', 'CMP', 'CBC'] },
        { name: 'Genetic Study Enrollment', tags: ['genetic', 'research'], orders: ['Genetic Test', 'ECG', 'Echo'] },
        
        // Preventive
        { name: 'Primary Prevention', tags: ['prevention', 'primary'], orders: ['Lipid Panel', 'ECG', 'CMP'] },
        { name: 'Secondary Prevention', tags: ['prevention', 'secondary'], orders: ['Lipid Panel', 'ECG', 'CMP', 'Echo'] },
        { name: 'Aspirin Therapy Decision', tags: ['aspirin', 'prevention'], orders: ['CBC', 'Cardiovascular Risk'] },
        
        // Monitoring Devices
        { name: 'Holter Monitor Placement', tags: ['Holter', 'monitoring'], orders: ['ECG', 'Holter Setup'] },
        { name: 'Event Monitor Placement', tags: ['event monitor', 'monitoring'], orders: ['ECG', 'Event Monitor Setup'] },
        { name: 'Loop Recorder Implant', tags: ['loop recorder', 'monitoring'], orders: ['ECG', 'Implant Procedure'] },
        { name: 'Mobile Cardiac Telemetry', tags: ['MCT', 'monitoring'], orders: ['ECG', 'MCT Setup'] },
        
        // Blood Pressure
        { name: 'Ambulatory BP Monitoring', tags: ['ABPM', 'BP'], orders: ['ABPM Setup', 'ECG'] },
        { name: 'Home BP Monitoring Setup', tags: ['home BP', 'BP'], orders: ['BP Device', 'Education'] },
        { name: 'White Coat Hypertension', tags: ['white coat', 'BP'], orders: ['ABPM', 'ECG'] },
        
        // Lipid Management
        { name: 'High Cholesterol Initial', tags: ['cholesterol', 'lipid'], orders: ['Lipid Panel', 'ECG'] },
        { name: 'Hypertriglyceridemia', tags: ['triglycerides', 'lipid'], orders: ['Lipid Panel', 'ECG', 'CMP'] },
        { name: 'Low HDL Evaluation', tags: ['HDL', 'lipid'], orders: ['Lipid Panel', 'ECG', 'CMP'] },
        { name: 'Mixed Dyslipidemia', tags: ['dyslipidemia', 'lipid'], orders: ['Lipid Panel', 'ECG', 'CMP'] },
        
        // Arrhythmia Specific
        { name: 'Atrial Tachycardia', tags: ['AT', 'arrhythmia'], orders: ['ECG', 'Echo', 'Holter'] },
        { name: 'Multifocal Atrial Tachycardia', tags: ['MAT', 'arrhythmia'], orders: ['ECG', 'CMP', 'Echo'] },
        { name: 'Junctional Rhythm', tags: ['junctional', 'arrhythmia'], orders: ['ECG', 'Echo', 'TSH'] },
        { name: 'Idioventricular Rhythm', tags: ['IVR', 'arrhythmia'], orders: ['ECG', 'Echo', 'Troponin'] },
        { name: 'Torsades de Pointes', tags: ['TdP', 'arrhythmia'], orders: ['ECG', 'QTc', 'CMP', 'Med Review'] },
        { name: 'Polymorphic VT', tags: ['polymorphic VT', 'arrhythmia'], orders: ['ECG', 'Echo', 'Troponin'] },
        { name: 'Monomorphic VT', tags: ['monomorphic VT', 'arrhythmia'], orders: ['ECG', 'Echo', 'Cardiac Cath'] },
        { name: 'Ventricular Fibrillation', tags: ['VF', 'arrhythmia'], orders: ['ECG', 'Echo', 'Cardiac Cath', 'Genetic Test'] },
        { name: 'Asystole Evaluation', tags: ['asystole', 'arrhythmia'], orders: ['ECG', 'Echo', 'CMP'] },
        { name: 'Pulseless Electrical Activity', tags: ['PEA', 'arrhythmia'], orders: ['ECG', 'Echo', 'CMP', 'Chest X-Ray'] },
        
        // Conduction Disorders
        { name: 'First Degree AV Block', tags: ['1st degree', 'conduction'], orders: ['ECG', 'Echo', 'Med Review'] },
        { name: 'Second Degree AV Block Type I', tags: ['2nd degree type I', 'conduction'], orders: ['ECG', 'Echo', 'Holter'] },
        { name: 'Second Degree AV Block Type II', tags: ['2nd degree type II', 'conduction'], orders: ['ECG', 'Echo', 'Pacemaker Eval'] },
        { name: 'Third Degree AV Block', tags: ['3rd degree', 'conduction'], orders: ['ECG', 'Echo', 'Pacemaker Eval'] },
        { name: 'Bundle Branch Block', tags: ['BBB', 'conduction'], orders: ['ECG', 'Echo'] },
        { name: 'Left Bundle Branch Block', tags: ['LBBB', 'conduction'], orders: ['ECG', 'Echo', 'Stress Test'] },
        { name: 'Right Bundle Branch Block', tags: ['RBBB', 'conduction'], orders: ['ECG', 'Echo'] },
        { name: 'Bifascicular Block', tags: ['bifascicular', 'conduction'], orders: ['ECG', 'Echo', 'Pacemaker Eval'] },
        { name: 'Trifascicular Block', tags: ['trifascicular', 'conduction'], orders: ['ECG', 'Echo', 'Pacemaker Eval'] },
        
        // Structural Heart
        { name: 'Atrial Septal Defect', tags: ['ASD', 'congenital'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Ventricular Septal Defect', tags: ['VSD', 'congenital'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Patent Ductus Arteriosus', tags: ['PDA', 'congenital'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Coarctation of Aorta', tags: ['coarctation', 'congenital'], orders: ['Echo', 'CT Aorta', 'ECG'] },
        { name: 'Tetralogy of Fallot', tags: ['TOF', 'congenital'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        { name: 'Transposition of Great Arteries', tags: ['TGA', 'congenital'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        { name: 'Ebstein Anomaly', tags: ['Ebstein', 'congenital'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Hypoplastic Left Heart', tags: ['HLHS', 'congenital'], orders: ['Echo', 'ECG', 'Cardiac Cath'] },
        
        // Tumors
        { name: 'Cardiac Myxoma', tags: ['myxoma', 'tumor'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        { name: 'Cardiac Fibroma', tags: ['fibroma', 'tumor'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        { name: 'Cardiac Metastasis', tags: ['metastasis', 'tumor'], orders: ['Echo', 'ECG', 'Cardiac MRI', 'CT'] },
        
        // Inflammatory
        { name: 'Rheumatic Heart Disease', tags: ['rheumatic', 'inflammatory'], orders: ['Echo', 'ECG', 'ASO Titer'] },
        { name: 'Kawasaki Disease Cardiac', tags: ['Kawasaki', 'inflammatory'], orders: ['Echo', 'ECG', 'CBC', 'ESR'] },
        { name: 'Systemic Lupus Cardiac', tags: ['SLE', 'inflammatory'], orders: ['Echo', 'ECG', 'ANA', 'CBC'] },
        { name: 'Rheumatoid Arthritis Cardiac', tags: ['RA', 'inflammatory'], orders: ['Echo', 'ECG', 'RF', 'ESR'] },
        
        // Metabolic
        { name: 'Cardiac Cachexia', tags: ['cachexia', 'metabolic'], orders: ['Albumin', 'Prealbumin', 'BNP', 'Echo'] },
        { name: 'Cardiac Sarcopenia', tags: ['sarcopenia', 'metabolic'], orders: ['Albumin', 'BNP', 'Echo'] },
        
        // Drug-Related
        { name: 'Chemotherapy Cardiotoxicity', tags: ['chemotherapy', 'toxicity'], orders: ['Echo', 'ECG', 'Troponin', 'BNP'] },
        { name: 'Radiation Cardiotoxicity', tags: ['radiation', 'toxicity'], orders: ['Echo', 'ECG', 'Chest X-Ray'] },
        { name: 'Cocaine Cardiotoxicity', tags: ['cocaine', 'toxicity'], orders: ['ECG', 'Troponin', 'Echo'] },
        { name: 'Alcohol Cardiomyopathy', tags: ['alcohol', 'toxicity'], orders: ['Echo', 'ECG', 'LFT', 'CMP'] },
        
        // Transplant
        { name: 'Post-Transplant Rejection', tags: ['transplant', 'rejection'], orders: ['Echo', 'Biopsy', 'ECG', 'BNP'] },
        { name: 'Post-Transplant Infection', tags: ['transplant', 'infection'], orders: ['Blood Culture', 'Echo', 'CBC', 'CMP'] },
        { name: 'Post-Transplant CAV', tags: ['transplant', 'CAV'], orders: ['Echo', 'Cardiac Cath', 'ECG'] },
        { name: 'Post-Transplant Routine', tags: ['transplant', 'routine'], orders: ['Echo', 'ECG', 'CMP', 'CBC'] },
        
        // Pregnancy
        { name: 'Peripartum Cardiomyopathy', tags: ['peripartum', 'pregnancy'], orders: ['Echo', 'ECG', 'BNP', 'CMP'] },
        { name: 'Pregnancy Cardiac Monitoring', tags: ['pregnancy', 'monitoring'], orders: ['Echo', 'ECG', 'CMP'] },
        { name: 'Postpartum Cardiac', tags: ['postpartum', 'pregnancy'], orders: ['Echo', 'ECG', 'BNP'] },
        
        // Pediatric/Adult Congenital
        { name: 'Adult Congenital Heart Disease', tags: ['ACHD', 'congenital'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        { name: 'Fontan Follow-up', tags: ['Fontan', 'congenital'], orders: ['Echo', 'ECG', 'Cardiac MRI', 'CMP'] },
        { name: 'Mustard/Senning Follow-up', tags: ['Mustard', 'congenital'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        
        // Advanced Imaging
        { name: '3D Echocardiogram', tags: ['3D echo', 'imaging'], orders: ['3D Echo', 'ECG'] },
        { name: 'Strain Echocardiography', tags: ['strain', 'imaging'], orders: ['Strain Echo', 'ECG'] },
        { name: 'Contrast Echocardiogram', tags: ['contrast', 'imaging'], orders: ['Contrast Echo', 'ECG', 'Creatinine'] },
        { name: 'Transesophageal Echo', tags: ['TEE', 'imaging'], orders: ['TEE', 'ECG', 'PT/INR'] },
        { name: 'Stress Echocardiogram', tags: ['stress echo', 'imaging'], orders: ['Stress Echo', 'ECG', 'BMP'] },
        
        // Functional Testing
        { name: '6 Minute Walk Test', tags: ['6MWT', 'functional'], orders: ['6MWT', 'ECG', 'O2 Sat'] },
        { name: 'Cardiopulmonary Exercise Test', tags: ['CPET', 'functional'], orders: ['CPET', 'ECG', 'PFT'] },
        { name: 'Tilt Table Test', tags: ['tilt table', 'functional'], orders: ['Tilt Test', 'ECG', 'BP Monitoring'] },
        
        // Biomarkers
        { name: 'High-Sensitivity Troponin', tags: ['hs-Troponin', 'biomarker'], orders: ['hs-Troponin', 'ECG'] },
        { name: 'NT-proBNP Monitoring', tags: ['NT-proBNP', 'biomarker'], orders: ['NT-proBNP', 'Echo', 'ECG'] },
        { name: 'Galectin-3', tags: ['galectin', 'biomarker'], orders: ['Galectin-3', 'BNP', 'Echo'] },
        { name: 'ST2', tags: ['ST2', 'biomarker'], orders: ['ST2', 'BNP', 'Echo'] },
        
        // Quality of Life
        { name: 'Cardiac Depression Screening', tags: ['depression', 'QOL'], orders: ['PHQ-9', 'ECG'] },
        { name: 'Cardiac Anxiety Assessment', tags: ['anxiety', 'QOL'], orders: ['GAD-7', 'ECG'] },
        { name: 'Quality of Life Assessment', tags: ['QOL', 'assessment'], orders: ['KCCQ', 'ECG'] },
        
        // Education
        { name: 'Heart Failure Education', tags: ['HF', 'education'], orders: ['Education', 'BNP'] },
        { name: 'Medication Education', tags: ['medication', 'education'], orders: ['Education', 'Med Review'] },
        { name: 'Lifestyle Modification', tags: ['lifestyle', 'education'], orders: ['Education', 'Lipid Panel'] },
        
        // Coordination
        { name: 'Multidisciplinary HF Clinic', tags: ['HF', 'multidisciplinary'], orders: ['BNP', 'Echo', 'ECG', 'CMP', 'Nutrition', 'Pharmacy'] },
        { name: 'Cardiac Oncology Clinic', tags: ['oncology', 'cardiac'], orders: ['Echo', 'ECG', 'Troponin', 'BNP'] },
        { name: 'Cardio-Renal Clinic', tags: ['cardio-renal', 'multidisciplinary'], orders: ['CMP', 'eGFR', 'Echo', 'ECG', 'BNP'] },
        { name: 'Cardio-Metabolic Clinic', tags: ['metabolic', 'multidisciplinary'], orders: ['Lipid Panel', 'A1C', 'Echo', 'ECG'] },
        
        // Specialized Procedures
        { name: 'Transcatheter Aortic Valve', tags: ['TAVR', 'procedure'], orders: ['Echo', 'CT Aorta', 'Cardiac Cath', 'CMP'] },
        { name: 'Mitral Clip Procedure', tags: ['MitraClip', 'procedure'], orders: ['Echo', 'TEE', 'Cardiac Cath'] },
        { name: 'Left Atrial Appendage Closure', tags: ['Watchman', 'procedure'], orders: ['Echo', 'TEE', 'Cardiac Cath'] },
        { name: 'PFO Closure', tags: ['PFO', 'procedure'], orders: ['Echo', 'TEE', 'Cardiac Cath'] },
        { name: 'ASD Closure', tags: ['ASD closure', 'procedure'], orders: ['Echo', 'TEE', 'Cardiac Cath'] },
        
        // Advanced Therapies
        { name: 'Cardiac Stem Cell Therapy', tags: ['stem cell', 'advanced'], orders: ['Echo', 'ECG', 'Cardiac MRI'] },
        { name: 'Gene Therapy Evaluation', tags: ['gene therapy', 'advanced'], orders: ['Genetic Test', 'Echo', 'ECG'] },
        
        // Rare Conditions
        { name: 'Loeffler Endocarditis', tags: ['Loeffler', 'rare'], orders: ['Echo', 'ECG', 'Eosinophil Count'] },
        { name: 'Eosinophilic Myocarditis', tags: ['eosinophilic', 'rare'], orders: ['Echo', 'ECG', 'Eosinophil Count', 'Biopsy'] },
        { name: 'Giant Cell Myocarditis', tags: ['giant cell', 'rare'], orders: ['Echo', 'ECG', 'Biopsy'] },
        { name: 'Fulminant Myocarditis', tags: ['fulminant', 'rare'], orders: ['Echo', 'ECG', 'Troponin', 'Biopsy'] },
        
        // Sports Cardiology
        { name: 'Athlete ECG Interpretation', tags: ['athlete', 'ECG'], orders: ['ECG', 'Echo'] },
        { name: 'Sports Clearance', tags: ['sports', 'clearance'], orders: ['ECG', 'Echo', 'Stress Test'] },
        { name: 'Return to Play', tags: ['sports', 'return'], orders: ['ECG', 'Echo', 'Stress Test', 'Holter'] },
        
        // Geriatric
        { name: 'Frailty Assessment Cardiac', tags: ['frailty', 'geriatric'], orders: ['Frailty Score', 'Echo', 'ECG'] },
        { name: 'Cognitive Assessment Cardiac', tags: ['cognitive', 'geriatric'], orders: ['MMSE', 'Echo', 'ECG'] },
        { name: 'Falls Risk Cardiac', tags: ['falls', 'geriatric'], orders: ['ECG', 'Holter', 'Echo', 'BP Monitoring'] },
        
        // End of Life
        { name: 'Palliative Cardiac Care', tags: ['palliative', 'EOL'], orders: ['Symptom Assessment', 'ECG'] },
        { name: 'Hospice Cardiac', tags: ['hospice', 'EOL'], orders: ['Symptom Management'] },
        { name: 'Advanced Directive Discussion', tags: ['advanced directive', 'EOL'], orders: ['Discussion', 'Documentation'] },
        
        // Telemedicine
        { name: 'Remote Monitoring Setup', tags: ['remote', 'telemedicine'], orders: ['Device Setup', 'ECG'] },
        { name: 'Telehealth Cardiac Visit', tags: ['telehealth', 'telemedicine'], orders: ['BP Monitoring', 'Weight', 'Symptom Check'] },
        { name: 'Home Health Cardiac', tags: ['home health', 'telemedicine'], orders: ['Vitals', 'Weight', 'Symptom Assessment'] },
        
        // Compliance
        { name: 'Medication Adherence Check', tags: ['adherence', 'compliance'], orders: ['Med Review', 'Pill Count'] },
        { name: 'Appointment Compliance', tags: ['compliance', 'follow-up'], orders: ['Appointment Review'] },
        
        // Documentation
        { name: 'Cardiac Clearance Letter', tags: ['clearance', 'documentation'], orders: ['ECG', 'Echo', 'Stress Test'] },
        { name: 'Disability Evaluation Cardiac', tags: ['disability', 'documentation'], orders: ['ECG', 'Echo', 'Functional Assessment'] },
        { name: 'Fitness for Duty', tags: ['fitness', 'documentation'], orders: ['ECG', 'Stress Test', 'Echo'] },
        
        // Research
        { name: 'Biomarker Research', tags: ['biomarker', 'research'], orders: ['Research Labs', 'ECG'] },
        { name: 'Imaging Research', tags: ['imaging', 'research'], orders: ['Research Imaging', 'ECG'] },
        
        // Quality Improvement
        { name: 'HF Readmission Prevention', tags: ['HF', 'quality'], orders: ['BNP', 'Med Review', 'Education'] },
        { name: 'MI Quality Measures', tags: ['MI', 'quality'], orders: ['Lipid Panel', 'Med Review', 'ECG'] },
        { name: 'AFib Quality Measures', tags: ['AFib', 'quality'], orders: ['PT/INR', 'CHADS2', 'ECG'] },
        
        // Cost-Effectiveness
        { name: 'Cost-Effective Screening', tags: ['cost', 'screening'], orders: ['Selective Testing', 'ECG'] },
        { name: 'Appropriate Use Criteria', tags: ['AUC', 'appropriate use'], orders: ['AUC Review', 'ECG'] },
        
        // Patient-Reported
        { name: 'Symptom Diary Review', tags: ['symptoms', 'diary'], orders: ['Symptom Review', 'ECG'] },
        { name: 'Quality of Life Survey', tags: ['QOL', 'survey'], orders: ['QOL Survey', 'ECG'] },
        
        // Technology
        { name: 'Wearable Device Integration', tags: ['wearable', 'technology'], orders: ['Device Sync', 'ECG Review'] },
        { name: 'Mobile App Monitoring', tags: ['mobile app', 'technology'], orders: ['App Setup', 'ECG'] },
        { name: 'AI-Enhanced ECG', tags: ['AI', 'technology'], orders: ['ECG', 'AI Analysis'] },
        
        // International
        { name: 'Tropical Cardiac Disease', tags: ['tropical', 'international'], orders: ['Echo', 'ECG', 'Serology'] },
        { name: 'Chagas Screening', tags: ['Chagas', 'international'], orders: ['Serology', 'Echo', 'ECG'] },
        
        // Occupational
        { name: 'Occupational Cardiac Clearance', tags: ['occupational', 'clearance'], orders: ['ECG', 'Stress Test', 'Echo'] },
        { name: 'Pilot Medical Certification', tags: ['pilot', 'certification'], orders: ['ECG', 'Stress Test', 'Echo', 'Holter'] },
        { name: 'Commercial Driver Clearance', tags: ['CDL', 'clearance'], orders: ['ECG', 'Stress Test', 'Echo'] },
        
        // Seasonal
        { name: 'Winter Cardiac Risk', tags: ['winter', 'seasonal'], orders: ['ECG', 'BP Monitoring'] },
        { name: 'Summer Heat Cardiac', tags: ['summer', 'seasonal'], orders: ['ECG', 'Hydration Assessment'] },
        
        // Emergency Preparedness
        { name: 'Disaster Cardiac Planning', tags: ['disaster', 'preparedness'], orders: ['Med Supply', 'Device Check'] },
        { name: 'Emergency Action Plan', tags: ['emergency', 'planning'], orders: ['Action Plan', 'ECG'] },
        
        // Family
        { name: 'Family Screening', tags: ['family', 'screening'], orders: ['Family History', 'ECG', 'Echo'] },
        { name: 'Genetic Counseling Cardiac', tags: ['genetic', 'counseling'], orders: ['Genetic Test', 'Counseling', 'ECG'] },
        
        // Alternative
        { name: 'Complementary Therapy Discussion', tags: ['alternative', 'therapy'], orders: ['Discussion', 'Med Review'] },
        { name: 'Herbal Supplement Review', tags: ['herbal', 'supplement'], orders: ['Med Review', 'ECG'] },
        
        // Mental Health
        { name: 'Cardiac Psychology Referral', tags: ['psychology', 'mental health'], orders: ['Referral', 'PHQ-9'] },
        { name: 'Stress Management Cardiac', tags: ['stress', 'mental health'], orders: ['Stress Assessment', 'ECG'] },
        
        // Social
        { name: 'Social Determinants Assessment', tags: ['social', 'determinants'], orders: ['Assessment', 'ECG'] },
        { name: 'Transportation Assessment', tags: ['transportation', 'social'], orders: ['Assessment'] },
        { name: 'Financial Toxicity Screening', tags: ['financial', 'social'], orders: ['Screening', 'Med Review'] },
        
        // Vaccination
        { name: 'Influenza Vaccination Cardiac', tags: ['flu', 'vaccination'], orders: ['Vaccination', 'ECG'] },
        { name: 'COVID Vaccination Cardiac', tags: ['COVID', 'vaccination'], orders: ['Vaccination', 'ECG', 'Myocarditis Screen'] },
        { name: 'Pneumococcal Vaccination', tags: ['pneumococcal', 'vaccination'], orders: ['Vaccination'] },
        
        // Travel
        { name: 'Travel Cardiac Clearance', tags: ['travel', 'clearance'], orders: ['ECG', 'Med Supply', 'Device Check'] },
        { name: 'Altitude Cardiac Assessment', tags: ['altitude', 'travel'], orders: ['ECG', 'Echo', 'O2 Sat'] },
        
        // Legal
        { name: 'Medical-Legal Cardiac', tags: ['legal', 'documentation'], orders: ['Documentation', 'ECG'] },
        { name: 'Expert Witness Preparation', tags: ['legal', 'expert'], orders: ['Chart Review', 'ECG'] },
        
        // Administrative
        { name: 'Prior Authorization Support', tags: ['prior auth', 'administrative'], orders: ['Documentation', 'ECG'] },
        { name: 'Insurance Appeal Support', tags: ['appeal', 'administrative'], orders: ['Documentation', 'ECG'] },
        
        // Continuity
        { name: 'Care Transition Planning', tags: ['transition', 'continuity'], orders: ['Med Reconciliation', 'ECG'] },
        { name: 'Discharge Planning Cardiac', tags: ['discharge', 'continuity'], orders: ['Med Review', 'Education', 'Follow-up'] },
        
        // Performance
        { name: 'Athletic Performance Optimization', tags: ['performance', 'athletic'], orders: ['ECG', 'Stress Test', 'Echo'] },
        { name: 'Cardiac Performance Metrics', tags: ['performance', 'metrics'], orders: ['ECG', 'Echo', 'Functional Test'] },
        
        // Innovation
        { name: 'Novel Biomarker Testing', tags: ['novel', 'biomarker'], orders: ['Research Biomarker', 'ECG'] },
        { name: 'Precision Medicine Cardiac', tags: ['precision', 'medicine'], orders: ['Genetic Test', 'Pharmacogenomics', 'ECG'] },
        
        // Population Health
        { name: 'Population Health Screening', tags: ['population', 'screening'], orders: ['Risk Score', 'ECG'] },
        { name: 'Community Cardiac Health', tags: ['community', 'health'], orders: ['Screening', 'Education'] },
        
        // Integration
        { name: 'Primary Care Coordination', tags: ['PCP', 'coordination'], orders: ['Summary', 'ECG'] },
        { name: 'Specialist Coordination', tags: ['specialist', 'coordination'], orders: ['Summary', 'ECG'] },
        
        // Education
        { name: 'Patient Education Session', tags: ['education', 'session'], orders: ['Education Materials'] },
        { name: 'Support Group Referral', tags: ['support group', 'education'], orders: ['Referral'] },
        
        // Technology Integration
        { name: 'EHR Integration Check', tags: ['EHR', 'technology'], orders: ['Integration Check'] },
        { name: 'Device Data Integration', tags: ['device', 'integration'], orders: ['Data Sync', 'ECG'] },
        
        // Quality Metrics
        { name: 'HEDIS Measures Cardiac', tags: ['HEDIS', 'quality'], orders: ['Quality Measures', 'ECG'] },
        { name: 'MIPS Reporting Cardiac', tags: ['MIPS', 'quality'], orders: ['Quality Measures', 'ECG'] },
        
        // Cost
        { name: 'Cost-Effective Care Plan', tags: ['cost', 'care plan'], orders: ['Cost Review', 'ECG'] },
        { name: 'Value-Based Care', tags: ['value', 'care'], orders: ['Value Metrics', 'ECG'] },
        
        // Outcomes
        { name: 'Outcome Measurement', tags: ['outcomes', 'measurement'], orders: ['Outcome Metrics', 'ECG'] },
        { name: 'Patient-Reported Outcomes', tags: ['PRO', 'outcomes'], orders: ['PRO Survey', 'ECG'] },
        
        // Safety
        { name: 'Medication Safety Review', tags: ['safety', 'medication'], orders: ['Med Review', 'Drug Interactions'] },
        { name: 'Device Safety Check', tags: ['safety', 'device'], orders: ['Device Check', 'Safety Review'] },
        
        // Communication
        { name: 'Care Team Communication', tags: ['communication', 'team'], orders: ['Summary', 'ECG'] },
        { name: 'Patient Communication Plan', tags: ['communication', 'patient'], orders: ['Communication Plan'] },
        
        // Efficiency
        { name: 'Workflow Optimization', tags: ['workflow', 'efficiency'], orders: ['Process Review'] },
        { name: 'Resource Utilization Review', tags: ['resources', 'efficiency'], orders: ['Utilization Review'] },
        
        // Patient Experience
        { name: 'Patient Satisfaction Survey', tags: ['satisfaction', 'experience'], orders: ['Survey'] },
        { name: 'Wait Time Optimization', tags: ['wait time', 'experience'], orders: ['Process Review'] },
        
        // Research Participation
        { name: 'Clinical Trial Enrollment', tags: ['trial', 'research'], orders: ['Screening', 'ECG'] },
        { name: 'Registry Participation', tags: ['registry', 'research'], orders: ['Data Entry', 'ECG'] },
        
        // Innovation Adoption
        { name: 'New Technology Evaluation', tags: ['technology', 'innovation'], orders: ['Evaluation', 'ECG'] },
        { name: 'Best Practice Implementation', tags: ['best practice', 'innovation'], orders: ['Implementation', 'ECG'] },
        
        // Sustainability
        { name: 'Environmental Impact Assessment', tags: ['environmental', 'sustainability'], orders: ['Assessment'] },
        { name: 'Sustainable Care Model', tags: ['sustainable', 'care'], orders: ['Model Review'] },
        
        // Global Health
        { name: 'Global Cardiac Health Initiative', tags: ['global', 'health'], orders: ['Screening', 'Education'] },
        { name: 'International Collaboration', tags: ['international', 'collaboration'], orders: ['Data Sharing'] },
        
        // Future-Proofing
        { name: 'Emerging Technology Prep', tags: ['emerging', 'technology'], orders: ['Preparation', 'ECG'] },
        { name: 'Future Care Planning', tags: ['future', 'planning'], orders: ['Planning', 'ECG'] }
      ];
      
      // Helper function to map order abbreviations to full order objects
      const mapOrders = (orderAbbrevs) => {
        const orderMap = {
          'CBC': { type: 'lab', payload: { testName: 'Complete Blood Count (CBC)', cpt: '85025', lab: 'Quest' } },
          'BMP': { type: 'lab', payload: { testName: 'Basic Metabolic Panel', cpt: '80048', lab: 'Quest' } },
          'CMP': { type: 'lab', payload: { testName: 'Comprehensive Metabolic Panel', cpt: '80053', lab: 'Quest' } },
          'ECG': { type: 'imaging', payload: { studyName: 'ECG 12-Lead', cpt: '93000' } },
          'Echo': { type: 'imaging', payload: { studyName: 'Echocardiogram Complete', cpt: '93306' } },
          'BNP': { type: 'lab', payload: { testName: 'BNP', cpt: '83880', lab: 'Quest' } },
          'Troponin': { type: 'lab', payload: { testName: 'Troponin I', cpt: '84484', lab: 'Quest' } },
          'Lipid Panel': { type: 'lab', payload: { testName: 'Lipid Panel', cpt: '80061', lab: 'Quest' } },
          'TSH': { type: 'lab', payload: { testName: 'TSH', cpt: '84443', lab: 'Quest' } },
          'PT/INR': { type: 'lab', payload: { testName: 'PT/INR', cpt: '85610', lab: 'Quest' } },
          'Chest X-Ray': { type: 'imaging', payload: { studyName: 'Chest X-Ray PA and Lateral', cpt: '71020' } },
          'Holter': { type: 'imaging', payload: { studyName: 'Holter Monitor 24-Hour', cpt: '93224' } },
          'Creatinine': { type: 'lab', payload: { testName: 'Creatinine', cpt: '82565', lab: 'Quest' } },
          'eGFR': { type: 'lab', payload: { testName: 'eGFR', cpt: '82565', lab: 'Quest' } },
          'LFT': { type: 'lab', payload: { testName: 'Liver Function Panel', cpt: '80076', lab: 'Quest' } },
          'CK': { type: 'lab', payload: { testName: 'CK', cpt: '82550', lab: 'Quest' } },
          'CK-MB': { type: 'lab', payload: { testName: 'CK-MB', cpt: '82550', lab: 'Quest' } },
          'aPTT': { type: 'lab', payload: { testName: 'aPTT', cpt: '85730', lab: 'Quest' } },
          'Stress Test': { type: 'imaging', payload: { studyName: 'Exercise Stress Test', cpt: '93015' } },
          'Cardiac Cath': { type: 'imaging', payload: { studyName: 'Cardiac Catheterization', cpt: '93458' } },
          'CT Aorta': { type: 'imaging', payload: { studyName: 'CT Angiography Aorta', cpt: '71275' } },
          'Cardiac MRI': { type: 'imaging', payload: { studyName: 'Cardiac MRI', cpt: '75557' } },
          'CT Angio': { type: 'imaging', payload: { studyName: 'CT Angiography Coronary', cpt: '75574' } },
          'Right Heart Cath': { type: 'imaging', payload: { studyName: 'Right Heart Catheterization', cpt: '93451' } },
          'EP Study': { type: 'imaging', payload: { studyName: 'Electrophysiology Study', cpt: '93619' } },
          'Device Check': { type: 'imaging', payload: { studyName: 'Device Interrogation', cpt: '93279' } },
          'Event Monitor': { type: 'imaging', payload: { studyName: 'Event Monitor 30-Day', cpt: '93228' } },
          'TEE': { type: 'imaging', payload: { studyName: 'Transesophageal Echocardiogram', cpt: '93312' } },
          'Calcium Score': { type: 'imaging', payload: { studyName: 'Coronary Calcium Score', cpt: '75571' } },
          'Nuclear Stress': { type: 'imaging', payload: { studyName: 'Nuclear Stress Test', cpt: '78452' } },
          'PET Scan': { type: 'imaging', payload: { studyName: 'PET Cardiac', cpt: '78459' } },
          'ABI': { type: 'imaging', payload: { studyName: 'Ankle-Brachial Index', cpt: '93922' } },
          'Carotid US': { type: 'imaging', payload: { studyName: 'Carotid Ultrasound', cpt: '93880' } },
          'Renal US': { type: 'imaging', payload: { studyName: 'Renal Artery Ultrasound', cpt: '93975' } },
          'CT PE': { type: 'imaging', payload: { studyName: 'CT Pulmonary Angiography', cpt: '71275' } },
          'Blood Culture': { type: 'lab', payload: { testName: 'Blood Culture', cpt: '87040', lab: 'Quest' } },
          'Genetic Test': { type: 'lab', payload: { testName: 'Cardiac Genetic Testing', cpt: '81479', lab: 'Quest' } },
          'QTc': { type: 'lab', payload: { testName: 'QTc Interval', cpt: '93000', lab: 'Quest' } },
          'Aldosterone': { type: 'lab', payload: { testName: 'Aldosterone', cpt: '82088', lab: 'Quest' } },
          'Renin': { type: 'lab', payload: { testName: 'Renin', cpt: '84244', lab: 'Quest' } },
          'ApoB': { type: 'lab', payload: { testName: 'Apolipoprotein B', cpt: '82172', lab: 'Quest' } },
          'Lp(a)': { type: 'lab', payload: { testName: 'Lipoprotein(a)', cpt: '83698', lab: 'Quest' } },
          'Magnesium': { type: 'lab', payload: { testName: 'Magnesium', cpt: '83735', lab: 'Quest' } },
          'Phosphorus': { type: 'lab', payload: { testName: 'Phosphorus', cpt: '84100', lab: 'Quest' } },
          'Electrolytes': { type: 'lab', payload: { testName: 'Electrolyte Panel', cpt: '80051', lab: 'Quest' } },
          'Digoxin Level': { type: 'lab', payload: { testName: 'Digoxin Level', cpt: '80162', lab: 'Quest' } },
          'Potassium': { type: 'lab', payload: { testName: 'Potassium', cpt: '84132', lab: 'Quest' } },
          'Heart Rate': { type: 'lab', payload: { testName: 'Heart Rate', cpt: '93000', lab: 'Quest' } },
          'O2 Sat': { type: 'lab', payload: { testName: 'Oxygen Saturation', cpt: '94760', lab: 'Quest' } },
          'PFT': { type: 'imaging', payload: { studyName: 'Pulmonary Function Test', cpt: '94010' } },
          'BP Monitoring': { type: 'imaging', payload: { studyName: 'Blood Pressure Monitoring', cpt: '93000' } },
          'Serology': { type: 'lab', payload: { testName: 'Serology Panel', cpt: '86663', lab: 'Quest' } },
          'ASO Titer': { type: 'lab', payload: { testName: 'ASO Titer', cpt: '86060', lab: 'Quest' } },
          'ANA': { type: 'lab', payload: { testName: 'ANA', cpt: '86038', lab: 'Quest' } },
          'RF': { type: 'lab', payload: { testName: 'Rheumatoid Factor', cpt: '86431', lab: 'Quest' } },
          'ESR': { type: 'lab', payload: { testName: 'ESR', cpt: '85652', lab: 'Quest' } },
          'Albumin': { type: 'lab', payload: { testName: 'Albumin', cpt: '82040', lab: 'Quest' } },
          'Prealbumin': { type: 'lab', payload: { testName: 'Prealbumin', cpt: '84134', lab: 'Quest' } },
          'Eosinophil Count': { type: 'lab', payload: { testName: 'Eosinophil Count', cpt: '85025', lab: 'Quest' } },
          'Ferritin': { type: 'lab', payload: { testName: 'Ferritin', cpt: '82728', lab: 'Quest' } },
          'Iron Studies': { type: 'lab', payload: { testName: 'Iron Studies', cpt: '83540', lab: 'Quest' } },
          'A1C': { type: 'lab', payload: { testName: 'Hemoglobin A1C', cpt: '83036', lab: 'Quest' } },
          'Biopsy': { type: 'procedure', payload: { procedureName: 'Cardiac Biopsy', cpt: '93505' } },
          'Swan-Ganz': { type: 'procedure', payload: { procedureName: 'Swan-Ganz Catheter', cpt: '93503' } },
          '3D Echo': { type: 'imaging', payload: { studyName: '3D Echocardiogram', cpt: '93306' } },
          'Strain Echo': { type: 'imaging', payload: { studyName: 'Strain Echocardiography', cpt: '93306' } },
          'Contrast Echo': { type: 'imaging', payload: { studyName: 'Contrast Echocardiogram', cpt: '93306' } },
          'Stress Echo': { type: 'imaging', payload: { studyName: 'Stress Echocardiogram', cpt: '93350' } },
          'Echo Stress': { type: 'imaging', payload: { studyName: 'Echo Stress Test', cpt: '93350' } },
          '6MWT': { type: 'procedure', payload: { procedureName: '6 Minute Walk Test', cpt: '94620' } },
          'CPET': { type: 'procedure', payload: { procedureName: 'Cardiopulmonary Exercise Test', cpt: '94620' } },
          'Tilt Test': { type: 'procedure', payload: { procedureName: 'Tilt Table Test', cpt: '93660' } },
          'hs-Troponin': { type: 'lab', payload: { testName: 'High-Sensitivity Troponin', cpt: '84484', lab: 'Quest' } },
          'NT-proBNP': { type: 'lab', payload: { testName: 'NT-proBNP', cpt: '83880', lab: 'Quest' } },
          'Galectin-3': { type: 'lab', payload: { testName: 'Galectin-3', cpt: '81595', lab: 'Quest' } },
          'ST2': { type: 'lab', payload: { testName: 'ST2', cpt: '81596', lab: 'Quest' } },
          'PHQ-9': { type: 'lab', payload: { testName: 'PHQ-9 Depression Screen', cpt: '96127', lab: 'Quest' } },
          'GAD-7': { type: 'lab', payload: { testName: 'GAD-7 Anxiety Screen', cpt: '96127', lab: 'Quest' } },
          'KCCQ': { type: 'lab', payload: { testName: 'KCCQ Quality of Life', cpt: '96127', lab: 'Quest' } },
          'Education': { type: 'referral', payload: { specialist: 'Patient Education', reason: 'Cardiac education' } },
          'Med Review': { type: 'referral', payload: { specialist: 'Medication Review', reason: 'Medication management' } },
          'Nutrition': { type: 'referral', payload: { specialist: 'Nutrition', reason: 'Dietary counseling' } },
          'Pharmacy': { type: 'referral', payload: { specialist: 'Pharmacy', reason: 'Medication management' } },
          'Psych Eval': { type: 'referral', payload: { specialist: 'Psychology', reason: 'Psychiatric evaluation' } },
          'MMSE': { type: 'lab', payload: { testName: 'MMSE Cognitive Screen', cpt: '96127', lab: 'Quest' } },
          'Frailty Score': { type: 'lab', payload: { testName: 'Frailty Assessment', cpt: '96127', lab: 'Quest' } },
          'CHADS2': { type: 'lab', payload: { testName: 'CHADS2 Score', cpt: '96127', lab: 'Quest' } },
          'Cardiovascular Risk': { type: 'lab', payload: { testName: 'Cardiovascular Risk Score', cpt: '96127', lab: 'Quest' } },
          'Pill Count': { type: 'lab', payload: { testName: 'Medication Adherence', cpt: '96127', lab: 'Quest' } },
          'Appointment Review': { type: 'lab', payload: { testName: 'Appointment Compliance', cpt: '96127', lab: 'Quest' } },
          'Summary': { type: 'referral', payload: { specialist: 'Care Coordination', reason: 'Summary letter' } },
          'Referral': { type: 'referral', payload: { specialist: 'Specialist', reason: 'Consultation' } },
          'Discussion': { type: 'referral', payload: { specialist: 'Counseling', reason: 'Patient discussion' } },
          'Documentation': { type: 'referral', payload: { specialist: 'Documentation', reason: 'Medical documentation' } },
          'Symptom Assessment': { type: 'lab', payload: { testName: 'Symptom Assessment', cpt: '96127', lab: 'Quest' } },
          'Symptom Management': { type: 'referral', payload: { specialist: 'Palliative Care', reason: 'Symptom management' } },
          'Symptom Review': { type: 'lab', payload: { testName: 'Symptom Diary Review', cpt: '96127', lab: 'Quest' } },
          'QOL Survey': { type: 'lab', payload: { testName: 'Quality of Life Survey', cpt: '96127', lab: 'Quest' } },
          'PRO Survey': { type: 'lab', payload: { testName: 'Patient-Reported Outcomes', cpt: '96127', lab: 'Quest' } },
          'Device Sync': { type: 'imaging', payload: { studyName: 'Device Data Sync', cpt: '93279' } },
          'App Setup': { type: 'referral', payload: { specialist: 'Technology Support', reason: 'Mobile app setup' } },
          'ECG Review': { type: 'imaging', payload: { studyName: 'ECG Review', cpt: '93000' } },
          'AI Analysis': { type: 'imaging', payload: { studyName: 'AI-Enhanced ECG Analysis', cpt: '93000' } },
          'Holter Setup': { type: 'imaging', payload: { studyName: 'Holter Monitor Setup', cpt: '93224' } },
          'Event Monitor Setup': { type: 'imaging', payload: { studyName: 'Event Monitor Setup', cpt: '93228' } },
          'Implant Procedure': { type: 'procedure', payload: { procedureName: 'Loop Recorder Implant', cpt: '33282' } },
          'MCT Setup': { type: 'imaging', payload: { studyName: 'Mobile Cardiac Telemetry Setup', cpt: '93228' } },
          'ABPM Setup': { type: 'imaging', payload: { studyName: 'Ambulatory BP Monitoring Setup', cpt: '93784' } },
          'BP Device': { type: 'referral', payload: { specialist: 'Equipment', reason: 'Home BP monitor' } },
          'Education Materials': { type: 'referral', payload: { specialist: 'Education', reason: 'Educational materials' } },
          'Action Plan': { type: 'referral', payload: { specialist: 'Care Planning', reason: 'Emergency action plan' } },
          'Med Supply': { type: 'referral', payload: { specialist: 'Pharmacy', reason: 'Medication supply' } },
          'Device Check': { type: 'imaging', payload: { studyName: 'Device Interrogation', cpt: '93279' } },
          'Safety Review': { type: 'referral', payload: { specialist: 'Safety', reason: 'Device safety review' } },
          'Drug Interactions': { type: 'lab', payload: { testName: 'Drug Interaction Check', cpt: '96127', lab: 'Quest' } },
          'Communication Plan': { type: 'referral', payload: { specialist: 'Communication', reason: 'Patient communication plan' } },
          'Process Review': { type: 'referral', payload: { specialist: 'Quality', reason: 'Process review' } },
          'Utilization Review': { type: 'referral', payload: { specialist: 'Utilization', reason: 'Resource review' } },
          'Survey': { type: 'lab', payload: { testName: 'Patient Satisfaction Survey', cpt: '96127', lab: 'Quest' } },
          'Screening': { type: 'lab', payload: { testName: 'Cardiac Screening', cpt: '96127', lab: 'Quest' } },
          'Data Entry': { type: 'referral', payload: { specialist: 'Registry', reason: 'Data entry' } },
          'Data Sharing': { type: 'referral', payload: { specialist: 'Research', reason: 'Data sharing' } },
          'Evaluation': { type: 'referral', payload: { specialist: 'Evaluation', reason: 'Technology evaluation' } },
          'Implementation': { type: 'referral', payload: { specialist: 'Implementation', reason: 'Best practice implementation' } },
          'Assessment': { type: 'lab', payload: { testName: 'Assessment', cpt: '96127', lab: 'Quest' } },
          'Model Review': { type: 'referral', payload: { specialist: 'Care Model', reason: 'Sustainable care model' } },
          'Planning': { type: 'referral', payload: { specialist: 'Planning', reason: 'Future care planning' } },
          'Preparation': { type: 'referral', payload: { specialist: 'Preparation', reason: 'Technology preparation' } },
          'Cost Review': { type: 'referral', payload: { specialist: 'Cost Analysis', reason: 'Cost-effective care' } },
          'Value Metrics': { type: 'lab', payload: { testName: 'Value-Based Metrics', cpt: '96127', lab: 'Quest' } },
          'Outcome Metrics': { type: 'lab', payload: { testName: 'Outcome Measurement', cpt: '96127', lab: 'Quest' } },
          'Quality Measures': { type: 'lab', payload: { testName: 'Quality Measures', cpt: '96127', lab: 'Quest' } },
          'AUC Review': { type: 'referral', payload: { specialist: 'Appropriate Use', reason: 'AUC review' } },
          'Selective Testing': { type: 'lab', payload: { testName: 'Selective Testing', cpt: '96127', lab: 'Quest' } },
          'Integration Check': { type: 'referral', payload: { specialist: 'IT', reason: 'EHR integration' } },
          'Data Sync': { type: 'imaging', payload: { studyName: 'Device Data Sync', cpt: '93279' } },
          'Functional Assessment': { type: 'procedure', payload: { procedureName: 'Functional Assessment', cpt: '96127' } },
          'Functional Test': { type: 'procedure', payload: { procedureName: 'Functional Testing', cpt: '94620' } },
          'Research Labs': { type: 'lab', payload: { testName: 'Research Laboratory Tests', cpt: '99000', lab: 'Quest' } },
          'Research Imaging': { type: 'imaging', payload: { studyName: 'Research Imaging', cpt: '99000' } },
          'Research Biomarker': { type: 'lab', payload: { testName: 'Research Biomarker', cpt: '99000', lab: 'Quest' } },
          'Pharmacogenomics': { type: 'lab', payload: { testName: 'Pharmacogenomics', cpt: '81479', lab: 'Quest' } },
          'Risk Score': { type: 'lab', payload: { testName: 'Cardiovascular Risk Score', cpt: '96127', lab: 'Quest' } },
          'Myocarditis Screen': { type: 'lab', payload: { testName: 'Myocarditis Screening', cpt: '84484', lab: 'Quest' } },
          'Hydration Assessment': { type: 'lab', payload: { testName: 'Hydration Status', cpt: '80048', lab: 'Quest' } },
          'Family History': { type: 'lab', payload: { testName: 'Family History Assessment', cpt: '96127', lab: 'Quest' } },
          'Counseling': { type: 'referral', payload: { specialist: 'Genetic Counseling', reason: 'Genetic counseling' } },
          'Chart Review': { type: 'referral', payload: { specialist: 'Chart Review', reason: 'Medical record review' } },
          'Med Reconciliation': { type: 'referral', payload: { specialist: 'Pharmacy', reason: 'Medication reconciliation' } },
          'Follow-up': { type: 'referral', payload: { specialist: 'Follow-up', reason: 'Follow-up appointment' } }
        };
        
        return orderAbbrevs.map(abbrev => orderMap[abbrev] || { type: 'lab', payload: { testName: abbrev, lab: 'Quest' } });
      };
      
      commonScenarios.forEach((scenario, idx) => {
        if (additionalOrdersets.length >= 500) return;
        
        const orders = mapOrders(scenario.orders);
        const category = categories[idx % categories.length];
        
        additionalOrdersets.push({
          name: scenario.name,
          description: `Standard cardiology orderset for ${scenario.name.toLowerCase()}`,
          specialty: 'cardiology',
          category: category,
          tags: [...scenario.tags, 'cardiology'],
          orders: orders
        });
      });
      
      return additionalOrdersets;
    };
    
    const additional500 = generate500CardiologyOrdersets();
    allOrdersets.push(...additional500);
    
    console.log(`Seeding ${allOrdersets.length} cardiology ordersets...`);
    
    let inserted = 0;
    let updated = 0;
    
    for (const orderset of allOrdersets) {
      try {
        // Check if orderset already exists
        const existing = await client.query('SELECT id FROM ordersets WHERE name = $1', [orderset.name]);
        
        if (existing.rows.length > 0) {
          // Update existing
          await client.query(`
            UPDATE ordersets 
            SET description = $1, category = $2, tags = $3, orders = $4, updated_at = CURRENT_TIMESTAMP
            WHERE name = $5
          `, [
            orderset.description,
            orderset.category,
            orderset.tags,
            JSON.stringify(orderset.orders),
            orderset.name
          ]);
          updated++;
        } else {
          // Insert new
          const result = await client.query(`
            INSERT INTO ordersets (name, description, specialty, category, tags, orders, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [
            orderset.name,
            orderset.description,
            orderset.specialty,
            orderset.category,
            orderset.tags,
            JSON.stringify(orderset.orders),
            true
          ]);
          
          if (result.rows.length > 0) {
            inserted++;
          }
        }
      } catch (error) {
        console.error(`Error inserting orderset ${orderset.name}:`, error.message);
        // Continue with next orderset
      }
    }
    
    await client.query('COMMIT');
    console.log(`✅ Successfully seeded ordersets:`);
    console.log(`   - Inserted: ${inserted}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Total: ${allOrdersets.length}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding ordersets:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  seedOrdersets()
    .then(() => {
      console.log('✅ Orderset seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Orderset seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedOrdersets };

