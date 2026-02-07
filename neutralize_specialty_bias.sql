
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- 1. Reset Global ICD-10 Cardiology Seeds
    UPDATE public.icd10_codes 
    SET usage_count = 0 
    WHERE code IN ('I10', 'I48.91', 'I25.10', 'I50.9', 'E78.5', 'R07.9', 'I35.0');

    -- 2. Reset Medications across all schemas
    FOR r IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' OR schema_name LIKE 'sandbox_%'
    LOOP 
        BEGIN
            EXECUTE format('UPDATE %I.medication_database SET usage_count = 0 WHERE name ILIKE ANY (ARRAY[$1, $2, $3, $4, $5, $6, $7])', r.schema_name)
            USING '%Lisinopril%', '%Atorvastatin%', '%Metoprolol%', '%Amlodipine%', '%Losartan%', '%Furosemide%', '%Apixaban%';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping schema %: %', r.schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
