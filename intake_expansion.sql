-- Migration: Intake Expansion
-- Adds support for full standard intake set and individualized rate limits logic (logic already added, but ensure schema is ready)

-- Add IP and User Agent to intake_sessions for audit/legal compliance
CREATE OR REPLACE FUNCTION public.expand_intake_sessions(target_schema TEXT) 
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        ALTER TABLE %I.intake_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
        ALTER TABLE %I.intake_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
        
        CREATE TABLE IF NOT EXISTS %I.intake_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT NOT NULL,
            category VARCHAR(50) DEFAULT ''general'',
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by UUID
        );

        -- Seed default values if empty
        INSERT INTO %I.intake_settings (key, value, category, description)
        VALUES 
        (''financial_policy'', ''Welcome to our practice. We are committed to providing you with the best possible medical care.
1. Financial Responsibility: You are responsible for the timely payment of all charges for services provided. 
2. Insurance: We will bill your insurance as a courtesy. However, you must provide accurate insurance information. 
3. Co-payments: All co-payments and deductibles are due at the time of service.
4. No-Show Fees: We require 24-hour notice for cancellations. Failure to do so may result in a cancellation fee.'', ''legal'', ''Financial Policy template''),
        (''hipaa_notice'', ''THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.
We are required by law to maintain the privacy of your Protected Health Information (PHI). We use your PHI for:
- Treatment: Sharing info with specialists or hospitals.
- Payment: Billing your insurance carrier.
- Healthcare Operations: Quality improvement and clinical audits.
You have the right to access, amend, and request restrictions on your PHI at any time.'', ''legal'', ''HIPAA Notice template''),
        (''consent_to_treat'', ''I hereby authorize and request medical treatment and procedures as may be deemed necessary by the healthcare providers and clinical staff. I understand that medical practice is not an exact science and that no specific guarantees have been made to me regarding the results of any examination or treatment. I acknowledge that I have the right to discuss my care plan and ask questions about risks, benefits, and alternatives prior to any procedure.'', ''legal'', ''Consent to Treat template''),
        (''assignment_of_benefits'', ''I hereby assign and authorize direct payment to the provider for all medical benefits otherwise payable to me for services rendered. 
I understand that I am financially responsible for all charges not covered by my insurance carrier, including co-insurance, deductibles, and non-covered services. This assignment will remain in effect until revoked by me in writing.'', ''legal'', ''Assignment of Benefits template''),
        (''release_of_information'', ''I authorize the release of any medical or other information necessary to process my insurance claims. This includes the release of medical records to other healthcare providers involved in my care coordination and treatment. I understand that I may revoke this authorization in writing at any time, except to the extent that action has already been taken in reliance on it.'', ''legal'', ''Release of Info template''),
        (''telehealth_consent'', ''I consent to receive healthcare services via telehealth (video/audio) technology. I understand that telehealth involves the use of electronic communications to enable healthcare providers at different locations to share individual patient medical information for the purpose of improving patient care. I understand the potential risks and limitations of telehealth and that I may refuse or withdraw my consent at any time.'', ''legal'', ''Telehealth Consent template''),
        (''telehealth_enabled'', ''false'', ''config'', ''Whether telehealth consent is required'')
        ON CONFLICT (key) DO NOTHING;
    ', target_schema, target_schema, target_schema, target_schema);
END;
$$ LANGUAGE plpgsql;

-- Apply to existing tenant schemas
DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN SELECT schema_name FROM public.clinics LOOP
        PERFORM public.expand_intake_sessions(schema_rec.schema_name);
    END LOOP;
END $$;
