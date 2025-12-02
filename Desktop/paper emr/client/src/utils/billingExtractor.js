/**
 * Comprehensive Billing Extractor
 * Analyzes clinical notes to extract all billable services, diagnoses, and quality measures
 * Based on 2024 Medicare/Medicaid billing requirements and quality measures
 */

// E/M Level Determination based on MDM Complexity
const EM_LEVELS = {
  newPatient: {
    straightforward: { code: '99202', minTime: 15, maxTime: 29 },
    low: { code: '99203', minTime: 30, maxTime: 44 },
    moderate: { code: '99204', minTime: 45, maxTime: 59 },
    high: { code: '99205', minTime: 60, maxTime: 74 }
  },
  established: {
    minimal: { code: '99211', minTime: 0, maxTime: 5 },
    straightforward: { code: '99212', minTime: 10, maxTime: 19 },
    low: { code: '99213', minTime: 20, maxTime: 29 },
    moderate: { code: '99214', minTime: 30, maxTime: 39 },
    high: { code: '99215', minTime: 40, maxTime: 54 }
  },
  preventive: {
    new18_39: '99385',
    new40_64: '99386',
    new65plus: '99387',
    est18_39: '99395',
    est40_64: '99396',
    est65plus: '99397'
  }
};

// Quality Measures that can be billed (Medicare/Medicaid)
const QUALITY_MEASURE_PATTERNS = {
  smokingCessation: {
    patterns: [
      /smok(ing|e|er)/i,
      /tobacco/i,
      /nicotine/i,
      /cigarette/i,
      /vap(e|ing)/i,
      /cessation counseling/i,
      /quit(ting)?\s*(smoking|tobacco)/i,
      /advised\s+(to\s+)?(stop|quit|cessation)/i,
      /counseled\s+(on|about|regarding)\s+(smoking|tobacco)/i
    ],
    cptCodes: [
      { code: '99406', description: 'Smoking cessation counseling, 3-10 minutes', minTime: 3 },
      { code: '99407', description: 'Smoking cessation counseling, >10 minutes', minTime: 10 }
    ],
    icd10Codes: ['Z71.6', 'F17.210', 'F17.200', 'Z72.0', 'Z87.891']
  },
  alcoholScreening: {
    patterns: [
      /alcohol\s*(use|abuse|screening|misuse)/i,
      /AUDIT(-C)?/i,
      /CAGE/i,
      /drinking\s*(habits?|history)/i,
      /alcohol\s*counseling/i,
      /brief\s*intervention/i,
      /SBIRT/i
    ],
    cptCodes: [
      { code: 'G0442', description: 'Annual alcohol misuse screening, 15 min' },
      { code: 'G0443', description: 'Brief behavioral counseling for alcohol misuse, 15 min' },
      { code: '99408', description: 'Alcohol/substance abuse screening & brief intervention, 15-30 min' },
      { code: '99409', description: 'Alcohol/substance abuse screening & brief intervention, >30 min' }
    ],
    icd10Codes: ['Z71.41', 'F10.10', 'F10.20']
  },
  depressionScreening: {
    patterns: [
      /PHQ(-?9|-?2)?/i,
      /depression\s*screen(ing)?/i,
      /mood\s*(assessment|evaluation)/i,
      /Beck\s*Depression/i,
      /Hamilton\s*Depression/i,
      /depressed\s*mood/i,
      /suicidal\s*ideation/i
    ],
    cptCodes: [
      { code: 'G0444', description: 'Annual depression screening, 15 min' },
      { code: '96127', description: 'Brief emotional/behavioral assessment' }
    ],
    icd10Codes: ['F32.9', 'F33.0', 'F33.1', 'F41.1']
  },
  obesityCounseling: {
    patterns: [
      /BMI\s*(>|over|above)?\s*(25|30|35|40)/i,
      /obes(e|ity)/i,
      /overweight/i,
      /weight\s*(loss|management|counseling)/i,
      /diet(ary)?\s*counseling/i,
      /nutrition\s*counseling/i,
      /lifestyle\s*modification/i,
      /exercise\s*counseling/i
    ],
    cptCodes: [
      { code: 'G0447', description: 'Face-to-face behavioral counseling for obesity, 15 min' },
      { code: 'G0270', description: 'Medical nutrition therapy, initial, 15 min' },
      { code: 'G0271', description: 'Medical nutrition therapy, reassessment, 15 min' }
    ],
    icd10Codes: ['E66.9', 'E66.01', 'Z68.30', 'Z68.35', 'Z68.40', 'Z68.45', 'Z71.3', 'Z71.82']
  },
  cardiovascularCounseling: {
    patterns: [
      /cardiovascular\s*(risk|disease|counseling)/i,
      /heart\s*disease\s*prevention/i,
      /aspirin\s*therapy/i,
      /statin\s*therapy/i,
      /lipid\s*(management|counseling)/i,
      /cholesterol\s*counseling/i,
      /blood\s*pressure\s*counseling/i
    ],
    cptCodes: [
      { code: 'G0446', description: 'Intensive behavioral therapy for cardiovascular disease, 15 min' }
    ],
    icd10Codes: ['I10', 'E78.5', 'E78.00', 'I25.10']
  },
  diabetesEducation: {
    patterns: [
      /diabet(es|ic)\s*(education|counseling|management)/i,
      /glucose\s*monitoring/i,
      /A1C\s*(counseling|education)/i,
      /insulin\s*(education|teaching)/i,
      /hypoglycemia\s*education/i,
      /self-?management/i
    ],
    cptCodes: [
      { code: 'G0108', description: 'Diabetes outpatient self-management training, individual' },
      { code: 'G0109', description: 'Diabetes outpatient self-management training, group' }
    ],
    icd10Codes: ['E11.9', 'E11.65', 'E11.21', 'E11.40', 'E11.42']
  }
};

