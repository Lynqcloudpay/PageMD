DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT schema_name FROM clinics WHERE schema_name IS NOT NULL LOOP
        -- Check if table exists in this schema
        IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = r.schema_name AND table_name = 'after_visit_summaries') THEN
            RAISE NOTICE 'Creating after_visit_summaries in schema %', r.schema_name;
            EXECUTE format('
                CREATE TABLE %I.after_visit_summaries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    encounter_id UUID NOT NULL UNIQUE,
                    instructions TEXT,
                    follow_up TEXT,
                    return_precautions TEXT,
                    sent_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )', r.schema_name);
        ELSE
            -- Check if unique constraint exists
            IF NOT EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints 
                WHERE table_schema = r.schema_name 
                AND table_name = 'after_visit_summaries' 
                AND constraint_type = 'UNIQUE'
            ) THEN
                RAISE NOTICE 'Adding unique constraint to after_visit_summaries in schema %', r.schema_name;
                EXECUTE format('ALTER TABLE %I.after_visit_summaries ADD CONSTRAINT after_visit_summaries_encounter_id_key UNIQUE (encounter_id)', r.schema_name);
            END IF;
        END IF;
    END LOOP;
END $$;
