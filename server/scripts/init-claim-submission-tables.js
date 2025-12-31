require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'paper_emr',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

async function init() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Claim Submissions Table (Batches)
        await client.query(`
            CREATE TABLE IF NOT EXISTS claim_submissions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(50) DEFAULT 'default',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by UUID,
                status VARCHAR(50) DEFAULT 'pending',
                batch_size INT DEFAULT 0,
                payload_ref TEXT,
                x12_content TEXT,
                ack_999_ref TEXT,
                ack_999_status VARCHAR(50),
                ack_277_ref TEXT,
                ack_277_status VARCHAR(50),
                last_error TEXT,
                attempts INT DEFAULT 0,
                submitted_at TIMESTAMP,
                clearinghouse_batch_id VARCHAR(255)
            )
        `);
        console.log("Created claim_submissions table");

        // Claim Submission Items (Individual Claims in Batch)
        await client.query(`
            CREATE TABLE IF NOT EXISTS claim_submission_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                submission_id UUID REFERENCES claim_submissions(id),
                claim_id UUID,
                claim_version INT DEFAULT 1,
                status VARCHAR(50) DEFAULT 'pending',
                payer_claim_number VARCHAR(255),
                last_error TEXT,
                ack_status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Created claim_submission_items table");

        // ERA Files Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS era_files (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(50) DEFAULT 'default',
                received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                filename VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending',
                raw_content TEXT,
                parsed_content JSONB,
                check_eft_number VARCHAR(100),
                check_date DATE,
                total_paid DECIMAL(12,2) DEFAULT 0,
                uploaded_by UUID,
                posted_at TIMESTAMP,
                posted_by UUID
            )
        `);
        console.log("Created era_files table");

        // ERA Claims (Matched Claims from ERA)
        await client.query(`
            CREATE TABLE IF NOT EXISTS era_claims (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                era_file_id UUID REFERENCES era_files(id),
                claim_id UUID,
                patient_id UUID,
                payer_claim_number VARCHAR(255),
                service_date DATE,
                billed_amount DECIMAL(12,2),
                paid_amount DECIMAL(12,2),
                patient_responsibility DECIMAL(12,2),
                status VARCHAR(50) DEFAULT 'matched',
                match_confidence DECIMAL(5,2),
                manual_match BOOLEAN DEFAULT false
            )
        `);
        console.log("Created era_claims table");

        // ERA Lines (Line-level detail)
        await client.query(`
            CREATE TABLE IF NOT EXISTS era_lines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                era_claim_id UUID REFERENCES era_claims(id),
                procedure_code VARCHAR(20),
                billed_amount DECIMAL(12,2),
                paid_amount DECIMAL(12,2),
                adj_group_code VARCHAR(10),
                adj_reason_code VARCHAR(10),
                adj_amount DECIMAL(12,2),
                remark_codes TEXT,
                units INT DEFAULT 1
            )
        `);
        console.log("Created era_lines table");

        await client.query('COMMIT');
        console.log("All claim submission and ERA tables created successfully");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

init();