// Procedure patterns to detect from notes
const PROCEDURE_PATTERNS = {
  injections: {
    patterns: [
      /joint\s*injection/i,
      /trigger\s*point\s*injection/i,
      /steroid\s*injection/i,
      /cortisone\s*injection/i,
      /kenalog/i,
      /depo-?medrol/i,
      /arthrocentesis/i,
      /aspiration/i
    ],
    cptCodes: [
      { code: '20610', description: 'Arthrocentesis, major joint (knee, shoulder, hip)', keywords: ['knee', 'shoulder', 'hip'] },
      { code: '20605', description: 'Arthrocentesis, intermediate joint (wrist, elbow, ankle)', keywords: ['wrist', 'elbow', 'ankle'] },
      { code: '20600', description: 'Arthrocentesis, small joint (finger, toe)', keywords: ['finger', 'toe', 'small'] },
      { code: '20552', description: 'Injection, trigger point(s), 1 or 2 muscles' },
      { code: '20553', description: 'Injection, trigger point(s), 3 or more muscles' }
    ]
  },
  skinProcedures: {
    patterns: [
      /skin\s*tag\s*removal/i,
      /lesion\s*(removal|excision|destruction)/i,
      /cryotherapy/i,
      /liquid\s*nitrogen/i,
      /wart\s*(removal|treatment)/i,
      /biopsy/i,
      /shave\s*biopsy/i,
      /punch\s*biopsy/i
    ],
    cptCodes: [
      { code: '11200', description: 'Removal of skin tags, up to 15' },
      { code: '17110', description: 'Destruction of benign lesions, up to 14' },
      { code: '17000', description: 'Destruction of premalignant lesion, first lesion' }
    ]
  },
  woundCare: {
    patterns: [
      /laceration\s*repair/i,
      /sutur(e|ing)/i,
      /wound\s*(repair|closure)/i,
      /I&D/i,
      /incision\s*and\s*drainage/i,
      /abscess\s*drainage/i
    ],
    cptCodes: [
      { code: '12001', description: 'Simple repair of superficial wounds, 2.5 cm or less' },
      { code: '12002', description: 'Simple repair of superficial wounds, 2.6-7.5 cm' },
      { code: '10060', description: 'Incision and drainage of abscess, simple' },
      { code: '10061', description: 'Incision and drainage of abscess, complicated' }
    ]
  },
  diagnostic: {
    patterns: [
      /EKG|ECG|electrocardiogram/i,
      /spirometry/i,
      /pulmonary\s*function/i,
      /nebulizer/i,
      /breathing\s*treatment/i
    ],
    cptCodes: [
      { code: '93000', description: 'Electrocardiogram, routine ECG with interpretation' },
      { code: '94010', description: 'Spirometry' },
      { code: '94060', description: 'Spirometry with bronchodilator response' },
      { code: '94640', description: 'Nebulizer treatment' }
    ]
  },
  immunizations: {
    patterns: [
      /vaccin(e|ation)/i,
      /immunization/i,
      /flu\s*shot/i,
      /influenza\s*vaccine/i,
      /pneumonia\s*vaccine/i,
      /shingles\s*vaccine/i,
      /Tdap/i,
      /tetanus/i,
      /COVID(-19)?\s*vaccine/i
    ],
    cptCodes: [
      { code: '90471', description: 'Immunization administration, first vaccine' },
      { code: '90472', description: 'Immunization administration, each additional vaccine' },
      { code: '90686', description: 'Influenza vaccine, quadrivalent' },
      { code: '90732', description: 'Pneumococcal vaccine (PPSV23)' }
    ]
  },
  labsInOffice: {
    patterns: [
      /rapid\s*strep/i,
      /strep\s*test/i,
      /rapid\s*flu/i,
      /flu\s*test/i,
      /urinalysis|UA\b/i,
      /urine\s*dip/i,
      /glucose\s*(check|test|finger\s*stick)/i,
      /A1C\s*(check|test)/i,
      /INR\s*(check|test)/i,
      /pregnancy\s*test/i,
      /COVID\s*test/i
    ],
    cptCodes: [
      { code: '87880', description: 'Rapid strep test' },
      { code: '87804', description: 'Rapid flu test' },
      { code: '81002', description: 'Urinalysis, non-automated, without microscopy' },
      { code: '82962', description: 'Glucose, blood by glucose monitoring device' },
      { code: '83036', description: 'Hemoglobin A1c' },
      { code: '85610', description: 'Prothrombin time (PT/INR)' },
      { code: '81025', description: 'Urine pregnancy test' },
      { code: '87426', description: 'COVID-19 antigen test' }
    ]
  }
};

