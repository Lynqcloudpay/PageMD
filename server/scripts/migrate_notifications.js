const pool = require('../db');

const migrate = async () => {
    try {
        console.log('Starting migration: Notification System Expansion');

        // 1. Create system_announcements table
        await pool.controlPool.query(`
      CREATE TABLE IF NOT EXISTS public.system_announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'critical')),
        target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'clinic', 'plan')),
        target_value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);
        console.log('Created table: system_announcements');

        // 2. Create clinic_alert_dismissals table
        await pool.controlPool.query(`
      CREATE TABLE IF NOT EXISTS public.clinic_alert_dismissals (
        clinic_id UUID NOT NULL,
        alert_id TEXT NOT NULL,
        dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (clinic_id, alert_id)
      );
    `);
        console.log('Created table: clinic_alert_dismissals');

        // 3. Index for performance (optional but good practice)
        await pool.controlPool.query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.system_announcements(is_active) WHERE is_active = true;
    `);
        console.log('Created indexes');

        console.log('Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
