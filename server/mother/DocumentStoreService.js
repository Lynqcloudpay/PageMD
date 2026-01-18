const pool = require('../db');
const PatientEventStore = require('./PatientEventStore');

/**
 * DocumentStoreService
 * Manages narrative documents and uploaded files.
 */
class DocumentStoreService {
    static async storeDocument(dbClient, docData) {
        const {
            clinicId,
            patientId,
            encounterId,
            docType,
            title,
            storageType = 'disk',
            filePath,
            contentText,
            contentJson,
            status = 'draft',
            authorUserId,
            // Legacy specific fields
            mimeType = 'application/octet-stream',
            fileSize = 0,
            tags = []
        } = docData;

        // Insert Legacy Document (Shadow Write)
        const legacyResult = await dbClient.query(
            `INSERT INTO documents (
                patient_id, visit_id, uploader_id, doc_type, filename, file_path, mime_type, file_size, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [patientId, encounterId, authorUserId, docType, title, filePath, mimeType, fileSize, tags]
        );

        // Insert Mother Document
        const result = await dbClient.query(
            `INSERT INTO patient_document (
                clinic_id, patient_id, encounter_id, doc_type, title, storage_type, 
                file_path, content_text, content_json, status, author_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                clinicId, patientId, encounterId, docType, title, storageType,
                filePath, contentText, contentJson, status, authorUserId
            ]
        );

        const doc = result.rows[0];

        // Store Version 1
        await dbClient.query(
            `INSERT INTO patient_document_version (
                document_id, version, content_text, content_json, file_path, author_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [doc.id, 1, contentText, contentJson, filePath, authorUserId]
        );

        // Record Event
        await PatientEventStore.appendEvent(dbClient, {
            clinicId,
            patientId,
            encounterId,
            eventType: 'DOCUMENT_CREATED',
            payload: { document_id: doc.id, legacy_document_id: legacyResult.rows[0].id, doc_type: docType, title },
            sourceModule: 'DOCUMENTS',
            actorUserId: authorUserId
        });

        return { ...doc, legacyId: legacyResult.rows[0].id };
    }

    static async signDocument(dbClient, docId, authorUserId) {
        const result = await dbClient.query(
            `UPDATE patient_document 
             SET status = 'signed', updated_at = now() 
             WHERE id = $1 RETURNING *`,
            [docId]
        );

        const doc = result.rows[0];

        await PatientEventStore.appendEvent(dbClient, {
            clinicId: doc.clinic_id,
            patientId: doc.patient_id,
            encounterId: doc.encounter_id,
            eventType: 'DOCUMENT_SIGNED',
            payload: { document_id: doc.id, doc_type: doc.doc_type },
            sourceModule: 'DOCUMENTS',
            actorUserId: authorUserId
        });

    }

    static async updateDocument(dbClient, docId, updates, actorUserId) {
        const setClause = [];
        const values = [];
        let i = 1;
        for (const [key, val] of Object.entries(updates)) {
            setClause.push(`${key} = $${i++}`);
            values.push(val);
        }

        if (setClause.length === 0) return null;

        values.push(docId);
        const result = await dbClient.query(
            `UPDATE documents SET ${setClause.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );

        if (result.rows.length > 0) {
            await PatientEventStore.appendEvent(dbClient, {
                clinicId: result.rows[0].clinic_id || null, // Best effort if not passed
                patientId: result.rows[0].patient_id,
                eventType: 'DOCUMENT_UPDATED',
                payload: { document_id: docId, updates },
                sourceModule: 'DOCUMENTS',
                actorUserId
            });
        }

        return result.rows[0];
    }

    static async deleteDocument(dbClient, docId, actorUserId, physicalDelete = false) {
        // Fetch document info first
        const docResult = await dbClient.query('SELECT * FROM documents WHERE id = $1', [docId]);
        if (docResult.rows.length === 0) return null;

        const doc = docResult.rows[0];

        // Physical delete if requested
        if (physicalDelete && doc.file_path) {
            const fs = require('fs');
            const path = require('path');
            const fullPath = path.join(__dirname, '..', '..', doc.file_path);
            if (fs.existsSync(fullPath)) {
                try {
                    fs.unlinkSync(fullPath);
                } catch (err) {
                    console.error('Failed to deleted physical file:', err.message);
                }
            }
        }

        // Delete from legacy
        await dbClient.query('DELETE FROM documents WHERE id = $1', [docId]);

        // Record removal event
        await PatientEventStore.appendEvent(dbClient, {
            clinicId: doc.clinic_id || null,
            patientId: doc.patient_id,
            eventType: 'DOCUMENT_REMOVED',
            payload: { document_id: docId, title: doc.filename },
            sourceModule: 'DOCUMENTS',
            actorUserId
        });

        return doc;
    }
}

module.exports = DocumentStoreService;
