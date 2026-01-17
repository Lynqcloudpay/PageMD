-- QPP & MIPS Admin Workspace Migration
-- Performance Year Versioned & Specialty Pack Driven

-- 1. QPP Measure Library
CREATE TABLE IF NOT EXISTS qpp_measures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    performance_year INTEGER NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('QUALITY', 'IA', 'PI', 'COST')),
    qpp_id VARCHAR(50) NOT NULL, -- e.g. Quality ID '128', IA ID 'IA_EPA_1'
    title TEXT NOT NULL,
    description TEXT,
    measure_type VARCHAR(50), -- eCQM, MIPS_CQM, claims, registry, attestation
    specialty_set TEXT[], -- array of specialty sets this belongs to (from CMS)
    mvp_ids TEXT[], -- array of MVP IDs this belongs to
    spec_url TEXT, -- link to CMS/QPP spec
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(performance_year, qpp_id)
);

-- 2. Specialty Packs Configuration
CREATE TABLE IF NOT EXISTS specialty_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    performance_year INTEGER NOT NULL,
    specialty VARCHAR(100) NOT NULL, -- Cardiology, Family Medicine, etc.
    reporting_path VARCHAR(50) DEFAULT 'TRADITIONAL_MIPS' CHECK (reporting_path IN ('TRADITIONAL_MIPS', 'MVP')),
    mvp_id VARCHAR(50), -- nullable if not MVP path
    measure_ids UUID[], -- array of Quality measure UUIDs from qpp_measures
    ia_ids UUID[], -- array of IA UUIDs from qpp_measures
    pi_ids UUID[], -- array of PI UUIDs from qpp_measures
    cost_refs JSONB, -- informational references to cost measures
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(performance_year, specialty, reporting_path, mvp_id)
);

-- 3. Measure Computation Configuration
CREATE TABLE IF NOT EXISTS measure_calc_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id UUID NOT NULL REFERENCES qpp_measures(id) ON DELETE CASCADE,
    logic_type VARCHAR(20) NOT NULL CHECK (logic_type IN ('COMPUTED', 'PARTIAL', 'MANUAL')),
    required_chart_fields JSONB, -- list of required fields/structured data items
    query_template TEXT, -- SQL or JSON structure for extraction logic
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(measure_id)
);

-- 4. Provider Scores (Snapshot Table)
CREATE TABLE IF NOT EXISTS provider_measure_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES users(id),
    measure_id UUID NOT NULL REFERENCES qpp_measures(id),
    performance_year INTEGER NOT NULL,
    numerator INTEGER DEFAULT 0,
    denominator INTEGER DEFAULT 0,
    exclusions INTEGER DEFAULT 0,
    last_computed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, measure_id, performance_year)
);

-- 5. Patient Measure Gaps (Granular tracking)
CREATE TABLE IF NOT EXISTS patient_measure_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    measure_id UUID NOT NULL REFERENCES qpp_measures(id) ON DELETE CASCADE,
    performance_year INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('MET', 'NOT_MET', 'EXCLUDED', 'INELIGIBLE')),
    last_action_date DATE,
    next_due_date DATE,
    evidence_data JSONB, -- diagnostic codes, lab results, vitals that triggered the status
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, measure_id, performance_year)
);

-- 6. Tenant/Clinic Attestations (Evidence for IA/PI)
CREATE TABLE IF NOT EXISTS tenant_attestations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL, -- link to tenant
    measure_id UUID NOT NULL REFERENCES qpp_measures(id) ON DELETE CASCADE,
    performance_year INTEGER NOT NULL,
    is_attested BOOLEAN DEFAULT false,
    attested_by UUID REFERENCES users(id),
    attested_at TIMESTAMP WITH TIME ZONE,
    evidence_links TEXT[], -- URLs to uploaded evidence or notes
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clinic_id, measure_id, performance_year)
);

-- Triggers for updated_at
CREATE TRIGGER update_qpp_measures_updated_at BEFORE UPDATE ON qpp_measures FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_specialty_packs_updated_at BEFORE UPDATE ON specialty_packs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_measure_calc_configs_updated_at BEFORE UPDATE ON measure_calc_configs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_provider_measure_scores_updated_at BEFORE UPDATE ON provider_measure_scores FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_patient_measure_states_updated_at BEFORE UPDATE ON patient_measure_states FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_tenant_attestations_updated_at BEFORE UPDATE ON tenant_attestations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