// Common diagnosis keyword mappings
const DIAGNOSIS_KEYWORDS = {
  // Respiratory
  'cough': ['R05.9'],
  'cold': ['J06.9'],
  'uri': ['J06.9'],
  'upper respiratory': ['J06.9'],
  'bronchitis': ['J20.9'],
  'pneumonia': ['J18.9'],
  'asthma': ['J45.20', 'J45.30', 'J45.40'],
  'copd': ['J44.1'],
  'shortness of breath': ['R06.02'],
  
  // Cardiovascular
  'hypertension': ['I10'],
  'high blood pressure': ['I10'],
  'htn': ['I10'],
  'chest pain': ['R07.9'],
  'palpitations': ['R00.2'],
  'atrial fibrillation': ['I48.91'],
  'afib': ['I48.91'],
  'heart failure': ['I50.9'],
  'chf': ['I50.9'],
  
  // Metabolic
  'diabetes': ['E11.9'],
  'type 2 diabetes': ['E11.9'],
  'dm2': ['E11.9'],
  'hyperlipidemia': ['E78.5'],
  'high cholesterol': ['E78.00'],
  'obesity': ['E66.9'],
  'morbid obesity': ['E66.01'],
  'hypothyroid': ['E03.9'],
  
  // Musculoskeletal
  'back pain': ['M54.5'],
  'low back pain': ['M54.5'],
  'lbp': ['M54.5'],
  'knee pain': ['M25.561', 'M25.562'],
  'osteoarthritis': ['M17.11', 'M17.12'],
  'joint pain': ['M25.50'],
  'muscle pain': ['M79.1'],
  
  // GI
  'gerd': ['K21.0'],
  'acid reflux': ['K21.0'],
  'abdominal pain': ['R10.9'],
  'nausea': ['R11.0'],
  'diarrhea': ['R19.7'],
  'constipation': ['K59.00'],
  
  // GU
  'uti': ['N39.0'],
  'urinary tract infection': ['N39.0'],
  
  // Neuro
  'headache': ['R51.9'],
  'migraine': ['G43.909'],
  'dizziness': ['R42'],
  
  // Psych
  'depression': ['F32.9'],
  'anxiety': ['F41.1'],
  'insomnia': ['G47.00'],
  
  // Preventive
  'annual exam': ['Z00.00'],
  'physical': ['Z00.00'],
  'wellness': ['Z00.00'],
  'preventive': ['Z00.00']
};

/**
 * Extract time from note (for time-based billing)
 */
export function extractTimeFromNote(noteText) {
  const timePatterns = [
    /(\d+)\s*min(ute)?s?\s*(spent|total|face.?to.?face)/i,
    /time\s*:?\s*(\d+)\s*min/i,
    /(\d+)\s*min(ute)?s?\s*with\s*patient/i,
    /total\s*time\s*:?\s*(\d+)/i,
    /face.?to.?face\s*:?\s*(\d+)/i
  ];
  
  for (const pattern of timePatterns) {
    const match = noteText.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }
  
  // Estimate time based on note length (rough heuristic)
  const wordCount = noteText.split(/\s+/).length;
  if (wordCount < 100) return 10;
  if (wordCount < 200) return 15;
  if (wordCount < 400) return 20;
  if (wordCount < 600) return 30;
  if (wordCount < 800) return 40;
  return 45;
}

/**
 * Determine E/M level based on note complexity
 */
export function determineEMLevel(noteText, visitType, patientAge, isNewPatient = false) {
  const lowerNote = noteText.toLowerCase();
  
  // Check for preventive visit
  if (visitType?.toLowerCase().includes('physical') || 
      visitType?.toLowerCase().includes('annual') ||
      visitType?.toLowerCase().includes('wellness') ||
      visitType?.toLowerCase().includes('preventive')) {
    
    if (isNewPatient) {
      if (patientAge < 40) return { code: '99385', level: 'preventive' };
      if (patientAge < 65) return { code: '99386', level: 'preventive' };
      return { code: '99387', level: 'preventive' };
    } else {
      if (patientAge < 40) return { code: '99395', level: 'preventive' };
      if (patientAge < 65) return { code: '99396', level: 'preventive' };
      return { code: '99397', level: 'preventive' };
    }
  }
  
  // Calculate MDM complexity score
  let complexityScore = 0;
  
  // Number of diagnoses addressed
  const diagnosisCount = (lowerNote.match(/assessment|diagnosis|problem|dx/gi) || []).length;
  if (diagnosisCount >= 4) complexityScore += 3;
  else if (diagnosisCount >= 2) complexityScore += 2;
  else complexityScore += 1;
  
  // Data reviewed
  if (/lab(s|oratory)?|test results?|imaging|x-?ray|ct|mri|ultrasound/i.test(lowerNote)) complexityScore += 1;
  if (/ekg|ecg|echo|stress test/i.test(lowerNote)) complexityScore += 1;
  if (/consult|specialist|referral/i.test(lowerNote)) complexityScore += 1;
  if (/prior (records?|notes?)|outside records?/i.test(lowerNote)) complexityScore += 1;
  
  // Risk assessment
  if (/high risk|critical|emergent|urgent|severe/i.test(lowerNote)) complexityScore += 3;
  if (/moderate risk|significant|concerning/i.test(lowerNote)) complexityScore += 2;
  if (/prescription|medication (change|adjustment|new)|refill/i.test(lowerNote)) complexityScore += 1;
  
  // Chronic conditions
  const chronicConditions = ['diabetes', 'hypertension', 'heart failure', 'copd', 'ckd', 'cancer', 'stroke', 'cad'];
  const chronicCount = chronicConditions.filter(c => lowerNote.includes(c)).length;
  complexityScore += Math.min(chronicCount, 3);
  
  // Time spent
  const timeSpent = extractTimeFromNote(noteText);
  
  // Determine level based on complexity score and time
  const levels = isNewPatient ? EM_LEVELS.newPatient : EM_LEVELS.established;
  
  if (complexityScore >= 8 || timeSpent >= 40) {
    return { code: isNewPatient ? '99205' : '99215', level: 'high', timeSpent, complexityScore };
  }
  if (complexityScore >= 5 || timeSpent >= 30) {
    return { code: isNewPatient ? '99204' : '99214', level: 'moderate', timeSpent, complexityScore };
  }
  if (complexityScore >= 3 || timeSpent >= 20) {
    return { code: isNewPatient ? '99203' : '99213', level: 'low', timeSpent, complexityScore };
  }
  return { code: isNewPatient ? '99202' : '99212', level: 'straightforward', timeSpent, complexityScore };
}

/**
 * Extract quality measures from note
 */
