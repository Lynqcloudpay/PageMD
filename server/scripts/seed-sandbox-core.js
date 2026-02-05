/**
 * Sandbox Clinical Data Seeder
 * Populates a target schema with 10 "Gold-Standard" patient charts.
 */

async function seedSandbox(client, schemaName) {
    console.log(`[Seed] Seeding clinical data for ${schemaName}...`);

    // Set search_path specifically for this seeding run
    await client.query(`SET search_path TO ${schemaName}, public`);

    const patients = [
        { mrn: 'DEMO-001', firstName: 'John', lastName: 'Doe', dob: '1975-06-12', sex: 'M', phone: '555-0101', email: 'john.doe@demo.com' },
        { mrn: 'DEMO-002', firstName: 'Jane', lastName: 'Smith', dob: '1982-03-24', sex: 'F', phone: '555-0102', email: 'jane.smith@demo.com' },
        { mrn: 'DEMO-003', firstName: 'Alice', lastName: 'Johnson', dob: '1990-11-05', sex: 'F', phone: '555-0103', email: 'alice.j@demo.com' },
        { mrn: 'DEMO-004', firstName: 'Bob', lastName: 'Brown', dob: '1968-09-18', sex: 'M', phone: '555-0104', email: 'bob.b@demo.com' },
        { mrn: 'DEMO-005', firstName: 'Charlie', lastName: 'Davis', dob: '1955-12-30', sex: 'M', phone: '555-0105', email: 'charlie.d@demo.com' },
        { mrn: 'DEMO-006', firstName: 'Diana', lastName: 'Evans', dob: '1988-07-21', sex: 'F', phone: '555-0106', email: 'diana.e@demo.com' },
        { mrn: 'DEMO-007', firstName: 'Edward', lastName: 'Frank', dob: '1972-04-15', sex: 'M', phone: '555-0107', email: 'ed.f@demo.com' },
        { mrn: 'DEMO-008', firstName: 'Fiona', lastName: 'Garcia', dob: '1995-01-10', sex: 'F', phone: '555-0108', email: 'fiona.g@demo.com' },
        { mrn: 'DEMO-009', firstName: 'George', lastName: 'Harris', dob: '1963-08-02', sex: 'M', phone: '555-0109', email: 'george.h@demo.com' },
        { mrn: 'DEMO-010', firstName: 'Hannah', lastName: 'Ives', dob: '1980-05-25', sex: 'F', phone: '555-0110', email: 'hannah.i@demo.com' }
    ];

    for (const p of patients) {
        const res = await client.query(`
            INSERT INTO patients (mrn, first_name, last_name, dob, sex, phone, email)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [p.mrn, p.firstName, p.lastName, p.dob, p.sex, p.phone, p.email]);

        const patientId = res.rows[0].id;

        // Seed some vitals
        await client.query(`
            INSERT INTO vitals (patient_id, height_in, weight_lbs, bmi, blood_pressure_systolic, blood_pressure_diastolic, temperature_f, pulse, respiratory_rate, oxygen_saturation)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [patientId, 70, 180, 25.8, 120, 80, 98.6, 72, 16, 98]);

        // Seed a SOAP note
        await client.query(`
            INSERT INTO visits (patient_id, visit_date, reason_for_visit, status, soap_subjective, soap_objective, soap_assessment, soap_plan)
            VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7)
        `, [patientId, 'Annual Physical', 'completed', 'Patient feels well.', 'Physical exam normal.', 'Healthy adult.', 'Continue healthy diet and exercise.']);
    }

    console.log(`[Seed] Successfully seeded 10 patients in ${schemaName}`);
}

module.exports = { seedSandbox };
