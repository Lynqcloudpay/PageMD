// Seed mock lab and imaging results for inbox
const { Pool } = require('pg');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const mockLabResults = [
  {
    testName: 'Complete Blood Count (CBC)',
    questCode: '6399',
    labcorpCode: '005009',
    status: 'completed',
    results: {
      wbc: '7.2',
      rbc: '4.5',
      hemoglobin: '14.2',
      hematocrit: '42.1',
      platelets: '250'
    },
    normal: true
  },
  {
    testName: 'Comprehensive Metabolic Panel (CMP)',
    questCode: '10231',
    labcorpCode: '322000',
    status: 'completed',
    results: {
      glucose: '95',
      bun: '18',
      creatinine: '1.0',
      sodium: '140',
      potassium: '4.2',
      alt: '25',
      ast: '22'
    },
    normal: true
  },
  {
    testName: 'Hemoglobin A1c',
    questCode: '496',
    labcorpCode: '001453',
    status: 'completed',
    results: {
      hba1c: '6.8',
      eag: '151'
    },
    normal: false,
    critical: true
  },
  {
    testName: 'Lipid Panel',
    questCode: '37848',
    labcorpCode: '303756',
    status: 'completed',
    results: {
      totalCholesterol: '220',
      hdl: '45',
      ldl: '145',
      triglycerides: '150'
    },
    normal: false
  },
  {
    testName: 'TSH (Thyroid Stimulating Hormone)',
    questCode: '899',
    labcorpCode: '004259',
    status: 'completed',
    results: {
      tsh: '2.5'
    },
    normal: true
  },
  {
    testName: 'Vitamin D, 25-Hydroxy',
    questCode: '17306',
    labcorpCode: '081950',
    status: 'completed',
    results: {
      vitaminD: '28'
    },
    normal: false
  }
];

const mockImagingResults = [
  {
    studyName: 'Chest X-Ray (2 views)',
    cpt: '71020',
    status: 'completed',
    findings: 'Clear lungs, no acute cardiopulmonary process',
    normal: true
  },
  {
    studyName: 'CT Head without Contrast',
    cpt: '70450',
    status: 'completed',
    findings: 'No acute intracranial abnormality. Mild chronic small vessel ischemic changes.',
    normal: false
  },
  {
    studyName: 'Mammography Screening',
    cpt: '77067',
    status: 'completed',
    findings: 'BI-RADS 1: Negative. No evidence of malignancy.',
    normal: true
  },
  {
    studyName: 'Ultrasound Abdomen Complete',
    cpt: '76700',
    status: 'completed',
    findings: 'Liver, gallbladder, pancreas, spleen, and kidneys are normal in size and echotexture.',
    normal: true
  }
];

async function seedInboxMockData() {
  try {
    console.log('🌱 Seeding mock lab and imaging results for inbox...\n');

    // Get all patients
    const patientsResult = await pool.query('SELECT id FROM patients LIMIT 10');
    const patients = patientsResult.rows;

    if (patients.length === 0) {
      console.log('⚠️  No patients found. Please seed patients first.');
      process.exit(1);
    }

    // Get a provider user
    const userResult = await pool.query("SELECT id FROM users WHERE role = 'clinician' LIMIT 1");
    const providerId = userResult.rows[0]?.id;

    if (!providerId) {
      console.log('⚠️  No provider user found. Please seed users first.');
      process.exit(1);
    }

    let labCount = 0;
    let imagingCount = 0;

    // Create mock lab orders/results
    for (const patient of patients) {
      // Create 2-3 lab orders per patient
      const numLabs = Math.floor(Math.random() * 2) + 2;
      const selectedLabs = mockLabResults.sort(() => Math.random() - 0.5).slice(0, numLabs);

      for (const lab of selectedLabs) {
        const orderId = uuidv4();
        const orderPayload = {
          test_name: lab.testName,
          testName: lab.testName,
          questCode: lab.questCode,
          labcorpCode: lab.labcorpCode,
          status: lab.status,
          results: lab.results,
          normal: lab.normal,
          critical: lab.critical || false,
          orderedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          completedDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        // Create order
        await pool.query(
          `INSERT INTO orders (id, patient_id, order_type, status, ordered_by, order_payload, created_at, updated_at)
           VALUES ($1, $2, 'lab', $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            orderId,
            patient.id,
            'completed',
            providerId,
            JSON.stringify(orderPayload),
            new Date(orderPayload.orderedDate),
            new Date(orderPayload.completedDate)
          ]
        );
        labCount++;
      }

      // Create 1-2 imaging orders per patient
      const numImaging = Math.floor(Math.random() * 2) + 1;
      const selectedImaging = mockImagingResults.sort(() => Math.random() - 0.5).slice(0, numImaging);

      for (const imaging of selectedImaging) {
        const orderId = uuidv4();
        const orderPayload = {
          study_name: imaging.studyName,
          studyName: imaging.studyName,
          cpt: imaging.cpt,
          status: imaging.status,
          findings: imaging.findings,
          normal: imaging.normal,
          orderedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          completedDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        await pool.query(
          `INSERT INTO orders (id, patient_id, order_type, status, ordered_by, order_payload, created_at, updated_at)
           VALUES ($1, $2, 'imaging', $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            orderId,
            patient.id,
            'completed',
            providerId,
            JSON.stringify(orderPayload),
            new Date(orderPayload.orderedDate),
            new Date(orderPayload.completedDate)
          ]
        );
        imagingCount++;
      }
    }

    console.log(`✅ Created ${labCount} lab orders`);
    console.log(`✅ Created ${imagingCount} imaging orders`);
    console.log('\n✅ Mock inbox data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding inbox mock data:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedInboxMockData();
































