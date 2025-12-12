// Seed ICD-10 and CPT codes - OpenEMR style
const pool = require('../db');

const commonICD10Codes = [
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'M79.3', description: 'Panniculitis, unspecified' },
  { code: 'R50.9', description: 'Fever, unspecified' },
  { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings' },
  { code: 'Z51.11', description: 'Encounter for antineoplastic chemotherapy' },
];

const commonCPTCodes = [
  { code: '99213', description: 'Office or other outpatient visit, established patient', fee: 150.00 },
  { code: '99214', description: 'Office or other outpatient visit, established patient, detailed', fee: 200.00 },
  { code: '99215', description: 'Office or other outpatient visit, established patient, comprehensive', fee: 250.00 },
  { code: '99203', description: 'Office or other outpatient visit, new patient', fee: 200.00 },
  { code: '85025', description: 'Complete blood count (CBC)', fee: 25.00 },
  { code: '80053', description: 'Comprehensive metabolic panel', fee: 45.00 },
  { code: '93000', description: 'Electrocardiogram, routine ECG', fee: 75.00 },
];

async function seedCodes() {
  try {
    console.log('🌱 Seeding ICD-10 and CPT codes...\n');

    // Seed ICD-10 codes
    for (const icd10 of commonICD10Codes) {
      await pool.query(
        `INSERT INTO fee_schedule (code_type, code, description, fee_amount)
         VALUES ('ICD10', $1, $2, NULL)
         ON CONFLICT (code_type, code) DO NOTHING`,
        [icd10.code, icd10.description]
      );
    }
    console.log(`✅ Seeded ${commonICD10Codes.length} ICD-10 codes`);

    // Seed CPT codes
    for (const cpt of commonCPTCodes) {
      await pool.query(
        `INSERT INTO fee_schedule (code_type, code, description, fee_amount)
         VALUES ('CPT', $1, $2, $3)
         ON CONFLICT (code_type, code) DO NOTHING`,
        [cpt.code, cpt.description, cpt.fee]
      );
    }
    console.log(`✅ Seeded ${commonCPTCodes.length} CPT codes`);

    // Seed lab reference ranges
    const labRanges = [
      { testName: 'Hemoglobin A1C', testCode: 'A1C', normalMin: 4.0, normalMax: 5.6, units: '%', criticalHigh: 7.0 },
      { testName: 'Glucose', testCode: 'GLU', normalMin: 70, normalMax: 100, units: 'mg/dL', criticalLow: 60, criticalHigh: 140 },
      { testName: 'Creatinine', testCode: 'CREAT', normalMin: 0.6, normalMax: 1.2, units: 'mg/dL', criticalHigh: 2.0 },
    ];

    for (const range of labRanges) {
      await pool.query(
        `INSERT INTO lab_reference_ranges (test_name, test_code, normal_min, normal_max, units, critical_low, critical_high)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [range.testName, range.testCode, range.normalMin, range.normalMax, range.units, range.criticalLow || null, range.criticalHigh || null]
      );
    }
    console.log(`✅ Seeded ${labRanges.length} lab reference ranges\n`);

    console.log('✅ Code seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding codes:', error);
    process.exit(1);
  }
}

seedCodes();

































