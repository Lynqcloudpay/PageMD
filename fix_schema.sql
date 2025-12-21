-- Fix for documents table doc_type constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_doc_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_doc_type_check CHECK (doc_type = ANY (ARRAY['imaging', 'consult', 'lab', 'other', 'ekg', 'echo', 'stress_test', 'cardiac_cath', 'clinical_note', 'referral', 'superbill', 'consent', 'insurance', 'identification']));

-- Ensure vendor_payload is always treated correctly
-- (No SQL change needed if it's already jsonb, just fixing the JS side)
