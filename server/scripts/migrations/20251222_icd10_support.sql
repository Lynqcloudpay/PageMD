-- ICD-10 Support Migration

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Master Catalog
CREATE TABLE IF NOT EXISTS icd10_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    is_billable BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    effective_date DATE,
    termination_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for icd10_codes
CREATE INDEX IF NOT EXISTS idx_icd10_codes_code ON icd10_codes (code);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_description_fts ON icd10_codes USING GIN (to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_icd10_codes_description_trgm ON icd10_codes USING GIN (description gin_trgm_ops);

-- 2. Usage Tracking
CREATE TABLE IF NOT EXISTS icd10_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    icd10_id UUID REFERENCES icd10_codes(id) ON DELETE CASCADE,
    use_count INTEGER DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, icd10_id)
);

-- 3. Favorites
CREATE TABLE IF NOT EXISTS icd10_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    icd10_id UUID REFERENCES icd10_codes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, icd10_id)
);

-- 4. Specialty Tags (Optional but requested)
CREATE TABLE IF NOT EXISTS icd10_specialty_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icd10_id UUID REFERENCES icd10_codes(id) ON DELETE CASCADE,
    specialty VARCHAR(50) NOT NULL,
    UNIQUE(icd10_id, specialty)
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_icd10_codes_updated_at ON icd10_codes;
CREATE TRIGGER update_icd10_codes_updated_at
    BEFORE UPDATE ON icd10_codes
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
