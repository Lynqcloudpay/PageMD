const pool = require('../../db');
const MotherWriteService = require('../../mother/MotherWriteService');
const MotherReadService = require('../../mother/MotherReadService');
const PatientEventStore = require('../../mother/PatientEventStore');
const DocumentStoreService = require('../../mother/DocumentStoreService');
const TenantDb = require('../../mother/TenantDb');
const fs = require('fs');
const path = require('path');

async function runAudit() {
    console.log('🧐 Starting Mother Patient System Audit...');
    const reportPath = path.join(__dirname, '../../../docs/mother/audit_report.md');
    let reportContent = `# Mother Patient System Verification Audit Report\nGenerated: ${new Date().toISOString()}\n\n`;

    const client = await pool.connect();

    try {
        // A. Schema Verification
        console.log('A. Verifying Schema...');
        reportContent += `## 1. Schema Verification\n\n`;

        const tablesToVerify = [
            'patient_event',
            'patient_document',
            'patient_document_version',
            'patient_state_vitals_latest',
            'patient_state_medications',
            'patient_state_problems',
            'patient_state_orders_open',
            'patient_state_allergies',
            'patient_state_last_visit',
            'mother_audit_log'
        ];

        for (const table of tablesToVerify) {
            const res = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)", [table]);
            const exists = res.rows[0].exists;
            reportContent += `- [${exists ? 'X' : ' '}] Table \`${table}\` exists: ${exists ? '✅' : '❌'}\n`;
        }

        // Verify Columns in patient_event
        const requiredColumns = ['clinic_id', 'patient_id', 'payload', 'refs', 'source_module', 'actor_user_id', 'created_at', 'occurred_at'];
        const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'patient_event'");
        const existingColumns = colRes.rows.map(r => r.column_name);
        reportContent += `\n### \`patient_event\` Columns\n`;
        for (const col of requiredColumns) {
            const exists = existingColumns.includes(col);
            reportContent += `- [${exists ? 'X' : ' '}] Column \`${col}\`: ${exists ? '✅' : '❌'}\n`;
        }

        // Verify Trigger
        const triggerRes = await client.query("SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'patient_event'");
        const triggerExists = triggerRes.rows.some(r => r.trigger_name === 'trg_prevent_event_mutation');
        reportContent += `\n- [${triggerExists ? 'X' : ' '}] Trigger \`trg_prevent_event_mutation\` exists: ${triggerExists ? '✅' : '❌'}\n`;

        // B. Append-only Test
        console.log('B. Testing Append-only properties...');
        reportContent += `\n## 2. Append-only Test\n\n`;
        const testPatientId = '00000000-0000-0000-0000-000000000001';
        const testClinicId = '00000000-0000-0000-0000-000000000001';

        // Fetch a real user
        const userRes = await client.query("SELECT id FROM users LIMIT 1");
        const realUserId = userRes.rows[0]?.id || testPatientId;

        try {
            const event = await PatientEventStore.appendEvent(client, {
                clinicId: testClinicId,
                patientId: testPatientId,
                eventType: 'AUDIT_TEST_EVENT',
                payload: { test: 'data' },
                sourceModule: 'AUDIT',
                actorUserId: realUserId
            });
            reportContent += `- [X] Insert test event: ✅ (Event ID: ${event.id})\n`;

            try {
                await client.query("UPDATE patient_event SET event_type = 'MUTATED' WHERE id = $1", [event.id]);
                reportContent += `- [ ] Prevent UPDATE: ❌ (Update should have failed)\n`;
            } catch (err) {
                reportContent += `- [X] Prevent UPDATE: ✅ (Caught: ${err.message})\n`;
            }

            try {
                await client.query("DELETE FROM patient_event WHERE id = $1", [event.id]);
                reportContent += `- [ ] Prevent DELETE: ❌ (Delete should have failed)\n`;
            } catch (err) {
                reportContent += `- [X] Prevent DELETE: ✅ (Caught: ${err.message})\n`;
            }
        } catch (err) {
            reportContent += `- [ ] Append-only test failed to initialize: ❌ (${err.message})\n`;
        }

        // B2. Payload Validation Test
        console.log('B2. Testing Payload Validation...');
        reportContent += `\n## 2b. Payload Validation Test\n\n`;

        // Test valid payload
        try {
            const validEvent = await PatientEventStore.appendEvent(client, {
                clinicId: testClinicId,
                patientId: testPatientId,
                eventType: 'VITAL_RECORDED',
                payload: { bp: '120/80', hr: 72 },
                sourceModule: 'AUDIT',
                actorUserId: realUserId
            });
            reportContent += `- [X] Valid VITAL_RECORDED accepted: ✅ (ID: ${validEvent.id})\n`;
        } catch (err) {
            reportContent += `- [ ] Valid VITAL_RECORDED rejected: ❌ (${err.message})\n`;
        }

        // Test invalid payload (should be rejected)
        try {
            await PatientEventStore.appendEvent(client, {
                clinicId: testClinicId,
                patientId: testPatientId,
                eventType: 'VITAL_RECORDED',
                payload: {}, // Empty - should fail validation
                sourceModule: 'AUDIT',
                actorUserId: realUserId
            });
            reportContent += `- [ ] Invalid VITAL_RECORDED accepted: ❌ (Should have been rejected)\n`;
        } catch (err) {
            reportContent += `- [X] Invalid VITAL_RECORDED rejected: ✅ (${err.message})\n`;
        }

        // C. Projection Parity Test
        console.log('C. Testing Projection Parity...');
        reportContent += `\n## 3. Projection Parity Test\n\n`;
        // Pick a patient that has some data and a clinic_id
        const samplePatientRes = await client.query("SELECT id, clinic_id FROM patients WHERE clinic_id IS NOT NULL LIMIT 1");
        if (samplePatientRes.rows.length > 0) {
            const p = samplePatientRes.rows[0];
            const before = await MotherReadService.getPatientState(p.clinic_id, p.id);

            // Run replayer
            const eventsRes = await client.query("SELECT * FROM patient_event WHERE clinic_id = $1 AND patient_id = $2 ORDER BY created_at ASC", [p.clinic_id, p.id]);
            for (const ev of eventsRes.rows) {
                const ProjectionEngine = require('../../mother/ProjectionEngine');
                await ProjectionEngine.apply(client, ev);
            }

            const after = await MotherReadService.getPatientState(p.clinic_id, p.id);

            const match = JSON.stringify(before) === JSON.stringify(after);
            reportContent += `- [${match ? 'X' : ' '}] Projection parity for patient \`${p.id}\`: ${match ? '✅' : '❌'}\n`;
            if (!match) {
                reportContent += `  - Debug: Before: ${JSON.stringify(before).substring(0, 100)}... After: ${JSON.stringify(after).substring(0, 100)}...\n`;
            }
        } else {
            reportContent += `- [ ] Projection parity: ⚠️ No patients found to test.\n`;
        }

        // D. Every Word Retrievable test
        console.log('D. Testing Search retrievability...');
        reportContent += `\n## 4. Search Continuity Test\n\n`;
        const zebraId = '0b555555-5555-5555-5555-555555555555'; // Constant for test
        const zebraPhrase = `ZEBRA-ALPHA-${Math.floor(Math.random() * 1000000)}`;

        if (samplePatientRes.rows.length > 0) {
            const p = samplePatientRes.rows[0];
            await DocumentStoreService.storeDocument(client, {
                clinicId: p.clinic_id,
                patientId: p.id,
                docType: 'visit_note',
                title: 'Audit Search Test',
                storageType: 'content_only',
                contentText: `This note contains a unique phrase: ${zebraPhrase}`,
                status: 'signed',
                authorUserId: realUserId
            });

            // Search
            const searchResults = await MotherReadService.searchDocuments(p.clinic_id, p.id, zebraPhrase);
            const found = searchResults.some(r => r.title === 'Audit Search Test');
            reportContent += `- [${found ? 'X' : ' '}] Full-text search retrieval: ${found ? '✅' : '❌'}\n`;
        }

        // E. Tenant Safety Test
        console.log('E. Testing Tenant Isolation...');
        reportContent += `\n## 5. Tenant Safety Test\n\n`;
        const clinicA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const clinicB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        const patientA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

        // Attempt access patient A via clinic B
        const stateB = await MotherReadService.getPatientState(clinicB, patientA);
        const hasData = stateB.vitals || stateB.medications.length > 0;
        reportContent += `- [${!hasData ? 'X' : ' '}] Cross-clinic isolation: ${!hasData ? '✅' : '❌'}\n`;

        fs.writeFileSync(reportPath, reportContent);
        console.log('✅ Audit Complete. Report saved to docs/mother/audit_report.md');

    } catch (err) {
        console.error('❌ Audit Runner Failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runAudit();
