const pool = require('../db');

async function seedPatients() {
  try {
    // Clear all existing patients (CASCADE will delete related records)
    console.log('🗑️  Clearing all existing patients...\n');
    const deleteResult = await pool.query('DELETE FROM patients');
    console.log(`   Deleted ${deleteResult.rowCount} patient(s) and related records\n`);

    // New mock patients
    const patients = [
      {
        mrn: 'MRN-2025-001',
        firstName: 'David',
        lastName: 'Martinez',
        dob: '1987-05-18',
        sex: 'M',
        phone: '555-0201',
        email: 'david.martinez@email.com',
        addressLine1: '2847 Pine Street',
        addressLine2: 'Apt 4B',
        city: 'Portland',
        state: 'OR',
        zip: '97205',
        insuranceProvider: 'BlueCross BlueShield',
        insuranceId: 'BCBS-789456123'
      },
      {
        mrn: 'MRN-2025-002',
        firstName: 'Jennifer',
        lastName: 'Thompson',
        dob: '1993-11-22',
        sex: 'F',
        phone: '555-0202',
        email: 'jennifer.thompson@email.com',
        addressLine1: '1529 Maple Drive',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
        insuranceProvider: 'Aetna',
        insuranceId: 'AET-456789012'
      },
      {
        mrn: 'MRN-2025-003',
        firstName: 'Robert',
        lastName: 'Kim',
        dob: '1979-03-08',
        sex: 'M',
        phone: '555-0203',
        email: 'robert.kim@email.com',
        addressLine1: '8912 Cedar Boulevard',
        addressLine2: 'Suite 200',
        city: 'Denver',
        state: 'CO',
        zip: '80202',
        insuranceProvider: 'UnitedHealthcare',
        insuranceId: 'UHC-321654987'
      },
      {
        mrn: 'MRN-2025-004',
        firstName: 'Lisa',
        lastName: 'Anderson',
        dob: '1996-09-14',
        sex: 'F',
        phone: '555-0204',
        email: 'lisa.anderson@email.com',
        addressLine1: '7234 Birch Lane',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        insuranceProvider: 'Cigna',
        insuranceId: 'CIG-147258369'
      }
    ];

    console.log('🌱 Seeding 4 new patients...\n');

    for (const patient of patients) {
      // Create patient
      const result = await pool.query(
        `INSERT INTO patients (
          mrn, first_name, last_name, dob, sex, phone, email,
          address_line1, address_line2, city, state, zip,
          insurance_provider, insurance_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, mrn, first_name, last_name`,
        [
          patient.mrn,
          patient.firstName,
          patient.lastName,
          patient.dob,
          patient.sex,
          patient.phone,
          patient.email,
          patient.addressLine1,
          patient.addressLine2 || null,
          patient.city,
          patient.state,
          patient.zip,
          patient.insuranceProvider || null,
          patient.insuranceId || null
        ]
      );

      console.log(`✅ Created patient: ${patient.firstName} ${patient.lastName}`);
      console.log(`   MRN: ${patient.mrn}`);
      console.log(`   DOB: ${patient.dob} (Age: ${new Date().getFullYear() - new Date(patient.dob).getFullYear()})`);
      console.log(`   Phone: ${patient.phone}`);
      console.log(`   City: ${patient.city}, ${patient.state}`);
      console.log(`   ID: ${result.rows[0].id}\n`);
    }

    console.log('✅ All patients cleared and reseeded successfully!');
    console.log(`   Total patients: ${patients.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding patients:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

seedPatients();








