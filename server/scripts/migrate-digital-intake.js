const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db' : 'localhost'),
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || (process.env.NODE_ENV === 'production' ? 'emr_db' : 'paper_emr'),
        user: process.env.DB_USER || (process.env.NODE_ENV === 'production' ? 'emr_user' : 'postgres'),
        password: process.env.DB_PASSWORD || 'postgres',
    };

if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('--- Digital Intake System Migration (Multi-Tenant) ---');

        // 1. Get all schemas
        const clinicsRes = await client.query('SELECT display_name, schema_name FROM public.clinics WHERE schema_name IS NOT NULL');
        const schemas = ['public', ...clinicsRes.rows.map(r => r.schema_name)];

        for (const schema of schemas) {
            console.log(`\nMigrating schema: ${schema}`);
            await client.query(`SET search_path TO ${schema}, public`);

            await client.query('BEGIN');

            // 1. intake_invites
            await client.query(`
        CREATE TABLE IF NOT EXISTS intake_invites (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID, -- For global safety
          created_by_user_id UUID REFERENCES public.users(id),
          channel VARCHAR(10) NOT NULL, -- qr, sms, email
          to_phone VARCHAR(20),
          to_email VARCHAR(255),
          prefill_first_name VARCHAR(100),
          prefill_last_name VARCHAR(100),
          prefill_dob DATE,
          prefill_phone VARCHAR(20),
          token_hash TEXT NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          status VARCHAR(20) DEFAULT 'Sent', -- Draft, Sent, InProgress, Submitted, NeedsEdits, Approved, Expired, Cancelled
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

            // 2. intake_submissions
            await client.query(`
        CREATE TABLE IF NOT EXISTS intake_submissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID,
          invite_id UUID REFERENCES intake_invites(id) ON DELETE CASCADE,
          patient_id UUID REFERENCES patients(id), -- Nullable until approved
          data_json JSONB NOT NULL,
          signature_json JSONB,
          attachments JSONB DEFAULT '[]',
          submitted_at TIMESTAMP WITH TIME ZONE,
          review_notes JSONB DEFAULT '[]', -- Array of {note: string, author: string, created_at: string}
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

            // Add unique constraint separately to ensure it exists
            await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intake_submissions_invite_id_key') THEN
            ALTER TABLE intake_submissions ADD CONSTRAINT intake_submissions_invite_id_key UNIQUE (invite_id);
          END IF;
        END $$;
      `);

            // 3. audit_events (Specifically for Intake as requested)
            await client.query(`
        CREATE TABLE IF NOT EXISTS audit_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID,
          actor_type VARCHAR(20) NOT NULL, -- staff, patient, system
          actor_id UUID, -- user_id or invite_id
          action VARCHAR(100) NOT NULL,
          object_type VARCHAR(50) NOT NULL,
          object_id UUID,
          ip VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

            // 4. Ensure inbox_items can handle the new registration type
            // The inbox_items table already exists if inbasket was initialized.
            // But we might be in a schema that doesn't have it yet.
            // Reuse the ensureSchema logic from inbasket.js implicitly if needed, 
            // but here we just make sure it exists.
            await client.query(`
        CREATE TABLE IF NOT EXISTS inbox_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID,
          patient_id UUID REFERENCES patients(id),
          type VARCHAR(50) NOT NULL,
          priority VARCHAR(20) DEFAULT 'normal',
          status VARCHAR(50) DEFAULT 'new',
          subject VARCHAR(255),
          body TEXT,
          reference_id UUID,
          reference_table VARCHAR(50),
          assigned_user_id UUID REFERENCES public.users(id),
          assigned_role VARCHAR(50),
          created_by UUID REFERENCES public.users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP WITH TIME ZONE,
          completed_by UUID REFERENCES public.users(id)
        )
      `);

            // Indexes
            await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_invites_token ON intake_invites(token_hash)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_invites_status ON intake_invites(status)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_submissions_invite ON intake_submissions(invite_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events(tenant_id)`);

            await client.query('COMMIT');
            console.log(`✅ Schema ${schema} migrated.`);
        }

        console.log('\n✅ Digital Intake Migration successful');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        try { await client.query('SET search_path TO public'); } catch (e) { }
        client.release();
        await pool.end();
    }
}

migrate();
