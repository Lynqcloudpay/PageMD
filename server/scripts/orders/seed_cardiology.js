const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const orders = [
    // LABS
    { type: 'LAB', name: 'Lipid Panel', category: 'Cardiology', synonyms: ['Cholesterol', 'HDL/LDL', 'Lipids'], loinc_code: '2093-3', specimen: 'Blood', instructions: 'Fasting 12 hours required' },
    { type: 'LAB', name: 'Comprehensive Metabolic Panel (CMP)', category: 'General', synonyms: ['CMP', 'Metabolic Panel'], loinc_code: '20570-8', specimen: 'Blood', instructions: 'Fasting preferred' },
    { type: 'LAB', name: 'Basic Metabolic Panel (BMP)', category: 'General', synonyms: ['BMP'], loinc_code: '24321-2', specimen: 'Blood' },
    { type: 'LAB', name: 'CBC with Differential', category: 'General', synonyms: ['CBC', 'Hemogram'], loinc_code: '58410-2', specimen: 'Blood' },
    { type: 'LAB', name: 'Hemoglobin A1c', category: 'General', synonyms: ['HbA1c', 'A1c'], loinc_code: '4548-4', specimen: 'Blood' },
    { type: 'LAB', name: 'Troponin I, High Sensitivity', category: 'Cardiology', synonyms: ['Trop I', 'Troponin', 'hsTnI'], loinc_code: '49563-0', specimen: 'Blood', default_priority: 'STAT' },
    { type: 'LAB', name: 'B-Type Natriuretic Peptide (BNP)', category: 'Cardiology', synonyms: ['BNP', 'Brain Natriuretic Peptide'], loinc_code: '30934-4', specimen: 'Blood' },
    { type: 'LAB', name: 'NT-proBNP', category: 'Cardiology', synonyms: ['pro-BNP'], loinc_code: '33762-6', specimen: 'Blood' },
    { type: 'LAB', name: 'Potassium Level', category: 'General', synonyms: ['K+'], loinc_code: '2823-3', specimen: 'Blood' },
    { type: 'LAB', name: 'Magnesium Level', category: 'General', synonyms: ['Mg+'], loinc_code: '2601-3', specimen: 'Blood' },
    { type: 'LAB', name: 'hs-CRP (C-Reactive Protein)', category: 'Cardiology', synonyms: ['CRP', 'Inflammation'], loinc_code: '30522-7', specimen: 'Blood' },
    { type: 'LAB', name: 'Prothrombin Time / INR', category: 'Cardiology', synonyms: ['PT/INR', 'Coumadin check'], loinc_code: '34714-6', specimen: 'Blood' },
    { type: 'LAB', name: 'TSH (Thyroid Stimulating Hormone)', category: 'General', synonyms: ['Thyroid'], loinc_code: '11580-8', specimen: 'Blood' },
    { type: 'LAB', name: 'Liver Function Tests (LFT)', category: 'General', synonyms: ['LFT', 'Hepatic Panel'], loinc_code: '24325-3', specimen: 'Blood' },

    // IMAGING
    { type: 'IMAGING', name: 'Echocardiogram (TTE)', category: 'Cardiology', synonyms: ['TTE', 'Echo', 'Cardiac Ultrasound'], specialty_tags: ['cardiology'] },
    { type: 'IMAGING', name: 'Transesophageal Echocardiogram (TEE)', category: 'Cardiology', synonyms: ['TEE'], specialty_tags: ['cardiology'] },
    { type: 'IMAGING', name: 'Stress Echocardiogram', category: 'Cardiology', synonyms: ['Stress Echo'], specialty_tags: ['cardiology'] },
    { type: 'IMAGING', name: 'Myocardial Perfusion Image (Nuclear Stress)', category: 'Cardiology', synonyms: ['MPI', 'Lexiscan', 'Nuclear Stress'], specialty_tags: ['cardiology'] },
    { type: 'IMAGING', name: 'Coronary CT Angiography (CCTA)', category: 'Cardiology', synonyms: ['CTA coronary', 'Cardiac CT'], specialty_tags: ['cardiology'] },
    { type: 'IMAGING', name: 'Cardiac MRI', category: 'Cardiology', synonyms: ['CMR'], specialty_tags: ['cardiology'] },
    { type: 'IMAGING', name: 'Carotid Duplex Ultrasound', category: 'Vascular', synonyms: ['Carotid Echo', 'Carotid US'], specialty_tags: ['cardiology'] },
    { type: 'IMAGING', name: 'Ankle-Brachial Index (ABI)', category: 'Vascular', synonyms: ['ABI'], specialty_tags: ['cardiology'] },
    { type: 'IMAGING', name: 'Chest X-Ray, 2 Views', category: 'General', synonyms: ['CXR'], specialty_tags: ['cardiology'] },

    // PROCEDURES / TESTS
    { type: 'PROCEDURE', name: 'Electrocardiogram (ECG/EKG)', category: 'Cardiology', synonyms: ['EKG', 'ECG', '12-lead'], specialty_tags: ['cardiology'] },
    { type: 'PROCEDURE', name: 'Holter Monitor (24h-48h)', category: 'Cardiology', synonyms: ['Holter'], specialty_tags: ['cardiology'] },
    { type: 'PROCEDURE', name: 'Cardiac Event Recorder (Patch)', category: 'Cardiology', synonyms: ['Event monitor', 'Zio', 'Patch'], specialty_tags: ['cardiology'] },
    { type: 'PROCEDURE', name: 'Pacemaker Interrogation', category: 'Electrophysiology', synonyms: ['PM Check'], specialty_tags: ['cardiology'] },
    { type: 'PROCEDURE', name: 'ICD Interrogation', category: 'Electrophysiology', synonyms: ['Defib check'], specialty_tags: ['cardiology'] },
    { type: 'PROCEDURE', name: 'Direct Current Cardioversion (DCCV)', category: 'Cardiology', synonyms: ['Cardioversion', 'A-fib shock'], specialty_tags: ['cardiology'] },
    { type: 'PROCEDURE', name: 'Tilt Table Test', category: 'Electrophysiology', synonyms: ['Tilt'], specialty_tags: ['cardiology'] },
    { type: 'PROCEDURE', name: 'Cardiopulmonary Exercise Test (CPET)', category: 'Cardiology', synonyms: ['CPET', 'VO2 Max'], specialty_tags: ['cardiology'] }
];

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🌱 Seeding Cardiology Orders Catalog...');
        await client.query('BEGIN');

        for (const order of orders) {
            await client.query(`
                INSERT INTO orders_catalog (
                    type, name, category, synonyms, loinc_code, specimen, instructions, specialty_tags, default_priority
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
            `, [
                order.type,
                order.name,
                order.category,
                order.synonyms || [],
                order.loinc_code || null,
                order.specimen || null,
                order.instructions || null,
                order.specialty_tags || ['cardiology'],
                order.default_priority || 'ROUTINE'
            ]);
        }

        await client.query('COMMIT');
        console.log(`✅ Seeded ${orders.length} cardiology orders.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