export function extractQualityMeasures(noteText) {
  const measures = [];
  const lowerNote = noteText.toLowerCase();
  
  for (const [measureName, config] of Object.entries(QUALITY_MEASURE_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(noteText)) {
        measures.push({
          measure: measureName,
          cptCodes: config.cptCodes,
          icd10Codes: config.icd10Codes,
          matched: true
        });
        break;
      }
    }
  }
  
  return measures;
}

/**
 * Extract procedures from note
 */
export function extractProcedures(noteText) {
  const procedures = [];
  
  for (const [procType, config] of Object.entries(PROCEDURE_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(noteText)) {
        procedures.push({
          type: procType,
          cptCodes: config.cptCodes,
          matched: true
        });
        break;
      }
    }
  }
  
  return procedures;
}

/**
 * Extract ICD-10 codes from note text using multiple strategies
 */
export function extractDiagnosisCodes(noteText, patientProblems = []) {
  const codes = new Map(); // Use Map to prevent duplicates
  const lowerNote = noteText.toLowerCase();
  
  // 1. Add patient's active problems
  patientProblems.forEach(p => {
    if (p.icd10_code) {
      codes.set(p.icd10_code, {
        code: p.icd10_code,
        description: p.problem_name || 'Patient problem',
        source: 'problem_list'
      });
    }
  });
  
  // 2. Extract explicit ICD-10 codes from note - ONLY codes explicitly marked with prefixes
  // This prevents false positives from random text that happens to match ICD-10 format
  const explicitPatterns = [
    /(?:ICD[-\s]?10|ICD|Dx|Diagnosis|Diagnoses):\s*([A-Z]\d{2,3}(?:\.\d{1,4})?)/gi
  ];
  
  for (const pattern of explicitPatterns) {
    let match;
    while ((match = pattern.exec(noteText)) !== null) {
      const code = match[1].toUpperCase();
      // Validate it's a real ICD-10 format (letter followed by digits)
      if (!codes.has(code) && /^[A-Z]\d{2}/.test(code)) {
        codes.set(code, {
          code,
          description: 'Explicitly marked in note',
          source: 'explicit'
        });
      }
    }
  }
  
  // 3. Extract from Assessment section - Only extract codes explicitly marked with prefixes
  // Removed bracket/parenthesis matching to prevent false positives
  const assessmentMatch = noteText.match(/(?:Assessment|A\/P|Assessment\s*(?:and|&)\s*Plan):\s*([\s\S]+?)(?:\n\n|\n(?:Plan|P):|$)/i);
  if (assessmentMatch) {
    const assessmentText = assessmentMatch[1];
    
    // Only extract codes explicitly marked with ICD10/Dx/etc prefixes
    const explicitPatterns = [
      /(?:ICD[-\s]?10|ICD|Dx|Diagnosis|Diagnoses):\s*([A-Z]\d{2,3}(?:\.\d{1,4})?)/gi
    ];
    
    for (const pattern of explicitPatterns) {
      let match;
      while ((match = pattern.exec(assessmentText)) !== null) {
        const code = match[1].toUpperCase();
        if (!codes.has(code) && /^[A-Z]\d{2}/.test(code)) {
          codes.set(code, {
            code,
            description: 'From assessment section',
            source: 'assessment'
          });
        }
      }
    }
  }
  
  // NOTE: Removed keyword matching to prevent false positives
  // Only use explicit codes, patient problems, and codes from assessment section
  // This ensures accuracy and prevents billing fraud
  
  return Array.from(codes.values());
}

/**
 * Main billing extraction function
 */
