const pool = require('../db');

async function runMigration() {
    const migrationSql = `
        -- Ensure status column exists in visits
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visits' AND column_name='status') THEN
                ALTER TABLE visits ADD COLUMN status character varying(20) DEFAULT 'draft';
            END IF;
            
            -- Update existing signed notes to 'signed' status
            UPDATE visits SET status = 'signed' WHERE note_signed_at IS NOT NULL AND (status IS NULL OR status != 'signed');
        END $$;

        -- Create note_retractions table
        CREATE TABLE IF NOT EXISTS note_retractions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            note_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
            retracted_at timestamptz NOT NULL DEFAULT now(),
            retracted_by_user_id uuid NOT NULL REFERENCES users(id),
            reason_code text NOT NULL,
            reason_text text NOT NULL,
            requires_cosign boolean NOT NULL DEFAULT false,
            cosigned_at timestamptz NULL,
            cosigned_by_user_id uuid NULL
        );

        -- Add indexes for performance
        CREATE INDEX IF NOT EXISTS idx_note_retractions_note_id ON note_retractions(note_id);
    `;

    try {
        console.log('--- Starting Note Retraction System Migration ---');

        // 1. Get all clinic schemas
        const clinicsResult = await pool.controlPool.query("SELECT schema_name FROM clinics WHERE status = 'active'");
        const schemas = ['public', ...clinicsResult.rows.map(r => r.schema_name)];

        console.log(`Found ${schemas.length} schemas to update.`);

        for (const schema of schemas) {
            console.log(`Processing schema: ${schema}...`);
            const client = await pool.controlPool.connect();
            try {
                await client.query(`SET search_path TO ${schema}, public`);
                await client.query(migrationSql);
                console.log(`✅ Schema ${schema} updated successfully.`);
            } catch (err) {
                console.error(`❌ Error updating schema ${schema}:`, err.message);
            } finally {
                client.release();
            }
        }

        console.log('--- Migration Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
