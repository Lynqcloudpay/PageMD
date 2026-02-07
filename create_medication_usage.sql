
DO $$ 
BEGIN 
    CREATE TABLE IF NOT EXISTS public.medication_usage (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        rxcui VARCHAR(20) NOT NULL,
        use_count INTEGER DEFAULT 1,
        last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, rxcui)
    );
END $$;