export function extractBillableServices(noteText, options = {}) {
  const {
    visitType = 'Office Visit',
    patientAge = 45,
    isNewPatient = false,
    patientProblems = [],
    feeSchedule = []
  } = options;
  
  const results = {
    emLevel: null,
    diagnosisCodes: [],
    procedureCodes: [],
    qualityMeasures: [],
    additionalServices: [],
    totalEstimate: 0,
    billingNotes: []
  };
  
  // 1. Determine E/M level
  results.emLevel = determineEMLevel(noteText, visitType, patientAge, isNewPatient);
  
  // Add E/M code to procedure codes
  const emFee = feeSchedule.find(f => f.code === results.emLevel.code && f.code_type === 'CPT');
  if (emFee) {
    results.procedureCodes.push({
      code: emFee.code,
      description: emFee.description,
      amount: parseFloat(emFee.fee_amount) || 0,
      isPrimary: true
    });
    results.totalEstimate += parseFloat(emFee.fee_amount) || 0;
    results.billingNotes.push(`E/M Level: ${results.emLevel.level} (${results.emLevel.code}) - Based on ${results.emLevel.timeSpent || 'estimated'} minutes and complexity score ${results.emLevel.complexityScore}`);
  }
  
  // 2. Extract diagnosis codes
  results.diagnosisCodes = extractDiagnosisCodes(noteText, patientProblems);
  
  // 3. Extract quality measures
  const qualityMeasures = extractQualityMeasures(noteText);
  qualityMeasures.forEach(measure => {
    results.qualityMeasures.push(measure);
    
    // Add billable quality measure CPT codes
    measure.cptCodes.forEach(cpt => {
      const fee = feeSchedule.find(f => f.code === cpt.code && f.code_type === 'CPT');
      if (fee && !results.procedureCodes.find(p => p.code === cpt.code)) {
        results.procedureCodes.push({
          code: fee.code,
          description: fee.description,
          amount: parseFloat(fee.fee_amount) || 0,
          qualityMeasure: measure.measure
        });
        results.totalEstimate += parseFloat(fee.fee_amount) || 0;
        results.billingNotes.push(`Quality Measure: ${measure.measure} - Added ${cpt.code}`);
      }
    });
    
    // Add related ICD-10 codes
    measure.icd10Codes.forEach(icd => {
      if (!results.diagnosisCodes.find(d => d.code === icd)) {
        const icdFee = feeSchedule.find(f => f.code === icd && f.code_type === 'ICD10');
        results.diagnosisCodes.push({
          code: icd,
          description: icdFee?.description || `Related to ${measure.measure}`,
          source: 'quality_measure'
        });
      }
    });
  });
  
  // 4. Extract procedures
  const procedures = extractProcedures(noteText);
  procedures.forEach(proc => {
    proc.cptCodes.forEach(cpt => {
      const fee = feeSchedule.find(f => f.code === cpt.code && f.code_type === 'CPT');
      if (fee && !results.procedureCodes.find(p => p.code === cpt.code)) {
        results.procedureCodes.push({
          code: fee.code,
          description: fee.description,
          amount: parseFloat(fee.fee_amount) || 0,
          procedureType: proc.type
        });
        results.totalEstimate += parseFloat(fee.fee_amount) || 0;
        results.billingNotes.push(`Procedure detected: ${proc.type} - Added ${cpt.code}`);
      }
    });
  });
  
  // 5. Check for prolonged services
  const timeSpent = extractTimeFromNote(noteText);
  if (timeSpent > 54 && !isNewPatient) {
    const prolongedMinutes = timeSpent - 54;
    const prolongedUnits = Math.floor(prolongedMinutes / 15);
    if (prolongedUnits > 0) {
      const prolongedFee = feeSchedule.find(f => f.code === '99417' && f.code_type === 'CPT');
      if (prolongedFee) {
        const totalProlonged = (parseFloat(prolongedFee.fee_amount) || 0) * prolongedUnits;
        results.procedureCodes.push({
          code: '99417',
          description: `${prolongedFee.description} x${prolongedUnits}`,
          amount: totalProlonged,
          units: prolongedUnits
        });
        results.totalEstimate += totalProlonged;
        results.billingNotes.push(`Prolonged services: ${prolongedUnits} units (${prolongedMinutes} additional minutes)`);
      }
    }
  }
  
  // 6. Add billing optimization suggestions
  if (!qualityMeasures.find(m => m.measure === 'smokingCessation') && 
      /smoke|tobacco|nicotine/i.test(noteText)) {
    results.billingNotes.push('💡 TIP: Document smoking cessation counseling time to bill 99406/99407');
  }
  
  if (!qualityMeasures.find(m => m.measure === 'depressionScreening') && 
      /depress|anxiety|mood/i.test(noteText)) {
    results.billingNotes.push('💡 TIP: Document PHQ-9 screening to bill G0444');
  }
  
  if (!qualityMeasures.find(m => m.measure === 'obesityCounseling') && 
      /BMI|obes|overweight|weight/i.test(noteText)) {
    results.billingNotes.push('💡 TIP: Document obesity counseling to bill G0447');
  }
  
  return results;
}

export default {
  extractBillableServices,
  extractDiagnosisCodes,
  extractQualityMeasures,
  extractProcedures,
  determineEMLevel,
  extractTimeFromNote
};

