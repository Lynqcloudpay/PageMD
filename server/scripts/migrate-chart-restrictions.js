const pool = require('../db');

const migrate = async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Chart Restrictions & Audit Logging Migration...');

        await client.query('BEGIN');

        // 1. Patient Table Alterations
        console.log('Adding restriction fields to patients table...');
        await client.query(`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS restriction_reason TEXT,
      ADD COLUMN IF NOT EXISTS restricted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMP WITH TIME ZONE;
    `);

        // 2. Break-Glass Sessions Table
        console.log('Creating break_glass_sessions table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS break_glass_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        reason_code VARCHAR(50) NOT NULL,
        reason_comment TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_bg_sessions_patient ON break_glass_sessions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_bg_sessions_user ON break_glass_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_bg_sessions_expiry ON break_glass_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_bg_sessions_clinic ON break_glass_sessions(clinic_id);
    `);

        // 3. Chart Access Logs Table
        console.log('Creating chart_access_logs table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS chart_access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL,
        patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_role VARCHAR(50),
        access_type VARCHAR(50),
        is_restricted BOOLEAN DEFAULT FALSE,
        break_glass_used BOOLEAN DEFAULT FALSE,
        break_glass_session_id UUID REFERENCES break_glass_sessions(id) ON DELETE SET NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_chart_logs_patient ON chart_access_logs(patient_id);
      CREATE INDEX IF NOT EXISTS idx_chart_logs_user ON chart_access_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_chart_logs_clinic ON chart_access_logs(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_chart_logs_created ON chart_access_logs(created_at);
    `);

        // 4. Privacy Alerts Table
        console.log('Creating privacy_alerts table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS privacy_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL,
        severity VARCHAR(20) NOT NULL, -- low, medium, high
        alert_type VARCHAR(50) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        details_json JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_privacy_alerts_clinic ON privacy_alerts(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_privacy_alerts_severity ON privacy_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_privacy_alerts_unresolved ON privacy_alerts(created_at) WHERE resolved_at IS NULL;
    `);

        // 5. Clinic Settings Alterations (Tenant Config)
        console.log('Adding enterprise settings to clinic_settings...');
        // We check if clinic_settings exists here. In this multi-tenant setup, usually it's in the control DB.
        // However, for consistency we'll try to add them to the local settings if applicable.
        // Based on control_schema.sql, clinic_settings is in control DB.
        // We'll also add them to the local 'practice_settings' if that exists, or just skip if it's external.

        // Check if clinic_settings exists in this connection (for single-tenant or shard)
        const tableCheck = await client.query("SELECT to_regclass('clinic_settings') as exists");
        if (tableCheck.rows[0].exists) {
            await client.query(`
        ALTER TABLE clinic_settings 
        ADD COLUMN IF NOT EXISTS break_glass_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS break_glass_session_ttl_minutes INTEGER DEFAULT 60,
        ADD COLUMN IF NOT EXISTS after_hours_start TIME DEFAULT '18:00:00',
        ADD COLUMN IF NOT EXISTS after_hours_end TIME DEFAULT '07:00:00',
        ADD COLUMN IF NOT EXISTS alert_threshold_break_glass_per_24h INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS alert_threshold_chart_opens_per_10min INTEGER DEFAULT 30,
        ADD COLUMN IF NOT EXISTS allow_front_desk_restricted_access BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS restricted_reason_options JSONB DEFAULT '["Sensitive patient", "Employee / VIP", "Legal investigation", "Behavioral health", "Substance use", "Other"]';
      `);
        }

        await client.query('COMMIT');
        console.log('✅ Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
};

migrate();
