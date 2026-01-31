DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%' LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS cts_documentation JSONB', schema_name);
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS ascvd_documentation JSONB', schema_name);
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS safety_plan_documentation JSONB', schema_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to migrate schema %: %', schema_name, SQLERRM;
        END;
    END LOOP;

    -- Also check public schema
    BEGIN
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS cts_documentation JSONB;
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS ascvd_documentation JSONB;
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS safety_plan_documentation JSONB;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to migrate public schema: %', SQLERRM;
    END;
END $$;
