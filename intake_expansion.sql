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
        (''hipaa_notice'', ''NOTICE OF PRIVACY PRACTICES

THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.

{CLINIC_NAME} is required by law to maintain the privacy of your Protected Health Information (PHI), to provide you with this Notice of Privacy Practices, and to follow the terms of this notice.

Uses and Disclosures of Your Health Information
We may use and disclose your PHI without your authorization for the following purposes:
1. Treatment: To provide, coordinate, or manage your healthcare with physicians, specialists, laboratories, pharmacies, and other healthcare providers.
2. Payment: To bill and receive payment from health plans or other entities for services provided to you.
3. Healthcare Operations: For quality assessment, improvement activities, training, licensing, accreditation, audits, and general administrative operations.

Your Rights
You have the right to inspect and copy your medical records, request corrections, receive an accounting of disclosures, and request restrictions.

Effective Date: {EFFECTIVE_DATE}

{CLINIC_NAME}
{CLINIC_ADDRESS}'', ''legal'', ''HIPAA Notice template''),
        (''consent_to_treat'', ''CONSENT TO MEDICAL TREATMENT

I hereby consent to medical evaluation, examination, diagnostic testing, and treatment provided by {CLINIC_NAME}, including services provided by physicians, nurse practitioners, physician assistants, medical assistants, and other healthcare personnel.

I understand that:
1. Medical services may involve risks and benefits that cannot be fully predicted.
2. No guarantees have been made regarding outcomes.
3. I may refuse treatment at any time.

I authorize {CLINIC_NAME} to provide medically necessary care deemed appropriate by my healthcare provider. This consent remains valid unless revoked in writing.'', ''legal'', ''Consent to Treat template''),
        (''assignment_of_benefits'', ''ASSIGNMENT OF INSURANCE BENEFITS

I authorize payment of medical benefits directly to {CLINIC_NAME} for services rendered.

I understand and agree that:
1. I am financially responsible for charges not covered by my insurance.
2. This includes copays, deductibles, coinsurance, and non-covered services.
3. Insurance verification is not a guarantee of payment.

I authorize the release of necessary medical information to insurance carriers for billing, payment, and healthcare operations.'', ''legal'', ''Assignment of Benefits template''),
        (''release_of_information'', ''AUTHORIZATION TO RELEASE HEALTH INFORMATION

I authorize {CLINIC_NAME} to disclose my Protected Health Information for the purpose of treatment, payment, and healthcare operations.

I authorize communication regarding my care via:
- Phone / Voicemail
- Email (Note: Email may not be secure)
- Postal Mail

Individuals authorized to receive my health information:
{ROI_LIST}

This authorization is voluntary and I may revoke it at any time in writing.'', ''legal'', ''Release of Info template''),
        (''telehealth_consent'', ''TELEHEALTH CONSENT

I consent to receive healthcare services via telehealth (video/audio) technology from {CLINIC_NAME}. I understand that telehealth involves the use of electronic communications to enable healthcare providers to share individual patient medical information for the purpose of improving patient care. I understand the potential risks and limitations of telehealth and that I may refuse or withdraw my consent at any time.'', ''legal'', ''Telehealth Consent template''),
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
