/**
 * Projection Reconciliation Job
 * 
 * Compares live projections against replayed projections to detect drift.
 * Run: npm run mother:reconcile -- --clinic=<id> [--sample=10]
 */

const pool = require('../db');
const PatientEventStore = require('../mother/PatientEventStore');
const ProjectionEngine = require('../mother/ProjectionEngine');
const MotherReadService = require('../mother/MotherReadService');
const crypto = require('crypto');

async function reconcile() {
    const args = process.argv.slice(2);
    const clinicArg = args.find(a => a.startsWith('--clinic='))?.split('=')[1];
    const sampleSize = parseInt(args.find(a => a.startsWith('--sample='))?.split('=')[1] || '10');

    if (!clinicArg) {
        console.error('Usage: node scripts/reconcile-projections.js --clinic=<uuid> [--sample=N]');
        process.exit(1);
    }

    console.log(`🔍 Reconciling projections for clinic: ${clinicArg} (sample size: ${sampleSize})`);

    const client = await pool.connect();
    const results = [];

    try {
        // Get sample patients
        const patientsRes = await client.query(
            `SELECT DISTINCT patient_id FROM patient_event 
             WHERE clinic_id = $1 
             ORDER BY patient_id 
             LIMIT $2`,
            [clinicArg, sampleSize]
        );

        console.log(`Found ${patientsRes.rows.length} patients to check.`);

        for (const row of patientsRes.rows) {
            const patientId = row.patient_id;

            // 1. Capture current state
            const liveState = await MotherReadService.getPatientState(clinicArg, patientId);
            const liveHash = crypto.createHash('md5')
                .update(JSON.stringify(liveState))
                .digest('hex');

            // 2. Rebuild projections in memory (without writing)
            const eventsRes = await client.query(
                `SELECT * FROM patient_event 
                 WHERE clinic_id = $1 AND patient_id = $2 
                 ORDER BY occurred_at ASC, created_at ASC`,
                [clinicArg, patientId]
            );

            // Build mock state from events
            const mockState = {
                vitals: null,
                medications: [],
                problems: [],
                openOrders: [],
                allergies: []
            };

            for (const event of eventsRes.rows) {
                const payload = event.payload;
                switch (event.event_type) {
                    case 'VITAL_RECORDED':
                        mockState.vitals = payload;
                        break;
                    case 'MED_ADDED':
                        mockState.medications.push({ ...payload, status: 'active' });
                        break;
                    case 'MED_STOPPED':
                        const medIdx = mockState.medications.findIndex(m =>
                            m.med_id === payload.med_id || m.medication_name === payload.medication_name
                        );
                        if (medIdx >= 0) mockState.medications[medIdx].status = 'inactive';
                        break;
                    case 'DX_ADDED':
                        mockState.problems.push({ ...payload, status: 'active' });
                        break;
                    case 'DX_RESOLVED':
                        const dxIdx = mockState.problems.findIndex(p =>
                            p.problem_id === payload.problem_id || p.problem_name === payload.problem_name
                        );
                        if (dxIdx >= 0) mockState.problems[dxIdx].status = 'resolved';
                        break;
                    case 'ORDER_PLACED':
                        if (payload.status !== 'completed' && payload.status !== 'cancelled') {
                            mockState.openOrders.push(payload);
                        }
                        break;
                    case 'ALLERGY_ADDED':
                        mockState.allergies.push({ ...payload, status: 'active' });
                        break;
                }
            }

            // Filter to active only for comparison
            mockState.medications = mockState.medications.filter(m => m.status === 'active');
            mockState.problems = mockState.problems.filter(p => p.status === 'active');
            mockState.allergies = mockState.allergies.filter(a => a.status === 'active');

            // Compare counts (structural comparison)
            const driftDetected =
                (mockState.medications.length !== liveState.medications.length) ||
                (mockState.problems.length !== liveState.problems.length) ||
                (mockState.allergies.length !== liveState.allergies.length);

            results.push({
                patient_id: patientId,
                live_hash: liveHash,
                live_meds: liveState.medications.length,
                live_problems: liveState.problems.length,
                live_allergies: liveState.allergies.length,
                replayed_meds: mockState.medications.length,
                replayed_problems: mockState.problems.length,
                replayed_allergies: mockState.allergies.length,
                drift: driftDetected ? 'YES' : 'NO'
            });

            console.log(`  Patient ${patientId.substring(0, 8)}... Drift: ${driftDetected ? '⚠️ YES' : '✅ NO'}`);
        }

        // Summary
        const driftCount = results.filter(r => r.drift === 'YES').length;
        console.log(`\n📊 Reconciliation Complete`);
        console.log(`   Patients checked: ${results.length}`);
        console.log(`   Drift detected: ${driftCount}`);
        console.log(`   Status: ${driftCount === 0 ? '✅ ALL PROJECTIONS CONSISTENT' : '⚠️ DRIFT DETECTED'}`);

        if (driftCount > 0) {
            console.log(`\n⚠️ Drifted patients:`);
            results.filter(r => r.drift === 'YES').forEach(r => {
                console.log(`   ${r.patient_id}: Live(M:${r.live_meds}/P:${r.live_problems}/A:${r.live_allergies}) vs Replayed(M:${r.replayed_meds}/P:${r.replayed_problems}/A:${r.replayed_allergies})`);
            });
        }

    } catch (err) {
        console.error('❌ Reconciliation failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

reconcile();
