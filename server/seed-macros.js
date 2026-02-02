const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://emr_user:emr_password@db:5432/emr_db'
});

const attestations = [
    {
        name: "Standard Addendum",
        category: "Attestation",
        content: "I have reviewed the trainee note and agree with the assessment and plan as documented. I personally examined the patient and was present for the key portions of the service."
    },
    {
        name: "Agree with Modifications",
        category: "Attestation",
        content: "I have reviewed the trainee note. I agree with the general assessment. I have made modifications to the plan as documented above."
    },
    {
        name: "Present for Critical Portion",
        category: "Attestation",
        content: "I was physically present with the trainee during the key portions of this service, including the history, examination, and medical decision-making. I agree with the documented findings."
    },
    {
        name: "Telehealth Attestation",
        category: "Attestation",
        content: "I was present via telehealth for this encounter. I have reviewed and agree with the trainee's documentation with the modifications noted above."
    },
    {
        name: "Procedure Attestation",
        category: "Attestation",
        content: "I was present for the procedure and supervised the trainee throughout. I have reviewed the documentation and agree with the findings."
    },
    {
        name: "Critical Care Time",
        category: "Attestation",
        content: "I personally performed and/or supervised the resident in critical care services. Total critical care time: ___ minutes."
    }
];

async function seed() {
    try {
        console.log('🌱 Seeding attestation macros...');
        for (const att of attestations) {
            // Insert as system macros (user_id IS NULL)
            await pool.query(
                'INSERT INTO macros (name, category, content, user_id) VALUES ($1, $2, $3, NULL) ON CONFLICT DO NOTHING',
                [att.name, att.category, att.content]
            );
        }
        console.log('✅ Seeding complete!');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

seed();
