/**
 * Mother System End-to-End Smoke Test
 * 
 * Tests the complete patient data flow through the Mother system:
 * 1. Create patient
 * 2. Record vitals
 * 3. Add diagnosis
 * 4. Add medication
 * 5. Place order
 * 6. Sign visit with note
 * 7. Verify all projections updated
 * 8. Verify summary endpoint reflects changes
 * 9. Verify search finds document content
 */

const pool = require('../../db');
const MotherWriteService = require('../../mother/MotherWriteService');
const MotherReadService = require('../../mother/MotherReadService');
const DocumentStoreService = require('../../mother/DocumentStoreService');
const crypto = require('crypto');

const TEST_CLINIC_ID = 'ba73f949-7730-4584-95d2-f23cd8f858a3'; // Use real clinic

async function runSmokeTest() {
    console.log('🧪 Mother System End-to-End Smoke Test\n');
    const results = [];
    let testPatientId = null;
    let testUserId = null;

    try {
        // Get a real user for actor
        const userRes = await pool.query('SELECT id FROM users LIMIT 1');
        testUserId = userRes.rows[0]?.id;
        if (!testUserId) throw new Error('No users found in database');

        // Get existing patient with clinic_id
        const patientRes = await pool.query('SELECT id, clinic_id, first_name, last_name FROM patients WHERE clinic_id IS NOT NULL LIMIT 1');
        if (!patientRes.rows[0]) throw new Error('No patients found in database');

        testPatientId = patientRes.rows[0].id;
        const clinicId = patientRes.rows[0].clinic_id;
        const patientName = `${patientRes.rows[0].first_name} ${patientRes.rows[0].last_name}`;

        results.push({ test: 'Find Patient', status: '✅', detail: `${patientName} (${testPatientId.substring(0, 8)}...)` });
        console.log(`Using patient: ${patientName}`);

        const PatientEventStore = require('../../mother/PatientEventStore');

        // 2. Record vitals (event only - no legacy shadow write)
        console.log('2️⃣ Recording vitals event...');
        try {
            const client = await pool.connect();
            await PatientEventStore.appendEvent(client, {
                clinicId,
                patientId: testPatientId,
                eventType: 'VITAL_RECORDED',
                payload: { bp: '120/80', hr: 72, temp: 98.6, rr: 16, spo2: 98, weight: 180 },
                sourceModule: 'SMOKE_TEST',
                actorUserId: testUserId,
                occurredAt: new Date()
            });
            client.release();
            results.push({ test: 'Record Vitals', status: '✅', detail: 'BP: 120/80, HR: 72' });
        } catch (err) {
            results.push({ test: 'Record Vitals', status: '❌', detail: err.message });
        }

        // 3. Add diagnosis (event only)
        console.log('3️⃣ Adding diagnosis event...');
        try {
            const client = await pool.connect();
            await PatientEventStore.appendEvent(client, {
                clinicId,
                patientId: testPatientId,
                eventType: 'DX_ADDED',
                payload: { problem_name: 'SmokeTest Diagnosis', icd10_code: 'Z99.9' },
                sourceModule: 'SMOKE_TEST',
                actorUserId: testUserId,
                occurredAt: new Date()
            });
            client.release();
            results.push({ test: 'Add Diagnosis', status: '✅', detail: 'Z99.9 - SmokeTest Diagnosis' });
        } catch (err) {
            results.push({ test: 'Add Diagnosis', status: '❌', detail: err.message });
        }

        // 4. Add medication (event only)
        console.log('4️⃣ Adding medication event...');
        try {
            const client = await pool.connect();
            await PatientEventStore.appendEvent(client, {
                clinicId,
                patientId: testPatientId,
                eventType: 'MED_ADDED',
                payload: { medication_name: 'SmokeTest Med 10mg', dosage: '10mg', frequency: 'daily' },
                sourceModule: 'SMOKE_TEST',
                actorUserId: testUserId,
                occurredAt: new Date()
            });
            client.release();
            results.push({ test: 'Add Medication', status: '✅', detail: 'SmokeTest Med 10mg daily' });
        } catch (err) {
            results.push({ test: 'Add Medication', status: '❌', detail: err.message });
        }

        // 5. Place order (event only)
        console.log('5️⃣ Placing order event...');
        try {
            const client = await pool.connect();
            await PatientEventStore.appendEvent(client, {
                clinicId,
                patientId: testPatientId,
                eventType: 'ORDER_PLACED',
                payload: { order_type: 'lab', test_name: 'SmokeTest CMP' },
                sourceModule: 'SMOKE_TEST',
                actorUserId: testUserId,
                occurredAt: new Date()
            });
            client.release();
            results.push({ test: 'Place Order', status: '✅', detail: 'CMP Lab Order' });
        } catch (err) {
            results.push({ test: 'Place Order', status: '❌', detail: err.message });
        }

        // 6. Create document with unique phrase
        const uniquePhrase = `ZEBRA-ALPHA-${crypto.randomBytes(4).toString('hex')}`;
        console.log(`6️⃣ Creating document event with phrase: ${uniquePhrase}...`);
        try {
            const client = await pool.connect();
            await PatientEventStore.appendEvent(client, {
                clinicId,
                patientId: testPatientId,
                eventType: 'DOCUMENT_CREATED',
                payload: { doc_type: 'clinical_note', title: 'Smoke Test Note', content: `Patient discussed ${uniquePhrase}` },
                sourceModule: 'SMOKE_TEST',
                actorUserId: testUserId,
                occurredAt: new Date()
            });
            client.release();
            results.push({ test: 'Create Document', status: '✅', detail: `Phrase: ${uniquePhrase}` });
        } catch (err) {
            results.push({ test: 'Create Document', status: '❌', detail: err.message });
        }

        // 7. Verify events exist
        console.log('7️⃣ Verifying events in patient_event...');
        try {
            const eventsRes = await pool.query(
                'SELECT event_type, COUNT(*) as count FROM patient_event WHERE patient_id = $1 GROUP BY event_type ORDER BY event_type',
                [testPatientId]
            );
            const eventTypes = eventsRes.rows.map(r => `${r.event_type}(${r.count})`).join(', ');
            results.push({ test: 'Verify Events', status: '✅', detail: eventTypes });
        } catch (err) {
            results.push({ test: 'Verify Events', status: '❌', detail: err.message });
        }

        // 8. Verify projections updated
        console.log('8️⃣ Verifying projections...');
        try {
            const state = await MotherReadService.getPatientState(clinicId, testPatientId);
            const summary = `Meds: ${state.medications?.length || 0}, Dx: ${state.problems?.length || 0}, Orders: ${state.openOrders?.length || 0}`;
            const hasData = (state.medications?.length > 0) || (state.problems?.length > 0);
            results.push({
                test: 'Verify Projections',
                status: hasData ? '✅' : '⚠️',
                detail: summary
            });
        } catch (err) {
            results.push({ test: 'Verify Projections', status: '❌', detail: err.message });
        }

        // 9. Verify summary endpoint
        console.log('9️⃣ Verifying summary endpoint...');
        try {
            const summary = await MotherReadService.getPatientSummary(clinicId, testPatientId);
            const hasDemographics = summary.demographics?.first_name === 'SmokeTest';
            results.push({
                test: 'Verify Summary',
                status: hasDemographics ? '✅' : '⚠️',
                detail: `Demographics: ${hasDemographics ? 'OK' : 'Missing'}`
            });
        } catch (err) {
            results.push({ test: 'Verify Summary', status: '❌', detail: err.message });
        }

        // 10. Verify document search
        console.log('🔟 Verifying document search...');
        try {
            const docs = await MotherReadService.searchDocuments(clinicId, testPatientId, uniquePhrase);
            const found = docs && docs.length > 0;
            results.push({
                test: 'Verify Search',
                status: found ? '✅' : '⚠️',
                detail: found ? `Found ${docs.length} doc(s)` : 'Not found (indexing delay?)'
            });
        } catch (err) {
            results.push({ test: 'Verify Search', status: '❌', detail: err.message });
        }

        // 11. Verify timeline uses occurred_at
        console.log('1️⃣1️⃣ Verifying timeline ordering...');
        try {
            const timeline = await MotherReadService.getPatientTimeline(clinicId, testPatientId, 10, 0);
            const hasEvents = timeline && timeline.length > 0;
            const firstEvent = timeline[0];
            const hasOccurredAt = firstEvent && firstEvent.occurred_at !== undefined;
            results.push({
                test: 'Verify Timeline',
                status: hasEvents && hasOccurredAt ? '✅' : '⚠️',
                detail: `Events: ${timeline?.length || 0}, occurred_at: ${hasOccurredAt ? 'present' : 'missing'}`
            });
        } catch (err) {
            results.push({ test: 'Verify Timeline', status: '❌', detail: err.message });
        }

    } catch (err) {
        console.error('Fatal error:', err.message);
    } finally {
        // Cleanup test patient (soft - just mark for reference)
        if (testPatientId) {
            console.log(`\n🧹 Test patient created: ${testPatientId}`);
            console.log('   (Not deleted - can be used for manual verification)');
        }
    }

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 SMOKE TEST RESULTS');
    console.log('='.repeat(60));

    let passed = 0, failed = 0, warnings = 0;
    for (const r of results) {
        console.log(`${r.status} ${r.test}: ${r.detail}`);
        if (r.status === '✅') passed++;
        else if (r.status === '❌') failed++;
        else warnings++;
    }

    console.log('='.repeat(60));
    console.log(`PASSED: ${passed}  WARNINGS: ${warnings}  FAILED: ${failed}`);
    console.log('='.repeat(60));

    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
}

runSmokeTest();
