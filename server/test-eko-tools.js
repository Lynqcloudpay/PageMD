
const { Pool } = require('pg');
// Use the local DB connection that worked in the node -e test
const pool = new Pool({ connectionString: 'postgresql://mjrodriguez@localhost:5432/paper_emr' });

const echoService = require('./services/echoService');
const echoContextEngine = require('./services/echoContextEngine');

async function testAllTools() {
    console.log('🚀 Starting local Eko Tool Suite Validation...');

    // 1. Get a test patient
    const patientRes = await pool.query('SELECT id FROM patients LIMIT 1');
    if (patientRes.rows.length === 0) {
        console.error('❌ No patients found in DB to test with.');
        return;
    }
    const patientId = patientRes.rows[0].id;

    // Get clinic and user
    const clinicRes = await pool.query('SELECT id FROM clinics LIMIT 1');
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');

    const tenantId = clinicRes.rows[0]?.id;
    const userId = userRes.rows[0]?.id;

    console.log(`📝 Testing with:
    Patient: ${patientId}
    Clinic:  ${tenantId}
    User:    ${userId}`);

    const toolsToTest = [
        { name: 'get_risk_scores', args: { score_type: 'all' } },
        { name: 'generate_referral_letter', args: { specialty: 'Cardiology', reason: 'Syncope' } },
        { name: 'suggest_billing_codes', args: { visit_type: 'established', time_spent: 45 } },
        { name: 'generate_clinical_letter', args: { letter_type: 'work_excuse', details: 'excuse for 3 days' } },
        { name: 'prep_visit', args: { focus: 'comprehensive' } },
        { name: 'suggest_followup_plan', args: {} },
        { name: 'generate_avs', args: { chief_complaint: 'Follow up hypertension' } },
        { name: 'handoff_summary', args: {} },
        { name: 'reconcile_medications', args: {} },
        { name: 'get_schedule_summary', args: {} },
        { name: 'get_inbox_summary', args: {} }
    ];

    const context = await echoContextEngine.assemblePatientContext(patientId, tenantId);

    for (const tool of toolsToTest) {
        process.stdout.write(`Testing [${tool.name}]... `);
        try {
            // We need to bypass the pool inside echoService or make it use our pool.
            // Since echoService requires './db', let's mock the db module if possible, 
            // or just rely on the fact that if we set DATABASE_URL correctly it might work.

            const result = await echoService.executeTool(
                tool.name,
                tool.args,
                context,
                patientId,
                tenantId,
                userId
            );

            if (result.error) {
                console.log('❌ FAILED: ' + result.result);
            } else {
                console.log('✅ PASSED');
                // Optional: print a snippet of the result
                // console.log(JSON.stringify(result.result).substring(0, 100) + '...');
            }
        } catch (err) {
            console.log('💥 EXCEPTION: ' + err.message);
        }
    }

    console.log('\n🏁 Validation Complete.');
    process.exit(0);
}

testAllTools().catch(err => {
    console.error(err);
    process.exit(1);
});
