const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Cardiology ICD-10 Hierarchical Questions
const hierarchyData = [
  {
    parent_code: 'I50',
    parent_description: 'Heart failure',
    questions: [
      {
        question_text: 'What type of heart failure?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I50.1', label: 'Left ventricular failure', next_question: 2 },
          { value: 'I50.2', label: 'Systolic heart failure', next_question: 2 },
          { value: 'I50.3', label: 'Diastolic heart failure', next_question: 2 },
          { value: 'I50.4', label: 'Combined systolic and diastolic heart failure', next_question: 2 },
          { value: 'I50.9', label: 'Heart failure, unspecified', next_question: null }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'What is the ejection fraction (EF)?',
        question_type: 'select',
        question_order: 2,
        depends_on: { parent_value: ['I50.2', 'I50.4'] },
        options: [
          { value: 'I50.20', label: 'Unspecified systolic heart failure', next_question: 3 },
          { value: 'I50.21', label: 'Acute systolic heart failure', next_question: 3 },
          { value: 'I50.22', label: 'Chronic systolic heart failure', next_question: 3 },
          { value: 'I50.23', label: 'Acute on chronic systolic heart failure', next_question: 3 }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'EF Percentage Range?',
        question_type: 'select',
        question_order: 3,
        depends_on: { parent_value: ['I50.20', 'I50.21', 'I50.22', 'I50.23'] },
        options: [
          { value: 'mildly_reduced', label: 'Mildly Reduced (41-49%)', next_question: 4 },
          { value: 'reduced', label: 'Reduced (<40%)', next_question: 4 },
          { value: 'improved', label: 'Improved EF', next_question: 4 },
          { value: 'unspecified', label: 'Unspecified', next_question: 4 }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'Clinical Status?',
        question_type: 'select',
        question_order: 4,
        options: [
          { value: 'compensated', label: 'Compensated', next_question: null },
          { value: 'decompensated', label: 'Decompensated', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      }
    ]
  },
  {
    parent_code: 'I50.1',
    parent_description: 'Left ventricular failure',
    questions: [
      {
        question_text: 'What type of heart failure?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I50.1', label: 'Left ventricular failure', next_question: 2 },
          { value: 'I50.2', label: 'Systolic heart failure', next_question: 2 },
          { value: 'I50.3', label: 'Diastolic heart failure', next_question: 2 },
          { value: 'I50.4', label: 'Combined systolic and diastolic heart failure', next_question: 2 },
          { value: 'I50.9', label: 'Heart failure, unspecified', next_question: null }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'What is the ejection fraction (EF)?',
        question_type: 'select',
        question_order: 2,
        depends_on: { parent_value: ['I50.2', 'I50.4'] },
        options: [
          { value: 'I50.20', label: 'Unspecified systolic heart failure', next_question: 3 },
          { value: 'I50.21', label: 'Acute systolic heart failure', next_question: 3 },
          { value: 'I50.22', label: 'Chronic systolic heart failure', next_question: 3 },
          { value: 'I50.23', label: 'Acute on chronic systolic heart failure', next_question: 3 }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'EF Percentage Range?',
        question_type: 'select',
        question_order: 3,
        depends_on: { parent_value: ['I50.20', 'I50.21', 'I50.22', 'I50.23'] },
        options: [
          { value: 'mildly_reduced', label: 'Mildly Reduced (41-49%)', next_question: 4 },
          { value: 'reduced', label: 'Reduced (<40%)', next_question: 4 },
          { value: 'improved', label: 'Improved EF', next_question: 4 },
          { value: 'unspecified', label: 'Unspecified', next_question: 4 }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'Clinical Status?',
        question_type: 'select',
        question_order: 4,
        options: [
          { value: 'compensated', label: 'Compensated', next_question: null },
          { value: 'decompensated', label: 'Decompensated', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      }
    ]
  },
  {
    parent_code: 'I10',
    parent_description: 'Essential (primary) hypertension',
    questions: [
      {
        question_text: 'Hypertension Stage?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'stage1', label: 'Stage 1 (130-139/80-89)', next_question: 2 },
          { value: 'stage2', label: 'Stage 2 (≥140/≥90)', next_question: 2 },
          { value: 'crisis', label: 'Hypertensive Crisis', next_question: 3 },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: 'I10'
      },
      {
        question_text: 'Controlled or Uncontrolled?',
        question_type: 'select',
        question_order: 2,
        options: [
          { value: 'controlled', label: 'Controlled', next_question: null },
          { value: 'uncontrolled', label: 'Uncontrolled', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: 'I10'
      },
      {
        question_text: 'Crisis Type?',
        question_type: 'select',
        question_order: 3,
        depends_on: { parent_value: ['crisis'] },
        options: [
          { value: 'I16.0', label: 'Hypertensive urgency', next_question: null },
          { value: 'I16.1', label: 'Hypertensive emergency', next_question: null },
          { value: 'I16.9', label: 'Hypertensive crisis, unspecified', next_question: null }
        ],
        final_code_template: '{selected_value}'
      }
    ]
  },
  {
    parent_code: 'I11.0',
    parent_description: 'Hypertensive heart disease with heart failure',
    questions: [
      {
        question_text: 'With or without heart failure?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I11.0', label: 'With heart failure', next_question: 2 },
          { value: 'I11.9', label: 'Without heart failure', next_question: null }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'Heart Failure Type?',
        question_type: 'select',
        question_order: 2,
        depends_on: { parent_value: ['I11.0'] },
        options: [
          { value: 'systolic', label: 'Systolic heart failure', next_question: 3 },
          { value: 'diastolic', label: 'Diastolic heart failure', next_question: 3 },
          { value: 'combined', label: 'Combined', next_question: 3 },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: 'I11.0'
      },
      {
        question_text: 'EF Percentage?',
        question_type: 'select',
        question_order: 3,
        options: [
          { value: 'mildly_reduced', label: 'Mildly Reduced (41-49%)', next_question: null },
          { value: 'reduced', label: 'Reduced (<40%)', next_question: null },
          { value: 'preserved', label: 'Preserved (≥50%)', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: 'I11.0'
      }
    ]
  },
  {
    parent_code: 'I48.0',
    parent_description: 'Paroxysmal atrial fibrillation',
    questions: [
      {
        question_text: 'Atrial Fibrillation Type?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I48.0', label: 'Paroxysmal atrial fibrillation', next_question: 2 },
          { value: 'I48.1', label: 'Persistent atrial fibrillation', next_question: 2 },
          { value: 'I48.11', label: 'Longstanding persistent atrial fibrillation', next_question: 2 },
          { value: 'I48.19', label: 'Other persistent atrial fibrillation', next_question: 2 },
          { value: 'I48.20', label: 'Chronic atrial fibrillation, unspecified', next_question: 2 },
          { value: 'I48.21', label: 'Permanent atrial fibrillation', next_question: 2 },
          { value: 'I48.91', label: 'Unspecified atrial fibrillation', next_question: null }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'Rate Control Status?',
        question_type: 'select',
        question_order: 2,
        options: [
          { value: 'rate_controlled', label: 'Rate Controlled', next_question: 3 },
          { value: 'rate_uncontrolled', label: 'Rate Uncontrolled', next_question: 3 },
          { value: 'unspecified', label: 'Unspecified', next_question: 3 }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'Anticoagulation?',
        question_type: 'select',
        question_order: 3,
        options: [
          { value: 'anticoagulated', label: 'On Anticoagulation', next_question: null },
          { value: 'not_anticoagulated', label: 'Not Anticoagulated', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      }
    ]
  },
  {
    parent_code: 'I21.01',
    parent_description: 'ST elevation (STEMI) myocardial infarction involving left main coronary artery',
    questions: [
      {
        question_text: 'Infarction Location?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I21.01', label: 'Left main coronary artery', next_question: 2 },
          { value: 'I21.02', label: 'Left anterior descending coronary artery', next_question: 2 },
          { value: 'I21.09', label: 'Other coronary artery of anterior wall', next_question: 2 },
          { value: 'I21.11', label: 'Right coronary artery', next_question: 2 },
          { value: 'I21.19', label: 'Other coronary artery of inferior wall', next_question: 2 },
          { value: 'I21.21', label: 'Left circumflex coronary artery', next_question: 2 },
          { value: 'I21.29', label: 'Other sites', next_question: 2 },
          { value: 'I21.3', label: 'Unspecified site', next_question: 2 }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'Time Since Onset?',
        question_type: 'select',
        question_order: 2,
        options: [
          { value: 'acute', label: 'Acute (<24 hours)', next_question: 3 },
          { value: 'subacute', label: 'Subacute (24 hours - 28 days)', next_question: 3 },
          { value: 'old', label: 'Old (>28 days)', next_question: null }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'Complications?',
        question_type: 'select',
        question_order: 3,
        options: [
          { value: 'none', label: 'No Complications', next_question: null },
          { value: 'I23.0', label: 'Hemopericardium', next_question: null },
          { value: 'I23.1', label: 'Atrial septal defect', next_question: null },
          { value: 'I23.2', label: 'Ventricular septal defect', next_question: null },
          { value: 'I23.3', label: 'Rupture of cardiac wall', next_question: null },
          { value: 'I23.7', label: 'Postinfarction angina', next_question: null }
        ],
        final_code_template: '{selected_value}'
      }
    ]
  },
  {
    parent_code: 'I25.10',
    parent_description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris',
    questions: [
      {
        question_text: 'Disease Type?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I25.10', label: 'Atherosclerotic heart disease without angina', next_question: 2 },
          { value: 'I25.110', label: 'Atherosclerotic heart disease with unstable angina', next_question: 2 },
          { value: 'I25.119', label: 'Atherosclerotic heart disease with unspecified angina', next_question: 2 },
          { value: 'I25.2', label: 'Old myocardial infarction', next_question: null },
          { value: 'I25.5', label: 'Ischemic cardiomyopathy', next_question: 2 },
          { value: 'I25.9', label: 'Chronic ischemic heart disease, unspecified', next_question: null }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'Vessel Involvement?',
        question_type: 'select',
        question_order: 2,
        options: [
          { value: 'single_vessel', label: 'Single Vessel Disease', next_question: 3 },
          { value: 'multi_vessel', label: 'Multi-Vessel Disease', next_question: 3 },
          { value: 'left_main', label: 'Left Main Disease', next_question: 3 },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'Previous Intervention?',
        question_type: 'select',
        question_order: 3,
        options: [
          { value: 'none', label: 'No Previous Intervention', next_question: null },
          { value: 'PCI', label: 'Previous PCI', next_question: null },
          { value: 'CABG', label: 'Previous CABG', next_question: null },
          { value: 'both', label: 'Both PCI and CABG', next_question: null }
        ],
        final_code_template: '{parent_code}'
      }
    ]
  },
  {
    parent_code: 'I34.0',
    parent_description: 'Nonrheumatic mitral (valve) insufficiency',
    questions: [
      {
        question_text: 'Mitral Valve Disorder Type?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I34.0', label: 'Mitral insufficiency', next_question: 2 },
          { value: 'I34.1', label: 'Mitral valve prolapse', next_question: 2 },
          { value: 'I34.2', label: 'Mitral stenosis', next_question: 2 },
          { value: 'I34.8', label: 'Other mitral valve disorders', next_question: 2 },
          { value: 'I34.9', label: 'Mitral valve disorder, unspecified', next_question: null }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'Severity?',
        question_type: 'select',
        question_order: 2,
        options: [
          { value: 'mild', label: 'Mild', next_question: 3 },
          { value: 'moderate', label: 'Moderate', next_question: 3 },
          { value: 'severe', label: 'Severe', next_question: 3 },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'Symptomatic?',
        question_type: 'select',
        question_order: 3,
        options: [
          { value: 'symptomatic', label: 'Symptomatic', next_question: null },
          { value: 'asymptomatic', label: 'Asymptomatic', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      }
    ]
  },
  {
    parent_code: 'I35.0',
    parent_description: 'Nonrheumatic aortic (valve) stenosis',
    questions: [
      {
        question_text: 'Aortic Valve Disorder Type?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I35.0', label: 'Aortic stenosis', next_question: 2 },
          { value: 'I35.1', label: 'Aortic insufficiency', next_question: 2 },
          { value: 'I35.2', label: 'Aortic stenosis with insufficiency', next_question: 2 },
          { value: 'I35.8', label: 'Other aortic valve disorders', next_question: 2 },
          { value: 'I35.9', label: 'Aortic valve disorder, unspecified', next_question: null }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'Severity?',
        question_type: 'select',
        question_order: 2,
        options: [
          { value: 'mild', label: 'Mild', next_question: 3 },
          { value: 'moderate', label: 'Moderate', next_question: 3 },
          { value: 'severe', label: 'Severe', next_question: 3 },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'Mean Gradient (if stenosis)?',
        question_type: 'select',
        question_order: 3,
        depends_on: { parent_value: ['I35.0', 'I35.2'] },
        options: [
          { value: 'low', label: 'Low Gradient (<40 mmHg)', next_question: null },
          { value: 'high', label: 'High Gradient (≥40 mmHg)', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      }
    ]
  },
  {
    parent_code: 'I42.0',
    parent_description: 'Dilated cardiomyopathy',
    questions: [
      {
        question_text: 'Cardiomyopathy Type?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I42.0', label: 'Dilated cardiomyopathy', next_question: 2 },
          { value: 'I42.1', label: 'Obstructive hypertrophic cardiomyopathy', next_question: 2 },
          { value: 'I42.2', label: 'Other hypertrophic cardiomyopathy', next_question: 2 },
          { value: 'I42.5', label: 'Other restrictive cardiomyopathy', next_question: 2 },
          { value: 'I42.6', label: 'Alcoholic cardiomyopathy', next_question: 2 },
          { value: 'I42.7', label: 'Cardiomyopathy due to drug/toxin', next_question: 2 },
          { value: 'I42.8', label: 'Other cardiomyopathies', next_question: 2 },
          { value: 'I42.9', label: 'Cardiomyopathy, unspecified', next_question: null }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'EF Percentage?',
        question_type: 'select',
        question_order: 2,
        options: [
          { value: 'mildly_reduced', label: 'Mildly Reduced (41-49%)', next_question: 3 },
          { value: 'reduced', label: 'Reduced (<40%)', next_question: 3 },
          { value: 'preserved', label: 'Preserved (≥50%)', next_question: 3 },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'NYHA Class?',
        question_type: 'select',
        question_order: 3,
        options: [
          { value: 'I', label: 'Class I (No limitation)', next_question: null },
          { value: 'II', label: 'Class II (Slight limitation)', next_question: null },
          { value: 'III', label: 'Class III (Marked limitation)', next_question: null },
          { value: 'IV', label: 'Class IV (Severe limitation)', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      }
    ]
  },
  {
    parent_code: 'I27.0',
    parent_description: 'Primary pulmonary hypertension',
    questions: [
      {
        question_text: 'Pulmonary Hypertension Type?',
        question_type: 'select',
        question_order: 1,
        options: [
          { value: 'I27.0', label: 'Primary pulmonary hypertension', next_question: 2 },
          { value: 'I27.20', label: 'Pulmonary hypertension, unspecified', next_question: 2 },
          { value: 'I27.21', label: 'Secondary pulmonary arterial hypertension', next_question: 2 },
          { value: 'I27.22', label: 'Due to left heart disease', next_question: 2 },
          { value: 'I27.23', label: 'Due to lung diseases and hypoxia', next_question: 2 },
          { value: 'I27.24', label: 'Chronic thromboembolic pulmonary hypertension', next_question: 2 }
        ],
        final_code_template: '{selected_value}'
      },
      {
        question_text: 'WHO Functional Class?',
        question_type: 'select',
        question_order: 2,
        options: [
          { value: 'I', label: 'Class I (No limitation)', next_question: 3 },
          { value: 'II', label: 'Class II (Mild limitation)', next_question: 3 },
          { value: 'III', label: 'Class III (Marked limitation)', next_question: 3 },
          { value: 'IV', label: 'Class IV (Severe limitation)', next_question: 3 }
        ],
        final_code_template: '{parent_code}'
      },
      {
        question_text: 'Mean PAP (mmHg)?',
        question_type: 'select',
        question_order: 3,
        options: [
          { value: 'mild', label: 'Mild (25-35)', next_question: null },
          { value: 'moderate', label: 'Moderate (36-45)', next_question: null },
          { value: 'severe', label: 'Severe (>45)', next_question: null },
          { value: 'unspecified', label: 'Unspecified', next_question: null }
        ],
        final_code_template: '{parent_code}'
      }
    ]
  }
];

async function seedHierarchy() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`Seeding ICD-10 hierarchy for ${hierarchyData.length} diagnoses...`);
    
    let inserted = 0;
    
    for (const hierarchy of hierarchyData) {
      // Check if parent code exists (exact match or starts with)
      const parentCheck = await client.query(
        'SELECT code, description FROM icd10_codes WHERE code = $1 OR code LIKE $2 ORDER BY code LIMIT 1',
        [hierarchy.parent_code, `${hierarchy.parent_code}%`]
      );
      
      if (parentCheck.rows.length === 0) {
        console.warn(`Parent code ${hierarchy.parent_code} not found, creating hierarchy anyway...`);
        // Continue with provided description
      }
      
      const parentDescription = parentCheck.rows[0]?.description || hierarchy.parent_description;
      const actualParentCode = parentCheck.rows[0]?.code || hierarchy.parent_code;
      
      // Insert questions
      for (const question of hierarchy.questions) {
        try {
          // Check if question already exists
          const existing = await client.query(`
            SELECT id FROM icd10_hierarchy 
            WHERE parent_code = $1 AND question_text = $2 AND question_order = $3
          `, [actualParentCode, question.question_text, question.question_order]);
          
          if (existing.rows.length > 0) {
            // Update existing
            await client.query(`
              UPDATE icd10_hierarchy 
              SET options = $1, depends_on = $2, final_code_template = $3, updated_at = CURRENT_TIMESTAMP
              WHERE id = $4
            `, [
              JSON.stringify(question.options || []),
              JSON.stringify(question.depends_on || {}),
              question.final_code_template || '{selected_value}',
              existing.rows[0].id
            ]);
          } else {
            // Insert new
            await client.query(`
              INSERT INTO icd10_hierarchy (
                parent_code, parent_description, question_text, question_type, 
                question_order, options, depends_on, final_code_template, is_active
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              actualParentCode,
              parentDescription,
              question.question_text,
              question.question_type,
              question.question_order,
              JSON.stringify(question.options || []),
              JSON.stringify(question.depends_on || {}),
              question.final_code_template || '{selected_value}',
              true
            ]);
            inserted++;
          }
        } catch (error) {
          console.error(`Error inserting question for ${hierarchy.parent_code}:`, error.message);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`✅ Successfully seeded ${inserted} hierarchy questions`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding hierarchy:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  seedHierarchy()
    .then(() => {
      console.log('✅ Hierarchy seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Hierarchy seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedHierarchy };

