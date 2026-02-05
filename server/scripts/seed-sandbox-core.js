/**
 * Sandbox Clinical Data Seeder
 * Populates a target schema with 10 "Gold-Standard" patient charts.
 */

async function seedSandbox(client, schemaName, providerId, clinicId) {
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

    let patientIdx = 0;
    for (const p of patients) {
        patientIdx++;
        // Insert patient with clinic_id
        const res = await client.query(`
            INSERT INTO patients (clinic_id, mrn, first_name, last_name, dob, sex, phone, email)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [clinicId, p.mrn, p.firstName, p.lastName, p.dob, p.sex, p.phone, p.email]);

        const patientId = res.rows[0].id;

        // 1. Seed Diagnosis
        const diagnoses = [
            { name: 'Essential Hypertension', icd10: 'I10' },
            { name: 'Type 2 Diabetes Mellitus', icd10: 'E11.9' },
            { name: 'Hyperlipidemia', icd10: 'E78.5' },
            { name: 'Gastroesophageal reflux disease', icd10: 'K21.9' },
            { name: 'Anxiety disorder', icd10: 'F41.9' },
            { name: 'Chronic Obstructive Pulmonary Disease', icd10: 'J44.9' },
            { name: 'Hypothyroidism', icd10: 'E03.9' },
            { name: 'Asthma', icd10: 'J45.909' }
        ];
        // Randomly pick 3-5 for richer charts
        const pDiagnoses = diagnoses.sort(() => 0.5 - Math.random()).slice(0, 3 + Math.floor(Math.random() * 3));

        for (const d of pDiagnoses) {
            await client.query(`
                INSERT INTO problems (patient_id, problem_name, icd10_code, status, onset_date)
                VALUES ($1, $2, $3, 'active', CURRENT_DATE - (floor(random() * 2000) || ' days')::interval)
            `, [patientId, d.name, d.icd10]);
        }

        // 2. Seed Medications
        const medications = [
            { name: 'Lisinopril', dose: '10mg', freq: 'daily' },
            { name: 'Metformin', dose: '500mg', freq: 'twice daily' },
            { name: 'Atorvastatin', dose: '20mg', freq: 'daily' },
            { name: 'Omeprazole', dose: '20mg', freq: 'daily' },
            { name: 'Sertraline', dose: '50mg', freq: 'daily' },
            { name: 'Albuterol HFA', dose: '90mcg', freq: 'as needed' },
            { name: 'Levothyroxine', dose: '75mcg', freq: 'daily' },
            { name: 'Amlodipine', dose: '5mg', freq: 'daily' }
        ];
        const pMeds = medications.sort(() => 0.5 - Math.random()).slice(0, 3 + Math.floor(Math.random() * 3));

        for (const m of pMeds) {
            await client.query(`
                INSERT INTO medications (clinic_id, patient_id, medication_name, dosage, frequency, active, start_date)
                VALUES ($1, $2, $3, $4, $5, true, CURRENT_DATE - (floor(random() * 365) || ' days')::interval)
            `, [clinicId, patientId, m.name, m.dose, m.freq]);
        }

        // 3. Seed Allergies
        const allergies = [
            { allergen: 'Penicillin', reaction: 'Hives', severity: 'high' },
            { allergen: 'Peanuts', reaction: 'Anaphylaxis', severity: 'critical' },
            { allergen: 'Latex', reaction: 'Rash', severity: 'normal' },
            { allergen: 'Sulfa Drugs', reaction: 'Swelling', severity: 'high' }
        ];
        if (Math.random() > 0.4) {
            const pAllergy = allergies[Math.floor(Math.random() * allergies.length)];
            await client.query(`
                INSERT INTO allergies (patient_id, allergen, reaction, severity, active)
                VALUES ($1, $2, $3, $4, true)
             `, [patientId, pAllergy.allergen, pAllergy.reaction, pAllergy.severity]);
        }

        // 4. Seed Historical Signed Visits with Vitals Trends
        const visitCounts = 5 + Math.floor(Math.random() * 5); // 5 to 10 visits for richness
        const baseWeight = 160 + Math.floor(Math.random() * 40);
        const baseSys = 120 + Math.floor(Math.random() * 20);
        const baseDia = 75 + Math.floor(Math.random() * 10);

        for (let i = 0; i < visitCounts; i++) {
            const daysAgo = (visitCounts - i) * 30 + Math.floor(Math.random() * 10);

            // Generate trend: weight slightly decreasing, BP improving over visits
            const weightTrend = baseWeight + (visitCounts - i) * 2 - Math.floor(Math.random() * 3);
            const sysTrend = baseSys + (visitCounts - i) * 2 - Math.floor(Math.random() * 5);
            const diaTrend = baseDia + (visitCounts - i) - Math.floor(Math.random() * 3);

            const vitals = {
                height: "68",
                weight: `${weightTrend}`,
                bmi: (weightTrend * 703 / (68 * 68)).toFixed(1),
                bp: `${sysTrend}/${diaTrend}`,
                temp: "98.6",
                pulse: `${70 + Math.floor(Math.random() * 10)}`,
                rr: "16",
                spo2: "98"
            };

            const noteContent = `SUBJECTIVE: Patient seen for follow-up of chronic conditions. Reports doing well overall. Compliance with medications is good.
OBJECTIVE: Vitals reviewed. Physical exam shows no acute distress. Lungs clear, heart regular rhythm.
ASSESSMENT: 1. Essential Hypertension - Controlled. 2. Type 2 Diabetes - Stable.
PLAN: Continue current medications. Laboratory work ordered for next visit. Follow up in 3-4 months.`;

            await client.query(`
                INSERT INTO visits (
                    clinic_id, patient_id, provider_id, visit_date, encounter_date, 
                    visit_type, note_type, status, vitals, note_draft, 
                    note_signed_at, note_signed_by
                )
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP - ($8 || ' days')::interval, CURRENT_DATE - ($8 || ' days')::interval, $4, $5, 'signed', $6, $7, CURRENT_TIMESTAMP - ($8 || ' days')::interval, $3)
            `, [
                clinicId, patientId, providerId,
                'Office Visit', 'office_visit',
                JSON.stringify(vitals), noteContent, daysAgo
            ]);
        }

        // 5. Seed PENDING NOTE (Draft) - 70% chance
        if (Math.random() > 0.3) {
            const draftVitals = {
                height: "68", weight: `${baseWeight}`, bmi: "24.3",
                bp: `${baseSys}/${baseDia}`, temp: "98.4", pulse: "72", rr: "16", spo2: "99"
            };
            const noteTemplate = `SUBJECTIVE: Patient presents for today's evaluation of acute onset cough and congestion. \nOBJECTIVE: ...`;
            await client.query(`
                INSERT INTO visits (
                    clinic_id, patient_id, provider_id, visit_date, encounter_date, 
                    visit_type, note_type, status, vitals, note_draft
                )
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_DATE, 'Office Visit', 'office_visit', 'draft', $4, $5)
            `, [clinicId, patientId, providerId, JSON.stringify(draftVitals), noteTemplate]);
        }

        // 6. Seed Appointments
        // TODAY
        if (Math.random() > 0.4) {
            const hour = 8 + Math.floor(Math.random() * 9);
            const timeStr = `${hour}:${Math.random() > 0.5 ? '30' : '00'}:00`;

            await client.query(`
                INSERT INTO appointments (
                    clinic_id, patient_id, provider_id, created_by, appointment_date, appointment_time, duration,
                    appointment_type, status, notes
                )
                VALUES ($1, $2, $3, $3, CURRENT_DATE, $4, 30, 'Follow-up', 'checked-in', 'Routine Follow-up')
            `, [clinicId, patientId, providerId, timeStr]);
        }
        // FUTURE
        for (let f = 1; f <= 3; f++) {
            if (Math.random() > 0.5) {
                const futDays = f * 7 + Math.floor(Math.random() * 5);
                const hour = 9 + Math.floor(Math.random() * 6);
                const timeStr = `${hour}:00:00`;
                await client.query(`
                    INSERT INTO appointments (
                        clinic_id, patient_id, provider_id, created_by, appointment_date, appointment_time, duration,
                        appointment_type, status, notes
                    )
                    VALUES ($1, $2, $3, $3, CURRENT_DATE + ($4 || ' days')::interval, $5, 30, 'Routine Check', 'scheduled', 'Recurring follow-up')
                `, [clinicId, patientId, providerId, futDays, timeStr]);
            }
        }

        // 7. Seed IN BASKET Items (Labs) 
        if (Math.random() > 0.5) {
            await client.query(`
                INSERT INTO orders (
                    id, clinic_id, patient_id, ordered_by, 
                    order_type, status, order_payload, result_value, created_at
                )
                VALUES (
                    gen_random_uuid(), $1, $2, $3, 
                    'lab', 'completed', 
                    '{"test_code": "CBC", "test_name": "Complete Blood Count", "priority": "normal"}',
                    '{"WBC": 7.5, "RBC": 4.8, "Plt": 250}',
                    CURRENT_TIMESTAMP - INTERVAL '1 hour'
                )
            `, [clinicId, patientId, providerId]);
        }

        // 8. Seed Patient Flags
        if (Math.random() > 0.7) {
            await client.query(`
                INSERT INTO patient_flags (clinic_id, patient_id, note, status, visibility, custom_label, custom_severity, custom_color)
                VALUES ($1, $2, 'Patient requires sign language interpreter', 'active', 'all', 'Interpreter Needed', 'info', 'blue')
            `, [clinicId, patientId]);
        }

        // 9. Populate "Recently Viewed" (PATIENT_VIEW) - Staggered
        // Putting them in order with decreasing "minutes ago" so they show up correctly
        const minutesAgo = (patients.length - patientIdx) * 5 + Math.floor(Math.random() * 5);
        await client.query(`
            INSERT INTO audit_events (
                tenant_id, action, actor_type, actor_id, entity_type, entity_id, patient_id, 
                actor_user_id, details, occurred_at
            )
            VALUES ($1, 'PATIENT_VIEW', 'user', $3, 'Patient', $2, $2, $3, '{"source":"search"}', CURRENT_TIMESTAMP - ($4 || ' minutes')::interval)
        `, [clinicId, patientId, providerId, minutesAgo]);
    }

    console.log(`[Seed] Successfully seeded 10 patients in ${schemaName}`);
}

module.exports = { seedSandbox };

