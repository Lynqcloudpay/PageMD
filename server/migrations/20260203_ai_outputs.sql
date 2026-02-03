-- ============================================================================
-- AI Gateway - AI Output Storage
-- Phase 8: AI output provenance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    app_id UUID REFERENCES apps(id),
    type VARCHAR(50) NOT NULL,  -- visit-summary, icd10-suggestions, order-suggestions, patient-message-draft
    input_hash VARCHAR(64) NOT NULL,
    input_summary TEXT,
    output JSONB NOT NULL,
    model VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_tenant ON ai_outputs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_type ON ai_outputs(type);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_created ON ai_outputs(created_at);

COMMENT ON TABLE ai_outputs IS 'Stores AI-generated outputs with provenance tracking for audit and review';
