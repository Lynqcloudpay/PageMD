const pool = require('../../db');
const MotherWriteService = require('../../mother/MotherWriteService');
const TenantDb = require('../../mother/TenantDb');
const PatientEventStore = require('../../mother/PatientEventStore');
const ProjectionEngine = require('../../mother/ProjectionEngine');
const DocumentStoreService = require('../../mother/DocumentStoreService');

async function backfill() {
    console.log('🚀 Starting Mother Patient System Backfill...');

    const client = await pool.connect();
    try {
        // Set migration mode to off to enforce nothing initially, then we toggle
        await client.query("SET app.migration_mode = 'on'");

        // 1. Backfill Vitals from Visits table
        console.log('--- Backfilling Vitals from Visits ---');
        const visits = await client.query(`
            SELECT v.id as visit_id, v.patient_id, v.vitals, v.visit_date, v.provider_id, p.clinic_id
            FROM visits v
            JOIN patients p ON v.patient_id = p.id
            WHERE v.vitals IS NOT NULL AND v.vitals != '{}'::jsonb
        `);

        for (const row of visits.rows) {
            if (!row.clinic_id) {
                console.warn(`⚠️ Skipping visit ${row.visit_id}: No clinic_id`);
                continue;
            }
            const vitals = row.vitals;
            const payload = {
                ...vitals,
                recorded_at: row.visit_date
            };

            await MotherWriteService.performWrite(row.clinic_id, {
                patientId: row.patient_id,
                encounterId: row.visit_id,
                eventType: 'VITAL_RECORDED',
                payload,
                sourceModule: 'BACKFILL',
                actorUserId: row.provider_id
            });
        }
        console.log(`✅ Backfilled vitals records.`);

        // 2. Backfill Medications
        console.log('--- Backfilling Medications ---');
        const meds = await client.query(`
            SELECT m.*, p.clinic_id
            FROM medications m
            JOIN patients p ON m.patient_id = p.id
        `);
        for (const m of meds.rows) {
            if (!m.clinic_id) continue;
            await MotherWriteService.performWrite(m.clinic_id, {
                patientId: m.patient_id,
                eventType: 'MED_ADDED',
                payload: {
                    med_id: m.id,
                    medication_name: m.medication_name,
                    dosage: m.dosage,
                    frequency: m.frequency,
                    route: m.route,
                    status: m.active ? 'active' : 'inactive',
                    start_date: m.start_date
                },
                sourceModule: 'BACKFILL',
                actorUserId: m.prescriber_id || '00000000-0000-0000-0000-000000000000'
            });
        }
        console.log(`✅ Backfilled medications.`);

        // 3. Backfill Problems
        console.log('--- Backfilling Problems ---');
        const problems = await client.query(`
            SELECT pr.*, p.clinic_id
            FROM problems pr
            JOIN patients p ON pr.patient_id = p.id
        `);
        for (const pr of problems.rows) {
            if (!pr.clinic_id) continue;
            await MotherWriteService.performWrite(pr.clinic_id, {
                patientId: pr.patient_id,
                eventType: 'DX_ADDED',
                payload: {
                    problem_id: pr.id,
                    problem_name: pr.problem_name,
                    icd10_code: pr.icd10_code,
                    status: pr.status,
                    onset_date: pr.onset_date
                },
                sourceModule: 'BACKFILL',
                actorUserId: '00000000-0000-0000-0000-000000000000'
            });
        }
        console.log(`✅ Backfilled problems.`);

        // 4. Backfill Visit Notes into Documents
        console.log('--- Backfilling Visit Notes ---');
        const notes = await client.query(`
            SELECT v.id as visit_id, v.patient_id, v.note_signed_at, v.note_signed_by, v.note_draft, v.visit_type, v.visit_date, p.clinic_id
            FROM visits v
            JOIN patients p ON v.patient_id = p.id
            WHERE (v.note_signed_at IS NOT NULL OR v.note_draft IS NOT NULL)
        `);
        for (const n of notes.rows) {
            if (!n.clinic_id) continue;
            await TenantDb.withTenantDb(n.clinic_id, async (dbClient) => {
                await DocumentStoreService.storeDocument(dbClient, {
                    clinicId: n.clinic_id,
                    patientId: n.patient_id,
                    encounterId: n.visit_id,
                    docType: 'visit_note',
                    title: `${n.visit_type || 'Visit'} - ${new Date(n.visit_date).toLocaleDateString()}`,
                    storageType: 'content_only',
                    contentText: n.note_draft,
                    status: n.note_signed_at ? 'signed' : 'draft',
                    authorUserId: n.note_signed_by || '00000000-0000-0000-0000-000000000000'
                });
            });
        }
        console.log(`✅ Backfilled visit notes.`);

        // 5. Backfill Legacy Documents
        console.log('--- Backfilling Legacy Documents ---');
        const docs = await client.query(`
            SELECT d.*, p.clinic_id
            FROM documents d
            JOIN patients p ON d.patient_id = p.id
        `);
        for (const d of docs.rows) {
            if (!d.clinic_id) continue;
            await TenantDb.withTenantDb(d.clinic_id, async (dbClient) => {
                await DocumentStoreService.storeDocument(dbClient, {
                    clinicId: d.clinic_id,
                    patientId: d.patient_id,
                    encounterId: d.visit_id,
                    docType: d.doc_type || 'other',
                    title: d.filename,
                    storageType: 'disk',
                    filePath: d.file_path,
                    status: 'signed',
                    authorUserId: d.uploader_id
                });
            });
        }
        console.log(`✅ Backfilled document records.`);

        // 6. Backfill Orders
        console.log('--- Backfilling Orders ---');
        const orders = await client.query(`
            SELECT o.*, p.clinic_id
            FROM orders o
            JOIN patients p ON o.patient_id = p.id
        `);
        for (const o of orders.rows) {
            if (!o.clinic_id) continue;
            await MotherWriteService.performWrite(o.clinic_id, {
                patientId: o.patient_id,
                encounterId: o.visit_id,
                eventType: 'ORDER_PLACED',
                payload: {
                    order_id: o.id,
                    order_type: o.order_type,
                    order_description: o.order_payload?.description || o.order_type,
                    status: o.status,
                    ordered_at: o.created_at
                },
                sourceModule: 'BACKFILL',
                actorUserId: o.ordered_by || '00000000-0000-0000-0000-000000000000'
            });
        }
        console.log(`✅ Backfilled orders.`);

        await client.query("SET app.migration_mode = 'off'");
        console.log('🏁 Backfill Complete!');
    } catch (err) {
        console.error('❌ Backfill Failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

backfill();
