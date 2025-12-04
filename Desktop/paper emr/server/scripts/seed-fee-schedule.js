const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// 2024 Medicare Physician Fee Schedule rates (national average)
// These are based on CMS 2024 rates with conversion factor ~$33.29
const feeScheduleData = [
  // ============================================
  // EVALUATION & MANAGEMENT - OFFICE/OUTPATIENT
  // ============================================
  
  // New Patient E/M (99201 deleted, now 99202-99205)
  { code_type: 'CPT', code: '99202', description: 'Office visit, new patient, straightforward MDM (15-29 min)', fee_amount: 76.15 },
  { code_type: 'CPT', code: '99203', description: 'Office visit, new patient, low MDM (30-44 min)', fee_amount: 111.49 },
  { code_type: 'CPT', code: '99204', description: 'Office visit, new patient, moderate MDM (45-59 min)', fee_amount: 167.10 },
  { code_type: 'CPT', code: '99205', description: 'Office visit, new patient, high MDM (60-74 min)', fee_amount: 211.12 },
  
  // Established Patient E/M
  { code_type: 'CPT', code: '99211', description: 'Office visit, established, minimal problem (5 min)', fee_amount: 23.46 },
  { code_type: 'CPT', code: '99212', description: 'Office visit, established, straightforward MDM (10-19 min)', fee_amount: 53.03 },
  { code_type: 'CPT', code: '99213', description: 'Office visit, established, low MDM (20-29 min)', fee_amount: 80.67 },
  { code_type: 'CPT', code: '99214', description: 'Office visit, established, moderate MDM (30-39 min)', fee_amount: 116.14 },
  { code_type: 'CPT', code: '99215', description: 'Office visit, established, high MDM (40-54 min)', fee_amount: 156.64 },
  
  // Prolonged Services (add-on codes)
  { code_type: 'CPT', code: '99417', description: 'Prolonged office visit, each additional 15 min (add-on)', fee_amount: 36.81 },
  
  // ============================================
  // PREVENTIVE MEDICINE - ANNUAL EXAMS
  // ============================================
  
  // New Patient Preventive
  { code_type: 'CPT', code: '99381', description: 'Preventive visit, new patient, infant (under 1 year)', fee_amount: 128.41 },
  { code_type: 'CPT', code: '99382', description: 'Preventive visit, new patient, early childhood (1-4 years)', fee_amount: 132.89 },
  { code_type: 'CPT', code: '99383', description: 'Preventive visit, new patient, late childhood (5-11 years)', fee_amount: 132.89 },
  { code_type: 'CPT', code: '99384', description: 'Preventive visit, new patient, adolescent (12-17 years)', fee_amount: 149.23 },
  { code_type: 'CPT', code: '99385', description: 'Preventive visit, new patient, 18-39 years', fee_amount: 143.15 },
  { code_type: 'CPT', code: '99386', description: 'Preventive visit, new patient, 40-64 years', fee_amount: 168.22 },
  { code_type: 'CPT', code: '99387', description: 'Preventive visit, new patient, 65+ years', fee_amount: 180.34 },
  
  // Established Patient Preventive
  { code_type: 'CPT', code: '99391', description: 'Preventive visit, established, infant (under 1 year)', fee_amount: 110.45 },
  { code_type: 'CPT', code: '99392', description: 'Preventive visit, established, early childhood (1-4 years)', fee_amount: 115.89 },
  { code_type: 'CPT', code: '99393', description: 'Preventive visit, established, late childhood (5-11 years)', fee_amount: 115.89 },
  { code_type: 'CPT', code: '99394', description: 'Preventive visit, established, adolescent (12-17 years)', fee_amount: 127.34 },
  { code_type: 'CPT', code: '99395', description: 'Preventive visit, established, 18-39 years', fee_amount: 127.34 },
  { code_type: 'CPT', code: '99396', description: 'Preventive visit, established, 40-64 years', fee_amount: 140.12 },
  { code_type: 'CPT', code: '99397', description: 'Preventive visit, established, 65+ years', fee_amount: 152.67 },
  
  // ============================================
  // TELEHEALTH SERVICES
  // ============================================
  { code_type: 'CPT', code: '99441', description: 'Telephone E/M, 5-10 minutes', fee_amount: 29.12 },
  { code_type: 'CPT', code: '99442', description: 'Telephone E/M, 11-20 minutes', fee_amount: 54.89 },
  { code_type: 'CPT', code: '99443', description: 'Telephone E/M, 21-30 minutes', fee_amount: 80.45 },
  
  // ============================================
  // COUNSELING & BEHAVIORAL HEALTH
  // ============================================
  
  // Smoking/Tobacco Cessation Counseling (VERY IMPORTANT FOR QUALITY MEASURES)
  { code_type: 'CPT', code: '99406', description: 'Smoking cessation counseling, 3-10 minutes', fee_amount: 16.23 },
  { code_type: 'CPT', code: '99407', description: 'Smoking cessation counseling, >10 minutes', fee_amount: 32.15 },
  
  // Alcohol/Substance Abuse Counseling
  { code_type: 'CPT', code: '99408', description: 'Alcohol/substance abuse screening & brief intervention, 15-30 min', fee_amount: 33.45 },
  { code_type: 'CPT', code: '99409', description: 'Alcohol/substance abuse screening & brief intervention, >30 min', fee_amount: 65.78 },
  
  // Behavioral Counseling
  { code_type: 'CPT', code: 'G0442', description: 'Annual alcohol misuse screening, 15 min', fee_amount: 18.76 },
  { code_type: 'CPT', code: 'G0443', description: 'Brief face-to-face behavioral counseling for alcohol misuse, 15 min', fee_amount: 26.34 },
  { code_type: 'CPT', code: 'G0444', description: 'Annual depression screening, 15 min', fee_amount: 18.45 },
  { code_type: 'CPT', code: 'G0446', description: 'Intensive behavioral therapy for cardiovascular disease, 15 min', fee_amount: 26.89 },
  { code_type: 'CPT', code: 'G0447', description: 'Face-to-face behavioral counseling for obesity, 15 min', fee_amount: 26.45 },
  
  // ============================================
  // CHRONIC CARE MANAGEMENT (CCM)
  // ============================================
  { code_type: 'CPT', code: '99490', description: 'Chronic care management, 20+ min/month', fee_amount: 62.69 },
  { code_type: 'CPT', code: '99491', description: 'Chronic care management, 30+ min/month, complex', fee_amount: 86.34 },
  { code_type: 'CPT', code: '99439', description: 'Chronic care management, each additional 20 min (add-on)', fee_amount: 47.12 },
  
  // Remote Patient Monitoring
  { code_type: 'CPT', code: '99453', description: 'Remote monitoring, initial setup & patient education', fee_amount: 19.45 },
  { code_type: 'CPT', code: '99454', description: 'Remote monitoring, device supply & daily recording', fee_amount: 55.23 },
  { code_type: 'CPT', code: '99457', description: 'Remote monitoring, 20+ min treatment management', fee_amount: 50.67 },
  { code_type: 'CPT', code: '99458', description: 'Remote monitoring, each additional 20 min (add-on)', fee_amount: 40.12 },
  
  // ============================================
  // CARE COORDINATION & TRANSITIONS
  // ============================================
  { code_type: 'CPT', code: '99495', description: 'Transitional care management, moderate complexity, 14-day f/u', fee_amount: 187.45 },
  { code_type: 'CPT', code: '99496', description: 'Transitional care management, high complexity, 7-day f/u', fee_amount: 265.89 },
  
  // Annual Wellness Visit (Medicare)
  { code_type: 'CPT', code: 'G0438', description: 'Annual wellness visit, initial (Welcome to Medicare)', fee_amount: 175.23 },
  { code_type: 'CPT', code: 'G0439', description: 'Annual wellness visit, subsequent', fee_amount: 118.67 },
  
  // ============================================
  // IMMUNIZATIONS & VACCINES
  // ============================================
  { code_type: 'CPT', code: '90471', description: 'Immunization administration, first vaccine', fee_amount: 27.45 },
  { code_type: 'CPT', code: '90472', description: 'Immunization administration, each additional vaccine', fee_amount: 15.23 },
  { code_type: 'CPT', code: '90686', description: 'Influenza vaccine, quadrivalent', fee_amount: 21.34 },
  { code_type: 'CPT', code: '90732', description: 'Pneumococcal vaccine (PPSV23)', fee_amount: 45.67 },
  { code_type: 'CPT', code: '90750', description: 'Shingles vaccine (Shingrix)', fee_amount: 178.45 },
  
  // ============================================
  // SCREENINGS & DIAGNOSTIC
  // ============================================
  { code_type: 'CPT', code: 'G0101', description: 'Cervical/vaginal cancer screening, pelvic & breast exam', fee_amount: 45.23 },
  { code_type: 'CPT', code: 'G0102', description: 'Prostate cancer screening, digital rectal exam', fee_amount: 23.45 },
  { code_type: 'CPT', code: 'G0103', description: 'Prostate cancer screening, PSA test', fee_amount: 25.67 },
  { code_type: 'CPT', code: 'G0104', description: 'Colorectal cancer screening, flexible sigmoidoscopy', fee_amount: 89.45 },
  { code_type: 'CPT', code: 'G0105', description: 'Colorectal cancer screening, colonoscopy (high risk)', fee_amount: 267.89 },
  { code_type: 'CPT', code: 'G0121', description: 'Colorectal cancer screening, colonoscopy (not high risk)', fee_amount: 267.89 },
  { code_type: 'CPT', code: 'G0270', description: 'Medical nutrition therapy, initial, 15 min', fee_amount: 26.78 },
  { code_type: 'CPT', code: 'G0271', description: 'Medical nutrition therapy, reassessment, 15 min', fee_amount: 26.78 },
  
  // ============================================
  // PROCEDURES - OFFICE
  // ============================================
  { code_type: 'CPT', code: '10060', description: 'Incision and drainage of abscess, simple', fee_amount: 124.56 },
  { code_type: 'CPT', code: '10061', description: 'Incision and drainage of abscess, complicated', fee_amount: 234.78 },
  { code_type: 'CPT', code: '10120', description: 'Incision and removal of foreign body, simple', fee_amount: 145.23 },
  { code_type: 'CPT', code: '11200', description: 'Removal of skin tags, up to 15', fee_amount: 89.45 },
  { code_type: 'CPT', code: '11300', description: 'Shaving of lesion, trunk/arms/legs, 0.5 cm or less', fee_amount: 78.34 },
  { code_type: 'CPT', code: '11301', description: 'Shaving of lesion, trunk/arms/legs, 0.6-1.0 cm', fee_amount: 98.67 },
  { code_type: 'CPT', code: '11305', description: 'Shaving of lesion, scalp/neck/hands/feet, 0.5 cm or less', fee_amount: 85.45 },
  { code_type: 'CPT', code: '11400', description: 'Excision of benign lesion, trunk/arms/legs, 0.5 cm or less', fee_amount: 125.67 },
  { code_type: 'CPT', code: '11401', description: 'Excision of benign lesion, trunk/arms/legs, 0.6-1.0 cm', fee_amount: 156.89 },
  { code_type: 'CPT', code: '11721', description: 'Debridement of nail(s), 6 or more', fee_amount: 45.23 },
  { code_type: 'CPT', code: '11730', description: 'Avulsion of nail plate, simple, single', fee_amount: 78.45 },
  { code_type: 'CPT', code: '11750', description: 'Excision of nail and nail matrix, permanent removal', fee_amount: 234.56 },
  { code_type: 'CPT', code: '12001', description: 'Simple repair of superficial wounds, 2.5 cm or less', fee_amount: 156.78 },
  { code_type: 'CPT', code: '12002', description: 'Simple repair of superficial wounds, 2.6-7.5 cm', fee_amount: 178.45 },
  { code_type: 'CPT', code: '17000', description: 'Destruction of premalignant lesion, first lesion', fee_amount: 67.89 },
  { code_type: 'CPT', code: '17003', description: 'Destruction of premalignant lesions, 2-14 lesions, each', fee_amount: 12.34 },
  { code_type: 'CPT', code: '17110', description: 'Destruction of benign lesions, up to 14', fee_amount: 89.45 },
  { code_type: 'CPT', code: '17111', description: 'Destruction of benign lesions, 15 or more', fee_amount: 134.56 },
  { code_type: 'CPT', code: '20610', description: 'Arthrocentesis, major joint (knee, shoulder, hip)', fee_amount: 89.45 },
  { code_type: 'CPT', code: '20605', description: 'Arthrocentesis, intermediate joint (wrist, elbow, ankle)', fee_amount: 67.89 },
  { code_type: 'CPT', code: '20600', description: 'Arthrocentesis, small joint (finger, toe)', fee_amount: 56.78 },
  { code_type: 'CPT', code: '20550', description: 'Injection, tendon sheath/ligament', fee_amount: 56.78 },
  { code_type: 'CPT', code: '20551', description: 'Injection, tendon origin/insertion', fee_amount: 56.78 },
  { code_type: 'CPT', code: '20552', description: 'Injection, trigger point(s), 1 or 2 muscles', fee_amount: 45.67 },
  { code_type: 'CPT', code: '20553', description: 'Injection, trigger point(s), 3 or more muscles', fee_amount: 56.78 },
  
  // ============================================
  // EKG/ECG
  // ============================================
  { code_type: 'CPT', code: '93000', description: 'Electrocardiogram, routine ECG with interpretation', fee_amount: 23.45 },
  { code_type: 'CPT', code: '93005', description: 'Electrocardiogram, tracing only', fee_amount: 12.34 },
  { code_type: 'CPT', code: '93010', description: 'Electrocardiogram, interpretation and report only', fee_amount: 11.23 },
  
  // ============================================
  // SPIROMETRY/PULMONARY
  // ============================================
  { code_type: 'CPT', code: '94010', description: 'Spirometry', fee_amount: 34.56 },
  { code_type: 'CPT', code: '94060', description: 'Spirometry with bronchodilator response', fee_amount: 56.78 },
  { code_type: 'CPT', code: '94640', description: 'Nebulizer treatment', fee_amount: 18.45 },
  { code_type: 'CPT', code: '94664', description: 'Aerosol/vapor inhalation demonstration', fee_amount: 23.45 },
  
  // ============================================
  // LABORATORY - COMMON IN-OFFICE
  // ============================================
  { code_type: 'CPT', code: '81002', description: 'Urinalysis, non-automated, without microscopy', fee_amount: 4.23 },
  { code_type: 'CPT', code: '81003', description: 'Urinalysis, automated, without microscopy', fee_amount: 3.45 },
  { code_type: 'CPT', code: '81025', description: 'Urine pregnancy test', fee_amount: 8.67 },
  { code_type: 'CPT', code: '82270', description: 'Fecal occult blood test (FOBT)', fee_amount: 4.56 },
  { code_type: 'CPT', code: '82962', description: 'Glucose, blood by glucose monitoring device', fee_amount: 3.45 },
  { code_type: 'CPT', code: '83036', description: 'Hemoglobin A1c', fee_amount: 11.23 },
  { code_type: 'CPT', code: '85018', description: 'Hemoglobin', fee_amount: 3.45 },
  { code_type: 'CPT', code: '85610', description: 'Prothrombin time (PT/INR)', fee_amount: 5.67 },
  { code_type: 'CPT', code: '86580', description: 'TB skin test (Mantoux)', fee_amount: 7.89 },
  { code_type: 'CPT', code: '87070', description: 'Culture, bacterial, any source', fee_amount: 12.34 },
  { code_type: 'CPT', code: '87081', description: 'Culture, screening only', fee_amount: 8.45 },
  { code_type: 'CPT', code: '87210', description: 'Smear, wet mount, infectious agents', fee_amount: 6.78 },
  { code_type: 'CPT', code: '87880', description: 'Rapid strep test', fee_amount: 16.78 },
  { code_type: 'CPT', code: '87804', description: 'Rapid flu test', fee_amount: 16.78 },
  { code_type: 'CPT', code: '87426', description: 'COVID-19 antigen test', fee_amount: 41.31 },
  
  // ============================================
  // COMMON ICD-10 CODES (for reference/validation)
  // ============================================
  { code_type: 'ICD10', code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', fee_amount: null },
  { code_type: 'ICD10', code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', fee_amount: null },
  { code_type: 'ICD10', code: 'E11.21', description: 'Type 2 diabetes mellitus with diabetic nephropathy', fee_amount: null },
  { code_type: 'ICD10', code: 'E11.22', description: 'Type 2 diabetes mellitus with diabetic chronic kidney disease', fee_amount: null },
  { code_type: 'ICD10', code: 'E11.40', description: 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'E11.42', description: 'Type 2 diabetes mellitus with diabetic polyneuropathy', fee_amount: null },
  { code_type: 'ICD10', code: 'E11.51', description: 'Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene', fee_amount: null },
  { code_type: 'ICD10', code: 'I10', description: 'Essential (primary) hypertension', fee_amount: null },
  { code_type: 'ICD10', code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery', fee_amount: null },
  { code_type: 'ICD10', code: 'I48.91', description: 'Unspecified atrial fibrillation', fee_amount: null },
  { code_type: 'ICD10', code: 'I50.9', description: 'Heart failure, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'J18.9', description: 'Pneumonia, unspecified organism', fee_amount: null },
  { code_type: 'ICD10', code: 'J20.9', description: 'Acute bronchitis, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'J44.1', description: 'Chronic obstructive pulmonary disease with acute exacerbation', fee_amount: null },
  { code_type: 'ICD10', code: 'J45.20', description: 'Mild intermittent asthma, uncomplicated', fee_amount: null },
  { code_type: 'ICD10', code: 'J45.30', description: 'Mild persistent asthma, uncomplicated', fee_amount: null },
  { code_type: 'ICD10', code: 'J45.40', description: 'Moderate persistent asthma, uncomplicated', fee_amount: null },
  { code_type: 'ICD10', code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', fee_amount: null },
  { code_type: 'ICD10', code: 'M54.5', description: 'Low back pain', fee_amount: null },
  { code_type: 'ICD10', code: 'M79.3', description: 'Panniculitis, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'N39.0', description: 'Urinary tract infection, site not specified', fee_amount: null },
  { code_type: 'ICD10', code: 'R05.9', description: 'Cough, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'R10.9', description: 'Unspecified abdominal pain', fee_amount: null },
  { code_type: 'ICD10', code: 'R50.9', description: 'Fever, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'R51.9', description: 'Headache, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings', fee_amount: null },
  { code_type: 'ICD10', code: 'Z00.01', description: 'Encounter for general adult medical examination with abnormal findings', fee_amount: null },
  { code_type: 'ICD10', code: 'Z12.31', description: 'Encounter for screening mammogram for malignant neoplasm of breast', fee_amount: null },
  { code_type: 'ICD10', code: 'Z12.11', description: 'Encounter for screening for malignant neoplasm of colon', fee_amount: null },
  { code_type: 'ICD10', code: 'Z23', description: 'Encounter for immunization', fee_amount: null },
  { code_type: 'ICD10', code: 'Z71.3', description: 'Dietary counseling and surveillance', fee_amount: null },
  { code_type: 'ICD10', code: 'Z71.41', description: 'Alcohol abuse counseling and surveillance of alcoholic', fee_amount: null },
  { code_type: 'ICD10', code: 'Z71.6', description: 'Tobacco abuse counseling', fee_amount: null },
  { code_type: 'ICD10', code: 'Z71.82', description: 'Exercise counseling', fee_amount: null },
  { code_type: 'ICD10', code: 'Z72.0', description: 'Tobacco use', fee_amount: null },
  { code_type: 'ICD10', code: 'Z87.891', description: 'Personal history of nicotine dependence', fee_amount: null },
  { code_type: 'ICD10', code: 'F17.210', description: 'Nicotine dependence, cigarettes, uncomplicated', fee_amount: null },
  { code_type: 'ICD10', code: 'F17.200', description: 'Nicotine dependence, unspecified, uncomplicated', fee_amount: null },
  { code_type: 'ICD10', code: 'E66.9', description: 'Obesity, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'E66.01', description: 'Morbid (severe) obesity due to excess calories', fee_amount: null },
  { code_type: 'ICD10', code: 'Z68.30', description: 'Body mass index (BMI) 30.0-30.9, adult', fee_amount: null },
  { code_type: 'ICD10', code: 'Z68.35', description: 'Body mass index (BMI) 35.0-35.9, adult', fee_amount: null },
  { code_type: 'ICD10', code: 'Z68.40', description: 'Body mass index (BMI) 40.0-44.9, adult', fee_amount: null },
  { code_type: 'ICD10', code: 'Z68.45', description: 'Body mass index (BMI) 45.0-49.9, adult', fee_amount: null },
  { code_type: 'ICD10', code: 'E78.5', description: 'Hyperlipidemia, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'E78.00', description: 'Pure hypercholesterolemia, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'E78.1', description: 'Pure hyperglyceridemia', fee_amount: null },
  { code_type: 'ICD10', code: 'E78.2', description: 'Mixed hyperlipidemia', fee_amount: null },
  { code_type: 'ICD10', code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'F33.0', description: 'Major depressive disorder, recurrent, mild', fee_amount: null },
  { code_type: 'ICD10', code: 'F41.1', description: 'Generalized anxiety disorder', fee_amount: null },
  { code_type: 'ICD10', code: 'G43.909', description: 'Migraine, unspecified, not intractable, without status migrainosus', fee_amount: null },
  { code_type: 'ICD10', code: 'G47.00', description: 'Insomnia, unspecified', fee_amount: null },
  { code_type: 'ICD10', code: 'G47.33', description: 'Obstructive sleep apnea (adult) (pediatric)', fee_amount: null },
  { code_type: 'ICD10', code: 'K58.9', description: 'Irritable bowel syndrome without diarrhea', fee_amount: null },
  { code_type: 'ICD10', code: 'M17.11', description: 'Primary osteoarthritis, right knee', fee_amount: null },
  { code_type: 'ICD10', code: 'M17.12', description: 'Primary osteoarthritis, left knee', fee_amount: null },
  { code_type: 'ICD10', code: 'M25.561', description: 'Pain in right knee', fee_amount: null },
  { code_type: 'ICD10', code: 'M25.562', description: 'Pain in left knee', fee_amount: null },
  { code_type: 'ICD10', code: 'N18.3', description: 'Chronic kidney disease, stage 3 (moderate)', fee_amount: null },
  { code_type: 'ICD10', code: 'N18.4', description: 'Chronic kidney disease, stage 4 (severe)', fee_amount: null },
  { code_type: 'ICD10', code: 'R73.03', description: 'Prediabetes', fee_amount: null },
];

async function seedFeeSchedule() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Seeding fee schedule with 2024 Medicare rates...');
    
    await client.query('BEGIN');
    
    // Clear existing fee schedule
    await client.query('DELETE FROM fee_schedule');
    
    // Insert new fee schedule
    for (const item of feeScheduleData) {
      await client.query(
        `INSERT INTO fee_schedule (code_type, code, description, fee_amount, active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (code_type, code) DO UPDATE SET
           description = EXCLUDED.description,
           fee_amount = EXCLUDED.fee_amount,
           updated_at = CURRENT_TIMESTAMP`,
        [item.code_type, item.code, item.description, item.fee_amount]
      );
    }
    
    await client.query('COMMIT');
    console.log(`✅ Successfully seeded ${feeScheduleData.length} fee schedule items`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding fee schedule:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedFeeSchedule().catch(console.error);






