-- Migration to ensure public.inbox_items has the tenant_id column
-- This prevents issues when search_path includes both public and tenant schemas

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inbox_items' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.inbox_items ADD COLUMN tenant_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inbox_notes' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.inbox_notes ADD COLUMN tenant_id UUID;
    END IF;
END $$;
