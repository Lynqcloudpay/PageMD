-- Migration to optimize ICD-10 search
ALTER TABLE icd10_codes ADD COLUMN IF NOT EXISTS keywords text;
ALTER TABLE icd10_codes ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Update specific critical codes with keywords
UPDATE icd10_codes SET keywords = 'annual physical, physical exam, adult medical exam, wellness visit, check up' WHERE code = 'Z00.00';
UPDATE icd10_codes SET keywords = 'child physical, pediatric exam, well child, pediatric medical exam' WHERE code = 'Z00.129';
UPDATE icd10_codes SET keywords = 'establish care, employment physical, administrative exam' WHERE code = 'Z02.0';
UPDATE icd10_codes SET keywords = 'shots, vaccines, immunization' WHERE code = 'Z23';
UPDATE icd10_codes SET keywords = 'established patient, follow up, post-op' WHERE code = 'Z09';
UPDATE icd10_codes SET keywords = 'high blood pressure, hypertension, htn' WHERE code = 'I10';
UPDATE icd10_codes SET keywords = 'diabetes, dm2, type 2 diabetes' WHERE code = 'E11.9';
UPDATE icd10_codes SET keywords = 'high cholesterol, hyperlipidemia, hld' WHERE code = 'E78.5';

-- Populate search_vector
UPDATE icd10_codes SET search_vector = to_tsvector('english', code || ' ' || description || ' ' || COALESCE(keywords, ''));

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_icd10_codes_search_vector ON icd10_codes USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_keywords_trgm ON icd10_codes USING gin (keywords gin_trgm_ops);

-- Add trigger for automatic search_vector updates
CREATE OR REPLACE FUNCTION icd10_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  new.search_vector := to_tsvector('english', new.code || ' ' || new.description || ' ' || COALESCE(new.keywords, ''));
  RETURN new;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_icd10_search_vector ON icd10_codes;
CREATE TRIGGER trg_icd10_search_vector BEFORE INSERT OR UPDATE ON icd10_codes
FOR EACH ROW EXECUTE FUNCTION icd10_search_vector_trigger();
