const pool = require('../db');
const x12Generator = require('./x12Generator');
const clearinghouse = require('./clearinghouse');

/**
 * Claim Submission Service
 * Handles batch claim submission, acknowledgement processing, and status tracking
 */
class ClaimSubmissionService {

    /**
     * Create a new submission batch
     */
    async createBatch(claimIds, userId, tenantId = 'default') {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create submission record
            const subRes = await client.query(`
                INSERT INTO claim_submissions (tenant_id, created_by, batch_size, status)
                VALUES ($1, $2, $3, 'pending')
                RETURNING *
            `, [tenantId, userId, claimIds.length]);

            const submission = subRes.rows[0];

            // Create submission items
            for (const claimId of claimIds) {
                // Get current claim version
                const verRes = await client.query(
                    'SELECT COALESCE(MAX(version), 1) as ver FROM claims WHERE id = $1',
                    [claimId]
                );
                const version = verRes.rows[0]?.ver || 1;

                await client.query(`
                    INSERT INTO claim_submission_items (submission_id, claim_id, claim_version, status)
                    VALUES ($1, $2, $3, 'pending')
                `, [submission.id, claimId, version]);
            }

            await client.query('COMMIT');
            return submission;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Generate 837P and store
     */
    async generateX12(submissionId, options = {}) {
        // Get claim IDs for this submission
        const itemsRes = await pool.query(
            'SELECT claim_id FROM claim_submission_items WHERE submission_id = $1',
            [submissionId]
        );
        const claimIds = itemsRes.rows.map(r => r.claim_id);

        if (claimIds.length === 0) {
            throw new Error('No claims in submission');
        }

        // Generate X12 content
        const x12Content = await x12Generator.generate837P(claimIds, options);

        // Store in submission
        await pool.query(`
            UPDATE claim_submissions 
            SET x12_content = $1, status = 'generated'
            WHERE id = $2
        `, [x12Content, submissionId]);

        return x12Content;
    }

    /**
     * Submit batch to clearinghouse
     */
    async submitBatch(submissionId, tenantId = 'default') {
        const subRes = await pool.query(
            'SELECT * FROM claim_submissions WHERE id = $1',
            [submissionId]
        );

        if (subRes.rows.length === 0) {
            throw new Error('Submission not found');
        }

        const submission = subRes.rows[0];

        if (!submission.x12_content) {
            throw new Error('X12 not generated yet');
        }

        try {
            // Get clearinghouse provider
            const provider = await clearinghouse.getProvider(tenantId);

            // Submit
            const result = await provider.submitClaim837P(submission.x12_content);

            // Update submission
            await pool.query(`
                UPDATE claim_submissions 
                SET status = 'submitted', 
                    submitted_at = NOW(),
                    clearinghouse_batch_id = $1,
                    attempts = attempts + 1
                WHERE id = $2
            `, [result.id || result.batchId, submissionId]);

            // Update items to submitted
            await pool.query(`
                UPDATE claim_submission_items 
                SET status = 'submitted'
                WHERE submission_id = $1
            `, [submissionId]);

            return { success: true, batchId: result.id };

        } catch (e) {
            // Record error
            await pool.query(`
                UPDATE claim_submissions 
                SET last_error = $1, attempts = attempts + 1
                WHERE id = $2
            `, [e.message, submissionId]);

            throw e;
        }
    }

    /**
     * Get all submissions
     */
    async getSubmissions(tenantId = 'default', limit = 50) {
        const res = await pool.query(`
            SELECT s.*, 
                   u.first_name || ' ' || u.last_name as created_by_name,
                   (SELECT COUNT(*) FROM claim_submission_items WHERE submission_id = s.id) as item_count
            FROM claim_submissions s
            LEFT JOIN users u ON s.created_by = u.id
            WHERE s.tenant_id = $1
            ORDER BY s.created_at DESC
            LIMIT $2
        `, [tenantId, limit]);

        return res.rows;
    }

    /**
     * Get submission details with items
     */
    async getSubmissionDetails(submissionId) {
        const subRes = await pool.query(
            'SELECT * FROM claim_submissions WHERE id = $1',
            [submissionId]
        );

        if (subRes.rows.length === 0) return null;

        const submission = subRes.rows[0];

        // Get items with claim details
        const itemsRes = await pool.query(`
            SELECT i.*, 
                   c.claim_number, c.total_charges,
                   p.first_name, p.last_name, p.mrn
            FROM claim_submission_items i
            LEFT JOIN claims c ON i.claim_id = c.id
            LEFT JOIN patients p ON c.patient_id = p.id
            WHERE i.submission_id = $1
        `, [submissionId]);

        submission.items = itemsRes.rows;
        return submission;
    }

    /**
     * Resubmit failed claims (creates new version)
     */
    async resubmitClaim(claimId, userId) {
        // Increment version on original claim
        await pool.query(`
            UPDATE claims SET version = version + 1 WHERE id = $1
        `, [claimId]);

        // Create new single-claim batch
        const batch = await this.createBatch([claimId], userId);

        return batch;
    }
}

module.exports = new ClaimSubmissionService();
