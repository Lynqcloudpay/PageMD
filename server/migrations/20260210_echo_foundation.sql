-- ============================================================================
-- Project Echo — AI Clinical Assistant Foundation
-- Phase 1: Conversation state, message history, and audit trail
-- ============================================================================

-- Echo conversation threads (per-patient, per-user)
CREATE TABLE IF NOT EXISTS echo_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    title TEXT,
    context_summary JSONB,
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages within a conversation
CREATE TABLE IF NOT EXISTS echo_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES echo_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    tokens_used INTEGER DEFAULT 0,
    model VARCHAR(100),
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Echo-specific audit trail (HIPAA: tracks every data access by the AI)
CREATE TABLE IF NOT EXISTS echo_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES echo_conversations(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    patient_id UUID,
    action VARCHAR(50) NOT NULL,
    tool_name VARCHAR(100),
    input_redacted TEXT,
    output_summary TEXT,
    data_accessed JSONB,
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily token usage tracking (per-clinic budget enforcement)
CREATE TABLE IF NOT EXISTS echo_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_tokens INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    total_tool_calls INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, usage_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_echo_conv_patient ON echo_conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_echo_conv_user ON echo_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_echo_conv_tenant ON echo_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_echo_msg_conv ON echo_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_echo_audit_patient ON echo_audit(patient_id);
CREATE INDEX IF NOT EXISTS idx_echo_audit_tenant ON echo_audit(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_echo_usage_tenant_date ON echo_usage(tenant_id, usage_date);

-- Comments
COMMENT ON TABLE echo_conversations IS 'Echo AI assistant conversation threads, scoped per-patient per-user';
COMMENT ON TABLE echo_messages IS 'Individual messages within Echo conversations, including tool call/result pairs';
COMMENT ON TABLE echo_audit IS 'HIPAA-compliant audit trail for all Echo AI data access events';
COMMENT ON TABLE echo_usage IS 'Daily token usage tracking per clinic for budget enforcement';
