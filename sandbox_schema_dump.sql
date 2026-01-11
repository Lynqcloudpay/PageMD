--
-- PostgreSQL database dump
--

\restrict Jf7w9z0bTkp8ufc9djaZfTBH8ens1JlNgYuzRYHrVeQikA6gyzHHHmh91hhtycb

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: tenant_sandbox; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tenant_sandbox;


--
-- Name: superbill_status; Type: TYPE; Schema: tenant_sandbox; Owner: -
--

CREATE TYPE tenant_sandbox.superbill_status AS ENUM (
    'DRAFT',
    'READY',
    'FINALIZED',
    'VOID'
);


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: tenant_sandbox; Owner: -
--

CREATE FUNCTION tenant_sandbox.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: allergies; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.allergies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    allergen character varying(255) NOT NULL,
    reaction character varying(255),
    severity character varying(50),
    onset_date date,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: appointments; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    appointment_date date NOT NULL,
    appointment_time time without time zone NOT NULL,
    duration integer DEFAULT 30,
    appointment_type character varying(50) DEFAULT 'Follow-up'::character varying,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    notes text,
    created_by uuid NOT NULL,
    clinic_id uuid,
    patient_status character varying(50) DEFAULT 'scheduled'::character varying,
    room_sub_status character varying(50),
    current_room character varying(20),
    arrival_time timestamp without time zone,
    checkout_time timestamp without time zone,
    cancellation_reason text,
    status_history jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointments_appointment_type_check CHECK (((appointment_type)::text = ANY ((ARRAY['Follow-up'::character varying, 'New Patient'::character varying, 'Sick Visit'::character varying, 'Physical'::character varying])::text[]))),
    CONSTRAINT appointments_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'confirmed'::character varying, 'checked-in'::character varying, 'in-progress'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'no-show'::character varying])::text[])))
);


--
-- Name: ar_activity; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.ar_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pid uuid NOT NULL,
    encounter uuid NOT NULL,
    sequence_no integer NOT NULL,
    code_type character varying(12) DEFAULT ''::character varying,
    code character varying(20) DEFAULT ''::character varying,
    modifier character varying(12) DEFAULT ''::character varying,
    payer_type integer DEFAULT 0,
    post_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    post_user uuid,
    session_id uuid,
    memo character varying(255) DEFAULT ''::character varying,
    pay_amount numeric(12,2) DEFAULT 0.00,
    adj_amount numeric(12,2) DEFAULT 0.00,
    follow_up character(1),
    follow_up_note text,
    account_code character varying(15),
    reason_code character varying(255),
    deleted timestamp without time zone
);


--
-- Name: ar_session; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.ar_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payer_id uuid,
    user_id uuid NOT NULL,
    closed boolean DEFAULT false,
    reference character varying(255) DEFAULT ''::character varying,
    check_date date,
    deposit_date date,
    pay_total numeric(12,2) DEFAULT 0.00,
    global_amount numeric(12,2) DEFAULT 0.00,
    payment_type character varying(50),
    description text,
    adjustment_code character varying(50),
    post_to_date date,
    patient_id uuid,
    encounter uuid,
    payment_method character varying(25),
    idempotency_key uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: audit_events; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    actor_type character varying(20) NOT NULL,
    actor_id uuid,
    action character varying(100) NOT NULL,
    object_type character varying(50) NOT NULL,
    object_id uuid,
    ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: audit_logs; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    ip_address character varying(45),
    actor_ip character varying(45),
    user_agent text,
    actor_user_agent text,
    outcome character varying(20),
    request_id character varying(50),
    session_id character varying(50),
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: billing; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.billing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    code_type character varying(15) NOT NULL,
    code character varying(20) NOT NULL,
    pid uuid NOT NULL,
    encounter uuid NOT NULL,
    provider_id uuid,
    user_id uuid,
    groupname character varying(255),
    authorized boolean DEFAULT false,
    code_text text,
    billed boolean DEFAULT false,
    activity boolean DEFAULT true,
    payer_id uuid,
    bill_process smallint DEFAULT 0,
    bill_date timestamp without time zone,
    process_date timestamp without time zone,
    process_file character varying(255),
    modifier1 character varying(12) DEFAULT ''::character varying,
    modifier2 character varying(12) DEFAULT ''::character varying,
    modifier3 character varying(12) DEFAULT ''::character varying,
    modifier4 character varying(12) DEFAULT ''::character varying,
    units integer DEFAULT 1,
    fee numeric(12,2) DEFAULT 0.00,
    justify character varying(255),
    target character varying(30),
    x12_partner_id integer,
    ndc_info character varying(255),
    notecodes character varying(25) DEFAULT ''::character varying,
    external_id character varying(50),
    pricelevel character varying(31) DEFAULT ''::character varying,
    revenue_code character varying(6) DEFAULT ''::character varying,
    chargecat character varying(31) DEFAULT ''::character varying
);


--
-- Name: billing_event_log; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.billing_event_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type character varying(50) NOT NULL,
    actor_id uuid,
    visit_id uuid,
    claim_id uuid,
    session_id uuid,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: billing_modifiers; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.billing_modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(5) NOT NULL,
    description text,
    is_standard boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: break_glass_sessions; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.break_glass_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    patient_id uuid NOT NULL,
    user_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL,
    reason_code character varying(50) NOT NULL,
    reason_comment text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cancellation_followup_notes; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.cancellation_followup_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    followup_id uuid NOT NULL,
    note text NOT NULL,
    note_type character varying(50) DEFAULT 'general'::character varying,
    created_by uuid,
    created_by_name character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cancellation_followups; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.cancellation_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid,
    patient_id uuid,
    provider_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    reason text,
    addressed_by uuid,
    addressed_at timestamp without time zone,
    dismissed_by uuid,
    dismissed_at timestamp without time zone,
    dismiss_reason text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: chart_access_logs; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.chart_access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    patient_id uuid,
    user_id uuid,
    user_role character varying(50),
    access_type character varying(50),
    is_restricted boolean DEFAULT false,
    break_glass_used boolean DEFAULT false,
    break_glass_session_id uuid,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: claims; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    payer_id uuid,
    status integer DEFAULT 0,
    payer_type integer DEFAULT 0,
    bill_process integer DEFAULT 0,
    bill_time timestamp without time zone,
    process_time timestamp without time zone,
    process_file character varying(255),
    target character varying(30),
    x12_partner_id integer,
    submitted_claim text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clinical_alerts; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.clinical_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    alert_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'normal'::character varying,
    message text NOT NULL,
    rule_name character varying(100),
    active boolean DEFAULT true,
    acknowledged_by uuid,
    acknowledged_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT clinical_alerts_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: clinical_settings; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.clinical_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    require_dx_on_visit boolean DEFAULT true,
    require_vitals_on_visit boolean DEFAULT false,
    enable_clinical_alerts boolean DEFAULT true,
    enable_drug_interaction_check boolean DEFAULT true,
    enable_allergy_alerts boolean DEFAULT true,
    default_visit_duration_minutes integer DEFAULT 15,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: documents; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    visit_id uuid,
    uploader_id uuid NOT NULL,
    doc_type character varying(50),
    filename character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    mime_type character varying(100),
    file_size bigint,
    tags text[],
    reviewed boolean DEFAULT false,
    reviewed_at timestamp without time zone,
    reviewed_by uuid,
    comment text,
    comments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT documents_doc_type_check CHECK (((doc_type)::text = ANY (ARRAY[('imaging'::character varying)::text, ('consult'::character varying)::text, ('lab'::character varying)::text, ('other'::character varying)::text, ('profile_photo'::character varying)::text])))
);


--
-- Name: drug_inventory; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.drug_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drug_id uuid NOT NULL,
    warehouse_id uuid,
    on_hand integer DEFAULT 0,
    cost numeric(12,2) DEFAULT 0.00,
    lot_number character varying(255),
    expiration date,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_drug_inventory_non_negative CHECK ((on_hand >= 0))
);


--
-- Name: drug_sales; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.drug_sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drug_id uuid,
    inventory_id uuid,
    prescription_id uuid,
    pid uuid NOT NULL,
    encounter uuid NOT NULL,
    user_id uuid,
    sale_date date DEFAULT CURRENT_DATE NOT NULL,
    quantity integer DEFAULT 0,
    fee numeric(12,2) DEFAULT 0.00,
    billed boolean DEFAULT false,
    notes character varying(255),
    bill_date timestamp without time zone,
    pricelevel character varying(31) DEFAULT ''::character varying,
    selector character varying(255),
    trans_type smallint DEFAULT 1,
    chargecat character varying(31) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: email_settings; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.email_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    smtp_host character varying(255),
    smtp_port integer,
    smtp_secure boolean DEFAULT true,
    smtp_username character varying(255),
    smtp_password character varying(255),
    from_name character varying(255),
    from_email character varying(255),
    reply_to_email character varying(255),
    enabled boolean DEFAULT false,
    test_email character varying(255),
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: encryption_keys; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.encryption_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key_id character varying(255),
    key_type character varying(50) NOT NULL,
    key_version integer DEFAULT 1,
    dek_encrypted text,
    encrypted_key text NOT NULL,
    algorithm character varying(50) DEFAULT 'AES-256-GCM'::character varying,
    is_active boolean DEFAULT true,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    rotated_at timestamp without time zone
);


--
-- Name: family_history; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.family_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    condition character varying(255) NOT NULL,
    relationship character varying(100) NOT NULL,
    age_at_diagnosis integer,
    age_at_death integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: feature_flags; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_key character varying(100),
    category character varying(100),
    enabled boolean DEFAULT false,
    config_data jsonb,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fee_schedule; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.fee_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_type character varying(20) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    fee_amount numeric(10,2),
    price_level character varying(20) DEFAULT 'Standard'::character varying,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fee_schedule_code_type_check CHECK (((code_type)::text = ANY ((ARRAY['CPT'::character varying, 'HCPCS'::character varying, 'ICD10'::character varying])::text[])))
);


--
-- Name: fee_sheet_categories; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.fee_sheet_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fee_sheet_category_codes; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.fee_sheet_category_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    code_type character varying(20) NOT NULL,
    code character varying(20) NOT NULL,
    description text,
    default_modifier character varying(20),
    default_units integer DEFAULT 1,
    default_fee numeric(12,2),
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fee_sheet_category_codes_code_type_check CHECK (((code_type)::text = ANY ((ARRAY['CPT'::character varying, 'HCPCS'::character varying, 'ICD10'::character varying])::text[])))
);


--
-- Name: flag_types; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.flag_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    label text NOT NULL,
    category text NOT NULL,
    severity text NOT NULL,
    color text,
    requires_acknowledgment boolean DEFAULT false,
    requires_expiration boolean DEFAULT false,
    default_expiration_days integer,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT flag_types_category_check CHECK ((category = ANY (ARRAY['clinical'::text, 'admin'::text, 'safety'::text]))),
    CONSTRAINT flag_types_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warn'::text, 'critical'::text])))
);


--
-- Name: inbox_items; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.inbox_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    patient_id uuid,
    type character varying(50) NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying,
    status character varying(50) DEFAULT 'new'::character varying,
    subject character varying(255),
    body text,
    reference_id uuid,
    reference_table character varying(50),
    assigned_user_id uuid,
    assigned_role character varying(50),
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    completed_by uuid
);


--
-- Name: inbox_notes; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.inbox_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid,
    user_id uuid,
    user_name character varying(100),
    note text NOT NULL,
    is_internal boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: insurance_plans; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.insurance_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    payer_id character varying(50),
    plan_type character varying(50),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: intake_sessions; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.intake_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    status character varying(20) DEFAULT 'IN_PROGRESS'::character varying NOT NULL,
    resume_code_hash text,
    expires_at timestamp with time zone NOT NULL,
    patient_id uuid,
    prefill_json jsonb,
    data_json jsonb DEFAULT '{}'::jsonb,
    signature_json jsonb DEFAULT '{}'::jsonb,
    review_notes jsonb DEFAULT '[]'::jsonb,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    patient_first_name text,
    patient_last_name text,
    patient_last_name_normalized text,
    patient_dob date,
    patient_phone_normalized text,
    patient_phone_last4 text,
    ip_address inet,
    user_agent text
);


--
-- Name: intake_settings; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.intake_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    category character varying(50) DEFAULT 'general'::character varying,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid
);


--
-- Name: lab_reference_ranges; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.lab_reference_ranges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_name character varying(255) NOT NULL,
    test_code character varying(50),
    age_min integer,
    age_max integer,
    sex character varying(10),
    normal_min numeric(10,2),
    normal_max numeric(10,2),
    units character varying(50),
    critical_low numeric(10,2),
    critical_high numeric(10,2),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: locations; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    npi character varying(10),
    pos_code character varying(10) DEFAULT '11'::character varying,
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(50),
    zip character varying(20),
    phone character varying(20),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: medication_database; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.medication_database (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rxcui character varying(20),
    name character varying(500) NOT NULL,
    synonym character varying(500),
    tty character varying(50),
    strength character varying(100),
    form character varying(100),
    route character varying(100),
    ndc character varying(20),
    fda_drug_code character varying(20),
    controlled_substance boolean DEFAULT false,
    schedule character varying(10),
    drug_class character varying(255),
    drug_category character varying(255),
    fda_approved boolean DEFAULT true,
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, (((((((COALESCE(name, ''::character varying))::text || ' '::text) || (COALESCE(synonym, ''::character varying))::text) || ' '::text) || (COALESCE(strength, ''::character varying))::text) || ' '::text) || (COALESCE(form, ''::character varying))::text))) STORED
);


--
-- Name: medications; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.medications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    medication_name character varying(255) NOT NULL,
    dosage character varying(100),
    frequency character varying(100),
    route character varying(50),
    start_date date,
    end_date date,
    active boolean DEFAULT true,
    status character varying(50) DEFAULT 'active'::character varying,
    instructions text,
    notes text,
    clinic_id uuid,
    prescriber_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: messages; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    from_user_id uuid NOT NULL,
    to_user_id uuid,
    subject character varying(255),
    body text NOT NULL,
    message_type character varying(50) DEFAULT 'message'::character varying,
    task_status character varying(50) DEFAULT 'open'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['message'::character varying, 'task'::character varying])::text[]))),
    CONSTRAINT messages_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT messages_task_status_check CHECK (((task_status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: order_sets; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.order_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    items jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    clinic_id uuid,
    is_public boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: orders; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    visit_id uuid,
    order_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    ordered_by uuid NOT NULL,
    order_payload jsonb,
    external_order_id character varying(255),
    test_name character varying(255),
    test_code character varying(50),
    result_value text,
    result_units character varying(50),
    reference_range character varying(100),
    abnormal_flags character varying(10),
    completed_at timestamp without time zone,
    external_id character varying(255),
    reviewed boolean DEFAULT false,
    reviewed_at timestamp without time zone,
    reviewed_by uuid,
    comment text,
    comments jsonb DEFAULT '[]'::jsonb,
    clinic_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT orders_order_type_check CHECK (((order_type)::text = ANY ((ARRAY['lab'::character varying, 'imaging'::character varying, 'rx'::character varying, 'referral'::character varying])::text[]))),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: organizations; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    tax_id character varying(50),
    npi character varying(10),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(50),
    zip character varying(20),
    phone character varying(20),
    email character varying(255),
    billing_contact_name character varying(255),
    billing_contact_phone character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_flag_acknowledgments; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.patient_flag_acknowledgments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    patient_flag_id uuid NOT NULL,
    user_id uuid NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_flags; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.patient_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    flag_type_id uuid,
    note text,
    status text DEFAULT 'active'::text NOT NULL,
    created_by_user_id uuid,
    resolved_by_user_id uuid,
    expires_at timestamp with time zone,
    resolved_at timestamp with time zone,
    visibility text DEFAULT 'staff_only'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    custom_label text,
    custom_severity text,
    custom_color text,
    CONSTRAINT patient_flags_custom_severity_check CHECK ((custom_severity = ANY (ARRAY['info'::text, 'warn'::text, 'critical'::text]))),
    CONSTRAINT patient_flags_status_check CHECK ((status = ANY (ARRAY['active'::text, 'resolved'::text, 'expired'::text])))
);


--
-- Name: patient_portal_accounts; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.patient_portal_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    status character varying(20) DEFAULT 'invited'::character varying,
    last_login_at timestamp without time zone,
    mfa_enabled boolean DEFAULT false,
    mfa_secret_encrypted text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_portal_accounts_status_check CHECK (((status)::text = ANY ((ARRAY['invited'::character varying, 'active'::character varying, 'locked'::character varying])::text[])))
);


--
-- Name: patient_portal_audit_log; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.patient_portal_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    patient_id uuid,
    action character varying(100) NOT NULL,
    resource_type character varying(50),
    resource_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_portal_invites; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.patient_portal_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_by_user_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_portal_password_resets; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.patient_portal_password_resets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_portal_permissions; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.patient_portal_permissions (
    account_id uuid NOT NULL,
    can_view_notes boolean DEFAULT true,
    can_view_labs boolean DEFAULT true,
    can_view_documents boolean DEFAULT true,
    can_message boolean DEFAULT true,
    can_request_appointments boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patients; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mrn character varying(50) NOT NULL,
    first_name text NOT NULL,
    middle_name text,
    last_name text NOT NULL,
    preferred_name text,
    name_prefix character varying(50),
    name_suffix text,
    previous_name character varying(255),
    dob date NOT NULL,
    date_of_birth date,
    sex character varying(10),
    gender character varying(50),
    ssn_encrypted text,
    phone text,
    phone_cell text,
    phone_home text,
    phone_work text,
    phone_preferred text,
    communication_preference character varying(50),
    phone_secondary text,
    email text,
    email_secondary text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    country text DEFAULT 'United States'::text,
    address_type character varying(50) DEFAULT 'Home'::character varying,
    primary_care_provider uuid,
    interpreter_needed boolean DEFAULT false,
    consent_to_text boolean DEFAULT false,
    consent_to_email boolean DEFAULT false,
    employer_name character varying(255),
    employment_status character varying(100),
    occupation character varying(255),
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relationship character varying(100),
    emergency_contact_address text,
    emergency_contact_2_name character varying(255),
    emergency_contact_2_phone text,
    emergency_contact_2_relationship character varying(100),
    insurance_provider character varying(255),
    insurance_id text,
    insurance_group_number character varying(100),
    insurance_member_id character varying(100),
    insurance_plan_name character varying(255),
    insurance_plan_type character varying(100),
    insurance_subscriber_name text,
    insurance_subscriber_dob date,
    insurance_subscriber_relationship character varying(100),
    insurance_copay character varying(100),
    insurance_effective_date date,
    insurance_expiry_date date,
    insurance_notes text,
    pharmacy_name character varying(255),
    pharmacy_address text,
    pharmacy_phone text,
    pharmacy_npi text,
    pharmacy_fax text,
    pharmacy_preferred boolean DEFAULT false,
    photo_url text,
    preferred_language character varying(50),
    ethnicity character varying(100),
    race character varying(100),
    marital_status character varying(50),
    referral_source character varying(255),
    allergies_known boolean DEFAULT false,
    notes text,
    clinic_id uuid,
    encryption_metadata jsonb,
    deceased boolean DEFAULT false,
    deceased_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone_normalized text,
    is_restricted boolean DEFAULT false,
    restriction_reason text,
    restricted_by_user_id uuid,
    restricted_at timestamp with time zone,
    photo_document_id uuid,
    CONSTRAINT patients_sex_check CHECK (((sex)::text = ANY ((ARRAY['M'::character varying, 'F'::character varying, 'Other'::character varying])::text[])))
);


--
-- Name: payer_policies; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.payer_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payer_name character varying(255) NOT NULL,
    payer_id character varying(50),
    plan_type character varying(50),
    address_line1 character varying(255),
    city character varying(100),
    state character varying(50),
    zip character varying(20),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pharmacies; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.pharmacies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ncpdp_id character varying(10),
    npi character varying(10),
    name character varying(255) NOT NULL,
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(50),
    zip character varying(20),
    latitude numeric(10,8),
    longitude numeric(11,8),
    pharmacy_type character varying(50),
    active boolean DEFAULT true,
    integration_enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: portal_appointment_requests; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.portal_appointment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    preferred_date date,
    preferred_time text,
    reason text,
    status text DEFAULT 'pending'::text,
    staff_notes text,
    processed_by uuid,
    processed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    portal_account_id uuid,
    preferred_time_range character varying(50),
    appointment_type character varying(50),
    provider_id uuid,
    suggested_slots jsonb,
    CONSTRAINT portal_appointment_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'pending_patient'::text, 'approved'::text, 'denied'::text, 'cancelled'::text, 'completed'::text])))
);


--
-- Name: portal_message_threads; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.portal_message_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'open'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_message_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_user_id uuid,
    CONSTRAINT portal_message_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: portal_messages; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.portal_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    sender_type text NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sender_portal_account_id uuid,
    sender_user_id uuid,
    CONSTRAINT portal_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['patient'::text, 'staff'::text])))
);


--
-- Name: practice_settings; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.practice_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_name character varying(255),
    practice_type character varying(100),
    tax_id character varying(50),
    npi character varying(20),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(50),
    zip character varying(20),
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    website character varying(255),
    logo_url text DEFAULT 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200'' viewBox=''0 0 200 200''%3E%3Crect width=''200'' height=''200'' fill=''%23f8fafc'' rx=''8''/%3E%3Crect x=''60'' y=''45'' width=''80'' height=''90'' fill=''none'' stroke=''%23cbd5e1'' stroke-width=''3'' rx=''4''/%3E%3Crect x=''75'' y=''60'' width=''20'' height=''15'' fill=''%23cbd5e1'' rx=''2''/%3E%3Crect x=''105'' y=''60'' width=''20'' height=''15'' fill=''%23cbd5e1'' rx=''2''/%3E%3Crect x=''75'' y=''85'' width=''20'' height=''15'' fill=''%23cbd5e1'' rx=''2''/%3E%3Crect x=''105'' y=''85'' width=''20'' height=''15'' fill=''%23cbd5e1'' rx=''2''/%3E%3Crect x=''88'' y=''110'' width=''24'' height=''25'' fill=''%23cbd5e1'' rx=''2''/%3E%3Ctext x=''100'' y=''165'' text-anchor=''middle'' font-family=''Arial,sans-serif'' font-size=''14'' font-weight=''600'' fill=''%2394a3b8''%3ENO LOGO%3C/text%3E%3C/svg%3E'::text,
    timezone character varying(50) DEFAULT 'America/New_York'::character varying,
    date_format character varying(20) DEFAULT 'MM/DD/YYYY'::character varying,
    time_format character varying(10) DEFAULT '12h'::character varying,
    default_price_level character varying(20) DEFAULT 'Standard'::character varying,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: prescription_interactions; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.prescription_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prescription_id uuid NOT NULL,
    interaction_type character varying(50),
    severity character varying(50),
    description text,
    medication_name character varying(500),
    medication_rxcui character varying(20),
    detected_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: prescriptions; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    visit_id uuid,
    prescriber_id uuid NOT NULL,
    prescriber_npi character varying(10),
    prescriber_dea character varying(20),
    medication_rxcui character varying(20),
    medication_name character varying(500) NOT NULL,
    medication_ndc character varying(20),
    strength character varying(100),
    quantity integer NOT NULL,
    quantity_unit character varying(20) DEFAULT 'EA'::character varying,
    days_supply integer,
    sig text NOT NULL,
    sig_structured jsonb,
    refills integer DEFAULT 0,
    refills_remaining integer DEFAULT 0,
    substitution_allowed boolean DEFAULT true,
    pharmacy_id uuid,
    pharmacy_ncpdp_id character varying(10),
    pharmacy_name character varying(255),
    pharmacy_address text,
    pharmacy_phone character varying(20),
    status character varying(50) DEFAULT 'draft'::character varying,
    transmission_method character varying(50),
    transmission_id character varying(100),
    transmission_status character varying(50),
    transmission_error text,
    sent_at timestamp with time zone,
    received_at timestamp with time zone,
    filled_at timestamp with time zone,
    prior_auth_required boolean DEFAULT false,
    prior_auth_number character varying(100),
    prior_auth_status character varying(50),
    clinical_notes text,
    patient_instructions text,
    prescriber_notes text,
    is_controlled boolean DEFAULT false,
    schedule character varying(10),
    written_date date DEFAULT CURRENT_DATE NOT NULL,
    start_date date,
    end_date date,
    expires_date date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid NOT NULL,
    CONSTRAINT prescriptions_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'sent'::character varying, 'accepted'::character varying, 'in_process'::character varying, 'ready'::character varying, 'picked_up'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'denied'::character varying])::text[])))
);


--
-- Name: privacy_alerts; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.privacy_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    severity character varying(20) NOT NULL,
    alert_type character varying(50) NOT NULL,
    user_id uuid,
    patient_id uuid,
    details_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp with time zone,
    resolved_by_user_id uuid
);


--
-- Name: privileges; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.privileges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    category character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: problems; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.problems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    problem_name character varying(255) NOT NULL,
    icd10_code character varying(20),
    onset_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT problems_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'resolved'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: referrals; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    visit_id uuid,
    created_by uuid NOT NULL,
    recipient_name character varying(255),
    recipient_specialty character varying(100),
    recipient_address text,
    reason text NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    referral_letter text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT referrals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: role_privileges; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.role_privileges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    privilege_id uuid NOT NULL,
    granted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    granted_by uuid
);


--
-- Name: roles; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system_role boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_template_id uuid
);


--
-- Name: security_settings; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.security_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    password_min_length integer DEFAULT 8,
    password_require_uppercase boolean DEFAULT true,
    password_require_lowercase boolean DEFAULT true,
    password_require_number boolean DEFAULT true,
    password_require_special boolean DEFAULT true,
    session_timeout_minutes integer DEFAULT 30,
    max_login_attempts integer DEFAULT 5,
    lockout_duration_minutes integer DEFAULT 15,
    require_2fa boolean DEFAULT false,
    require_2fa_for_admin boolean DEFAULT false,
    inactivity_timeout_minutes integer DEFAULT 15,
    audit_log_retention_days integer DEFAULT 365,
    ip_whitelist text,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sessions; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: settings; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.settings (
    id integer NOT NULL,
    key character varying(255) NOT NULL,
    value text,
    description text,
    category character varying(100),
    is_public boolean DEFAULT false,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: tenant_sandbox; Owner: -
--

CREATE SEQUENCE tenant_sandbox.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_sandbox; Owner: -
--

ALTER SEQUENCE tenant_sandbox.settings_id_seq OWNED BY tenant_sandbox.settings.id;


--
-- Name: social_history; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.social_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    smoking_status character varying(50),
    smoking_pack_years numeric(5,2),
    alcohol_use character varying(50),
    alcohol_quantity character varying(100),
    drug_use character varying(50),
    exercise_frequency character varying(100),
    diet character varying(100),
    occupation character varying(255),
    living_situation character varying(255),
    marital_status character varying(50),
    education_level character varying(100),
    employment_status character varying(100),
    physical_activity character varying(255),
    diet_notes text,
    sleep_hours_per_night integer,
    caffeine_use character varying(255),
    stress_level character varying(50),
    social_support text,
    travel_history text,
    pets text,
    hobbies text,
    safety_concerns text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: superbill_audit_logs; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.superbill_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    superbill_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    changes jsonb,
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: superbill_diagnoses; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.superbill_diagnoses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    superbill_id uuid NOT NULL,
    icd10_code character varying(20) NOT NULL,
    description text,
    sequence integer NOT NULL,
    source character varying(50) DEFAULT 'MANUAL'::character varying,
    present_on_admission boolean,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: superbill_lines; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.superbill_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    superbill_id uuid NOT NULL,
    cpt_code character varying(10) NOT NULL,
    description text,
    modifier1 character varying(5),
    modifier2 character varying(5),
    modifier3 character varying(5),
    modifier4 character varying(5),
    units integer DEFAULT 1 NOT NULL,
    charge numeric(12,2) DEFAULT 0.00 NOT NULL,
    diagnosis_pointers character varying(50),
    ndc_code character varying(20),
    drug_unit character varying(10),
    drug_quantity numeric(10,3),
    service_date date,
    place_of_service_override character varying(10),
    rendering_provider_id_override uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: superbill_payments_summary; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.superbill_payments_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    superbill_id uuid NOT NULL,
    patient_paid numeric(12,2) DEFAULT 0.00,
    insurance_paid numeric(12,2) DEFAULT 0.00,
    adjustment numeric(12,2) DEFAULT 0.00,
    balance_due numeric(12,2) DEFAULT 0.00,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: superbill_suggested_lines; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.superbill_suggested_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    superbill_id uuid NOT NULL,
    source character varying(50) NOT NULL,
    source_id uuid,
    cpt_code character varying(10) NOT NULL,
    description text,
    modifier1 character varying(5),
    modifier2 character varying(5),
    units integer DEFAULT 1,
    charge numeric(12,2) DEFAULT 0.00,
    diagnosis_pointers character varying(50),
    service_date date,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: superbills; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.superbills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    visit_id uuid NOT NULL,
    note_id uuid,
    status tenant_sandbox.superbill_status DEFAULT 'DRAFT'::tenant_sandbox.superbill_status,
    version integer DEFAULT 1,
    service_date_from date NOT NULL,
    service_date_to date NOT NULL,
    place_of_service character varying(10) DEFAULT '11'::character varying NOT NULL,
    claim_frequency_code character varying(1) DEFAULT '1'::character varying,
    referring_provider_id uuid,
    rendering_provider_id uuid NOT NULL,
    billing_provider_id uuid NOT NULL,
    facility_location_id uuid,
    insurance_policy_id uuid,
    insurance_provider_override character varying(255),
    insurance_id_override character varying(100),
    authorization_number character varying(100),
    billing_notes text,
    denial_reason text,
    resubmission_count integer DEFAULT 0,
    claim_status character varying(20),
    accident_related_employment boolean DEFAULT false,
    accident_related_auto boolean DEFAULT false,
    accident_related_other boolean DEFAULT false,
    accident_state character varying(2),
    accident_date date,
    total_charges numeric(12,2) DEFAULT 0.00,
    total_units integer DEFAULT 0,
    paid_amount numeric(10,2),
    finalized_at timestamp without time zone,
    finalized_by uuid,
    voided_at timestamp without time zone,
    voided_by uuid,
    void_reason text,
    ready_at timestamp without time zone,
    ready_by uuid,
    previous_version_id uuid,
    revision_reason text,
    submitted_at timestamp without time zone,
    paid_at timestamp without time zone,
    created_by uuid NOT NULL,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT superbills_claim_status_check CHECK (((claim_status)::text = ANY ((ARRAY['PENDING'::character varying, 'SUBMITTED'::character varying, 'PAID'::character varying, 'DENIED'::character varying, 'ADJUSTED'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    role character varying(50),
    role_id uuid,
    is_admin boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    active boolean DEFAULT true,
    last_login timestamp without time zone,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    professional_type character varying(50),
    npi character varying(10),
    license_number character varying(100),
    license_state character varying(2),
    dea_number character varying(20),
    taxonomy_code character varying(10),
    credentials character varying(50),
    phone character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: visits; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    visit_date timestamp without time zone NOT NULL,
    visit_type character varying(50),
    provider_id uuid NOT NULL,
    vitals jsonb,
    note_draft text,
    note_signed_by uuid,
    note_signed_at timestamp without time zone,
    addendums jsonb,
    locked boolean DEFAULT false,
    status character varying(50) DEFAULT 'draft'::character varying,
    encounter_date date,
    note_type character varying(100),
    clinic_id uuid,
    last_level_billed integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: x12_partners; Type: TABLE; Schema: tenant_sandbox; Owner: -
--

CREATE TABLE tenant_sandbox.x12_partners (
    id integer NOT NULL,
    name character varying(255),
    id_number character varying(255),
    x12_sender_id character varying(255),
    x12_receiver_id character varying(255),
    processing_format character varying(50),
    x12_isa01 character varying(2) DEFAULT '00'::character varying,
    x12_isa02 character varying(10) DEFAULT '          '::character varying,
    x12_isa03 character varying(2) DEFAULT '00'::character varying,
    x12_isa04 character varying(10) DEFAULT '          '::character varying,
    x12_isa05 character(2) DEFAULT 'ZZ'::bpchar,
    x12_isa07 character(2) DEFAULT 'ZZ'::bpchar,
    x12_isa14 character(1) DEFAULT '0'::bpchar,
    x12_isa15 character(1) DEFAULT 'P'::bpchar,
    x12_gs02 character varying(15),
    x12_gs03 character varying(15),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: x12_partners_id_seq; Type: SEQUENCE; Schema: tenant_sandbox; Owner: -
--

CREATE SEQUENCE tenant_sandbox.x12_partners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: x12_partners_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_sandbox; Owner: -
--

ALTER SEQUENCE tenant_sandbox.x12_partners_id_seq OWNED BY tenant_sandbox.x12_partners.id;


--
-- Name: settings id; Type: DEFAULT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.settings ALTER COLUMN id SET DEFAULT nextval('tenant_sandbox.settings_id_seq'::regclass);


--
-- Name: x12_partners id; Type: DEFAULT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.x12_partners ALTER COLUMN id SET DEFAULT nextval('tenant_sandbox.x12_partners_id_seq'::regclass);


--
-- Name: allergies allergies_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.allergies
    ADD CONSTRAINT allergies_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: ar_activity ar_activity_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_activity
    ADD CONSTRAINT ar_activity_pkey PRIMARY KEY (id);


--
-- Name: ar_session ar_session_idempotency_key_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_session
    ADD CONSTRAINT ar_session_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: ar_session ar_session_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_session
    ADD CONSTRAINT ar_session_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: billing_event_log billing_event_log_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing_event_log
    ADD CONSTRAINT billing_event_log_pkey PRIMARY KEY (id);


--
-- Name: billing_modifiers billing_modifiers_code_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing_modifiers
    ADD CONSTRAINT billing_modifiers_code_key UNIQUE (code);


--
-- Name: billing_modifiers billing_modifiers_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing_modifiers
    ADD CONSTRAINT billing_modifiers_pkey PRIMARY KEY (id);


--
-- Name: billing billing_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing
    ADD CONSTRAINT billing_pkey PRIMARY KEY (id);


--
-- Name: break_glass_sessions break_glass_sessions_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.break_glass_sessions
    ADD CONSTRAINT break_glass_sessions_pkey PRIMARY KEY (id);


--
-- Name: cancellation_followup_notes cancellation_followup_notes_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.cancellation_followup_notes
    ADD CONSTRAINT cancellation_followup_notes_pkey PRIMARY KEY (id);


--
-- Name: cancellation_followups cancellation_followups_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.cancellation_followups
    ADD CONSTRAINT cancellation_followups_pkey PRIMARY KEY (id);


--
-- Name: chart_access_logs chart_access_logs_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.chart_access_logs
    ADD CONSTRAINT chart_access_logs_pkey PRIMARY KEY (id);


--
-- Name: claims claims_patient_id_encounter_id_version_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.claims
    ADD CONSTRAINT claims_patient_id_encounter_id_version_key UNIQUE (patient_id, encounter_id, version);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: clinical_alerts clinical_alerts_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.clinical_alerts
    ADD CONSTRAINT clinical_alerts_pkey PRIMARY KEY (id);


--
-- Name: clinical_settings clinical_settings_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.clinical_settings
    ADD CONSTRAINT clinical_settings_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: drug_inventory drug_inventory_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.drug_inventory
    ADD CONSTRAINT drug_inventory_pkey PRIMARY KEY (id);


--
-- Name: drug_sales drug_sales_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.drug_sales
    ADD CONSTRAINT drug_sales_pkey PRIMARY KEY (id);


--
-- Name: email_settings email_settings_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.email_settings
    ADD CONSTRAINT email_settings_pkey PRIMARY KEY (id);


--
-- Name: encryption_keys encryption_keys_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.encryption_keys
    ADD CONSTRAINT encryption_keys_pkey PRIMARY KEY (id);


--
-- Name: family_history family_history_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.family_history
    ADD CONSTRAINT family_history_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_feature_key_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.feature_flags
    ADD CONSTRAINT feature_flags_feature_key_key UNIQUE (feature_key);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: fee_schedule fee_schedule_code_type_code_price_level_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.fee_schedule
    ADD CONSTRAINT fee_schedule_code_type_code_price_level_key UNIQUE (code_type, code, price_level);


--
-- Name: fee_schedule fee_schedule_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.fee_schedule
    ADD CONSTRAINT fee_schedule_pkey PRIMARY KEY (id);


--
-- Name: fee_sheet_categories fee_sheet_categories_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.fee_sheet_categories
    ADD CONSTRAINT fee_sheet_categories_pkey PRIMARY KEY (id);


--
-- Name: fee_sheet_category_codes fee_sheet_category_codes_category_id_code_type_code_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.fee_sheet_category_codes
    ADD CONSTRAINT fee_sheet_category_codes_category_id_code_type_code_key UNIQUE (category_id, code_type, code);


--
-- Name: fee_sheet_category_codes fee_sheet_category_codes_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.fee_sheet_category_codes
    ADD CONSTRAINT fee_sheet_category_codes_pkey PRIMARY KEY (id);


--
-- Name: flag_types flag_types_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.flag_types
    ADD CONSTRAINT flag_types_pkey PRIMARY KEY (id);


--
-- Name: inbox_items inbox_items_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.inbox_items
    ADD CONSTRAINT inbox_items_pkey PRIMARY KEY (id);


--
-- Name: inbox_notes inbox_notes_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.inbox_notes
    ADD CONSTRAINT inbox_notes_pkey PRIMARY KEY (id);


--
-- Name: insurance_plans insurance_plans_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.insurance_plans
    ADD CONSTRAINT insurance_plans_pkey PRIMARY KEY (id);


--
-- Name: intake_sessions intake_sessions_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.intake_sessions
    ADD CONSTRAINT intake_sessions_pkey PRIMARY KEY (id);


--
-- Name: intake_settings intake_settings_key_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.intake_settings
    ADD CONSTRAINT intake_settings_key_key UNIQUE (key);


--
-- Name: intake_settings intake_settings_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.intake_settings
    ADD CONSTRAINT intake_settings_pkey PRIMARY KEY (id);


--
-- Name: lab_reference_ranges lab_reference_ranges_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.lab_reference_ranges
    ADD CONSTRAINT lab_reference_ranges_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: medication_database medication_database_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.medication_database
    ADD CONSTRAINT medication_database_pkey PRIMARY KEY (id);


--
-- Name: medication_database medication_database_rxcui_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.medication_database
    ADD CONSTRAINT medication_database_rxcui_key UNIQUE (rxcui);


--
-- Name: medications medications_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.medications
    ADD CONSTRAINT medications_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: order_sets order_sets_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.order_sets
    ADD CONSTRAINT order_sets_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: patient_flag_acknowledgments patient_flag_acknowledgments_patient_flag_id_user_id_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flag_acknowledgments
    ADD CONSTRAINT patient_flag_acknowledgments_patient_flag_id_user_id_key UNIQUE (patient_flag_id, user_id);


--
-- Name: patient_flag_acknowledgments patient_flag_acknowledgments_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flag_acknowledgments
    ADD CONSTRAINT patient_flag_acknowledgments_pkey PRIMARY KEY (id);


--
-- Name: patient_flags patient_flags_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flags
    ADD CONSTRAINT patient_flags_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_accounts patient_portal_accounts_email_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_accounts
    ADD CONSTRAINT patient_portal_accounts_email_key UNIQUE (email);


--
-- Name: patient_portal_accounts patient_portal_accounts_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_accounts
    ADD CONSTRAINT patient_portal_accounts_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_audit_log patient_portal_audit_log_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_audit_log
    ADD CONSTRAINT patient_portal_audit_log_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_invites patient_portal_invites_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_invites
    ADD CONSTRAINT patient_portal_invites_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_password_resets patient_portal_password_resets_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_password_resets
    ADD CONSTRAINT patient_portal_password_resets_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_permissions patient_portal_permissions_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_permissions
    ADD CONSTRAINT patient_portal_permissions_pkey PRIMARY KEY (account_id);


--
-- Name: patients patients_mrn_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patients
    ADD CONSTRAINT patients_mrn_key UNIQUE (mrn);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payer_policies payer_policies_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.payer_policies
    ADD CONSTRAINT payer_policies_pkey PRIMARY KEY (id);


--
-- Name: pharmacies pharmacies_ncpdp_id_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.pharmacies
    ADD CONSTRAINT pharmacies_ncpdp_id_key UNIQUE (ncpdp_id);


--
-- Name: pharmacies pharmacies_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.pharmacies
    ADD CONSTRAINT pharmacies_pkey PRIMARY KEY (id);


--
-- Name: portal_appointment_requests portal_appointment_requests_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_appointment_requests
    ADD CONSTRAINT portal_appointment_requests_pkey PRIMARY KEY (id);


--
-- Name: portal_message_threads portal_message_threads_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_message_threads
    ADD CONSTRAINT portal_message_threads_pkey PRIMARY KEY (id);


--
-- Name: portal_messages portal_messages_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_messages
    ADD CONSTRAINT portal_messages_pkey PRIMARY KEY (id);


--
-- Name: practice_settings practice_settings_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.practice_settings
    ADD CONSTRAINT practice_settings_pkey PRIMARY KEY (id);


--
-- Name: prescription_interactions prescription_interactions_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.prescription_interactions
    ADD CONSTRAINT prescription_interactions_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: privacy_alerts privacy_alerts_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.privacy_alerts
    ADD CONSTRAINT privacy_alerts_pkey PRIMARY KEY (id);


--
-- Name: privileges privileges_name_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.privileges
    ADD CONSTRAINT privileges_name_key UNIQUE (name);


--
-- Name: privileges privileges_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.privileges
    ADD CONSTRAINT privileges_pkey PRIMARY KEY (id);


--
-- Name: problems problems_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.problems
    ADD CONSTRAINT problems_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: role_privileges role_privileges_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.role_privileges
    ADD CONSTRAINT role_privileges_pkey PRIMARY KEY (id);


--
-- Name: role_privileges role_privileges_role_id_privilege_id_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.role_privileges
    ADD CONSTRAINT role_privileges_role_id_privilege_id_key UNIQUE (role_id, privilege_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: security_settings security_settings_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.security_settings
    ADD CONSTRAINT security_settings_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: social_history social_history_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.social_history
    ADD CONSTRAINT social_history_pkey PRIMARY KEY (id);


--
-- Name: superbill_audit_logs superbill_audit_logs_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_audit_logs
    ADD CONSTRAINT superbill_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: superbill_diagnoses superbill_diagnoses_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_diagnoses
    ADD CONSTRAINT superbill_diagnoses_pkey PRIMARY KEY (id);


--
-- Name: superbill_diagnoses superbill_diagnoses_superbill_id_icd10_code_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_diagnoses
    ADD CONSTRAINT superbill_diagnoses_superbill_id_icd10_code_key UNIQUE (superbill_id, icd10_code);


--
-- Name: superbill_diagnoses superbill_diagnoses_superbill_id_sequence_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_diagnoses
    ADD CONSTRAINT superbill_diagnoses_superbill_id_sequence_key UNIQUE (superbill_id, sequence);


--
-- Name: superbill_lines superbill_lines_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_lines
    ADD CONSTRAINT superbill_lines_pkey PRIMARY KEY (id);


--
-- Name: superbill_payments_summary superbill_payments_summary_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_payments_summary
    ADD CONSTRAINT superbill_payments_summary_pkey PRIMARY KEY (id);


--
-- Name: superbill_payments_summary superbill_payments_summary_superbill_id_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_payments_summary
    ADD CONSTRAINT superbill_payments_summary_superbill_id_key UNIQUE (superbill_id);


--
-- Name: superbill_suggested_lines superbill_suggested_lines_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_suggested_lines
    ADD CONSTRAINT superbill_suggested_lines_pkey PRIMARY KEY (id);


--
-- Name: superbills superbills_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_pkey PRIMARY KEY (id);


--
-- Name: superbills superbills_visit_id_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_visit_id_key UNIQUE (visit_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: x12_partners x12_partners_pkey; Type: CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.x12_partners
    ADD CONSTRAINT x12_partners_pkey PRIMARY KEY (id);


--
-- Name: idx_ar_activity_encounter; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_ar_activity_encounter ON tenant_sandbox.ar_activity USING btree (pid, encounter);


--
-- Name: idx_audit_events_tenant; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_audit_events_tenant ON tenant_sandbox.audit_events USING btree (tenant_id);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_audit_logs_created ON tenant_sandbox.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_target; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_audit_logs_target ON tenant_sandbox.audit_logs USING btree (target_type, target_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_audit_logs_user ON tenant_sandbox.audit_logs USING btree (user_id);


--
-- Name: idx_audit_superbill; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_audit_superbill ON tenant_sandbox.superbill_audit_logs USING btree (superbill_id);


--
-- Name: idx_bg_sessions_expiry; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_bg_sessions_expiry ON tenant_sandbox.break_glass_sessions USING btree (expires_at);


--
-- Name: idx_bg_sessions_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_bg_sessions_patient ON tenant_sandbox.break_glass_sessions USING btree (patient_id);


--
-- Name: idx_bg_sessions_user; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_bg_sessions_user ON tenant_sandbox.break_glass_sessions USING btree (user_id);


--
-- Name: idx_billing_encounter; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_billing_encounter ON tenant_sandbox.billing USING btree (encounter);


--
-- Name: idx_billing_log_claim; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_billing_log_claim ON tenant_sandbox.billing_event_log USING btree (claim_id);


--
-- Name: idx_billing_log_session; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_billing_log_session ON tenant_sandbox.billing_event_log USING btree (session_id);


--
-- Name: idx_billing_log_visit; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_billing_log_visit ON tenant_sandbox.billing_event_log USING btree (visit_id);


--
-- Name: idx_billing_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_billing_patient ON tenant_sandbox.billing USING btree (pid);


--
-- Name: idx_chart_logs_created; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_chart_logs_created ON tenant_sandbox.chart_access_logs USING btree (created_at);


--
-- Name: idx_chart_logs_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_chart_logs_patient ON tenant_sandbox.chart_access_logs USING btree (patient_id);


--
-- Name: idx_chart_logs_user; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_chart_logs_user ON tenant_sandbox.chart_access_logs USING btree (user_id);


--
-- Name: idx_claims_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_claims_patient ON tenant_sandbox.claims USING btree (patient_id);


--
-- Name: idx_claims_visit; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_claims_visit ON tenant_sandbox.claims USING btree (encounter_id);


--
-- Name: idx_clinical_alerts_active; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_clinical_alerts_active ON tenant_sandbox.clinical_alerts USING btree (active, severity);


--
-- Name: idx_clinical_alerts_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_clinical_alerts_patient ON tenant_sandbox.clinical_alerts USING btree (patient_id);


--
-- Name: idx_documents_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_documents_patient ON tenant_sandbox.documents USING btree (patient_id);


--
-- Name: idx_drug_inventory_drug; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_drug_inventory_drug ON tenant_sandbox.drug_inventory USING btree (drug_id);


--
-- Name: idx_drug_inventory_fifo; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_drug_inventory_fifo ON tenant_sandbox.drug_inventory USING btree (drug_id, expiration, id);


--
-- Name: idx_fee_schedule_code; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_fee_schedule_code ON tenant_sandbox.fee_schedule USING btree (code_type, code);


--
-- Name: idx_fee_sheet_categories_active; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_fee_sheet_categories_active ON tenant_sandbox.fee_sheet_categories USING btree (is_active, display_order);


--
-- Name: idx_fee_sheet_category_codes_category; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_fee_sheet_category_codes_category ON tenant_sandbox.fee_sheet_category_codes USING btree (category_id);


--
-- Name: idx_inbox_assigned_user; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_inbox_assigned_user ON tenant_sandbox.inbox_items USING btree (assigned_user_id) WHERE ((status)::text <> 'completed'::text);


--
-- Name: idx_inbox_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_inbox_patient ON tenant_sandbox.inbox_items USING btree (patient_id);


--
-- Name: idx_inbox_reference; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_inbox_reference ON tenant_sandbox.inbox_items USING btree (reference_id);


--
-- Name: idx_inbox_status; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_inbox_status ON tenant_sandbox.inbox_items USING btree (status);


--
-- Name: idx_intake_sessions_lookup; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_intake_sessions_lookup ON tenant_sandbox.intake_sessions USING btree (patient_last_name_normalized, patient_dob, patient_phone_normalized);


--
-- Name: idx_intake_sessions_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_intake_sessions_patient ON tenant_sandbox.intake_sessions USING btree (patient_id);


--
-- Name: idx_intake_sessions_resume; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_intake_sessions_resume ON tenant_sandbox.intake_sessions USING btree (resume_code_hash);


--
-- Name: idx_intake_sessions_status; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_intake_sessions_status ON tenant_sandbox.intake_sessions USING btree (status);


--
-- Name: idx_interactions_prescription; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_interactions_prescription ON tenant_sandbox.prescription_interactions USING btree (prescription_id);


--
-- Name: idx_medication_rxcui; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_medication_rxcui ON tenant_sandbox.medication_database USING btree (rxcui) WHERE (rxcui IS NOT NULL);


--
-- Name: idx_medication_search; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_medication_search ON tenant_sandbox.medication_database USING gin (search_vector);


--
-- Name: idx_orders_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_orders_patient ON tenant_sandbox.orders USING btree (patient_id);


--
-- Name: idx_patient_flags_clinic; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patient_flags_clinic ON tenant_sandbox.patient_flags USING btree (clinic_id);


--
-- Name: idx_patient_flags_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patient_flags_patient ON tenant_sandbox.patient_flags USING btree (patient_id);


--
-- Name: idx_patients_clinic_dob; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patients_clinic_dob ON tenant_sandbox.patients USING btree (clinic_id, dob);


--
-- Name: idx_patients_clinic_first_name; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patients_clinic_first_name ON tenant_sandbox.patients USING btree (clinic_id, first_name);


--
-- Name: idx_patients_clinic_last_name; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patients_clinic_last_name ON tenant_sandbox.patients USING btree (clinic_id, last_name);


--
-- Name: idx_patients_clinic_mrn; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patients_clinic_mrn ON tenant_sandbox.patients USING btree (clinic_id, mrn);


--
-- Name: idx_patients_clinic_phone_norm; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patients_clinic_phone_norm ON tenant_sandbox.patients USING btree (clinic_id, phone_normalized);


--
-- Name: idx_patients_mrn; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patients_mrn ON tenant_sandbox.patients USING btree (mrn);


--
-- Name: idx_patients_name; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patients_name ON tenant_sandbox.patients USING btree (last_name, first_name);


--
-- Name: idx_patients_name_trgm; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_patients_name_trgm ON tenant_sandbox.patients USING gin ((((first_name || ' '::text) || last_name)) public.gin_trgm_ops);


--
-- Name: idx_pharmacies_location; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_pharmacies_location ON tenant_sandbox.pharmacies USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));


--
-- Name: idx_pharmacies_ncpdp; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_pharmacies_ncpdp ON tenant_sandbox.pharmacies USING btree (ncpdp_id) WHERE (ncpdp_id IS NOT NULL);


--
-- Name: idx_portal_accounts_email_sandbox; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_portal_accounts_email_sandbox ON tenant_sandbox.patient_portal_accounts USING btree (email);


--
-- Name: idx_portal_accounts_email_tenant_sandbox; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_portal_accounts_email_tenant_sandbox ON tenant_sandbox.patient_portal_accounts USING btree (email);


--
-- Name: idx_portal_accounts_patient_sandbox; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_portal_accounts_patient_sandbox ON tenant_sandbox.patient_portal_accounts USING btree (patient_id);


--
-- Name: idx_portal_accounts_patient_tenant_sandbox; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_portal_accounts_patient_tenant_sandbox ON tenant_sandbox.patient_portal_accounts USING btree (patient_id);


--
-- Name: idx_portal_audit_patient_sandbox; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_portal_audit_patient_sandbox ON tenant_sandbox.patient_portal_audit_log USING btree (patient_id);


--
-- Name: idx_portal_audit_patient_tenant_sandbox; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_portal_audit_patient_tenant_sandbox ON tenant_sandbox.patient_portal_audit_log USING btree (patient_id);


--
-- Name: idx_portal_invites_patient_sandbox; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_portal_invites_patient_sandbox ON tenant_sandbox.patient_portal_invites USING btree (patient_id);


--
-- Name: idx_portal_invites_patient_tenant_sandbox; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_portal_invites_patient_tenant_sandbox ON tenant_sandbox.patient_portal_invites USING btree (patient_id);


--
-- Name: idx_prescriptions_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_prescriptions_patient ON tenant_sandbox.prescriptions USING btree (patient_id, created_at DESC);


--
-- Name: idx_prescriptions_prescriber; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_prescriptions_prescriber ON tenant_sandbox.prescriptions USING btree (prescriber_id, created_at DESC);


--
-- Name: idx_prescriptions_status; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_prescriptions_status ON tenant_sandbox.prescriptions USING btree (status, created_at DESC);


--
-- Name: idx_privacy_alerts_severity; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_privacy_alerts_severity ON tenant_sandbox.privacy_alerts USING btree (severity);


--
-- Name: idx_privacy_alerts_unresolved; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_privacy_alerts_unresolved ON tenant_sandbox.privacy_alerts USING btree (created_at) WHERE (resolved_at IS NULL);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_sessions_expires ON tenant_sandbox.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_sessions_user ON tenant_sandbox.sessions USING btree (user_id);


--
-- Name: idx_suggested_lines_superbill; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_suggested_lines_superbill ON tenant_sandbox.superbill_suggested_lines USING btree (superbill_id);


--
-- Name: idx_superbill_diagnoses_superbill; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_superbill_diagnoses_superbill ON tenant_sandbox.superbill_diagnoses USING btree (superbill_id);


--
-- Name: idx_superbill_lines_superbill; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_superbill_lines_superbill ON tenant_sandbox.superbill_lines USING btree (superbill_id);


--
-- Name: idx_superbills_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_superbills_patient ON tenant_sandbox.superbills USING btree (patient_id);


--
-- Name: idx_superbills_status; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_superbills_status ON tenant_sandbox.superbills USING btree (status);


--
-- Name: idx_superbills_visit; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_superbills_visit ON tenant_sandbox.superbills USING btree (visit_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_users_email ON tenant_sandbox.users USING btree (email);


--
-- Name: idx_users_role_id; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_users_role_id ON tenant_sandbox.users USING btree (role_id);


--
-- Name: idx_visits_date; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_visits_date ON tenant_sandbox.visits USING btree (visit_date DESC);


--
-- Name: idx_visits_patient; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE INDEX idx_visits_patient ON tenant_sandbox.visits USING btree (patient_id);


--
-- Name: uniq_ar_session_patient_copay_per_encounter; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE UNIQUE INDEX uniq_ar_session_patient_copay_per_encounter ON tenant_sandbox.ar_session USING btree (encounter) WHERE ((payment_type)::text = 'Patient Payment'::text);


--
-- Name: uniq_billing_encounter_code_once; Type: INDEX; Schema: tenant_sandbox; Owner: -
--

CREATE UNIQUE INDEX uniq_billing_encounter_code_once ON tenant_sandbox.billing USING btree (encounter, code, COALESCE(modifier1, ''::character varying)) WHERE (activity = true);


--
-- Name: intake_sessions trg_intake_sessions_updated_at; Type: TRIGGER; Schema: tenant_sandbox; Owner: -
--

CREATE TRIGGER trg_intake_sessions_updated_at BEFORE UPDATE ON tenant_sandbox.intake_sessions FOR EACH ROW EXECUTE FUNCTION tenant_sandbox.update_updated_at_column();


--
-- Name: allergies allergies_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.allergies
    ADD CONSTRAINT allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.appointments
    ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.appointments
    ADD CONSTRAINT appointments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: ar_activity ar_activity_encounter_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_activity
    ADD CONSTRAINT ar_activity_encounter_fkey FOREIGN KEY (encounter) REFERENCES tenant_sandbox.visits(id) ON DELETE CASCADE;


--
-- Name: ar_activity ar_activity_pid_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_activity
    ADD CONSTRAINT ar_activity_pid_fkey FOREIGN KEY (pid) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: ar_activity ar_activity_post_user_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_activity
    ADD CONSTRAINT ar_activity_post_user_fkey FOREIGN KEY (post_user) REFERENCES tenant_sandbox.users(id);


--
-- Name: ar_activity ar_activity_session_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_activity
    ADD CONSTRAINT ar_activity_session_id_fkey FOREIGN KEY (session_id) REFERENCES tenant_sandbox.ar_session(id);


--
-- Name: ar_session ar_session_encounter_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_session
    ADD CONSTRAINT ar_session_encounter_fkey FOREIGN KEY (encounter) REFERENCES tenant_sandbox.visits(id);


--
-- Name: ar_session ar_session_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_session
    ADD CONSTRAINT ar_session_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id);


--
-- Name: ar_session ar_session_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.ar_session
    ADD CONSTRAINT ar_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: billing billing_encounter_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing
    ADD CONSTRAINT billing_encounter_fkey FOREIGN KEY (encounter) REFERENCES tenant_sandbox.visits(id) ON DELETE CASCADE;


--
-- Name: billing_event_log billing_event_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing_event_log
    ADD CONSTRAINT billing_event_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: billing_event_log billing_event_log_claim_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing_event_log
    ADD CONSTRAINT billing_event_log_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES tenant_sandbox.claims(id);


--
-- Name: billing_event_log billing_event_log_session_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing_event_log
    ADD CONSTRAINT billing_event_log_session_id_fkey FOREIGN KEY (session_id) REFERENCES tenant_sandbox.ar_session(id);


--
-- Name: billing_event_log billing_event_log_visit_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing_event_log
    ADD CONSTRAINT billing_event_log_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES tenant_sandbox.visits(id);


--
-- Name: billing billing_pid_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing
    ADD CONSTRAINT billing_pid_fkey FOREIGN KEY (pid) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: billing billing_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing
    ADD CONSTRAINT billing_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: billing billing_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.billing
    ADD CONSTRAINT billing_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: break_glass_sessions break_glass_sessions_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.break_glass_sessions
    ADD CONSTRAINT break_glass_sessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: break_glass_sessions break_glass_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.break_glass_sessions
    ADD CONSTRAINT break_glass_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id) ON DELETE CASCADE;


--
-- Name: cancellation_followups cancellation_followups_addressed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.cancellation_followups
    ADD CONSTRAINT cancellation_followups_addressed_by_fkey FOREIGN KEY (addressed_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: cancellation_followups cancellation_followups_dismissed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.cancellation_followups
    ADD CONSTRAINT cancellation_followups_dismissed_by_fkey FOREIGN KEY (dismissed_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: cancellation_followups cancellation_followups_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.cancellation_followups
    ADD CONSTRAINT cancellation_followups_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id);


--
-- Name: cancellation_followups cancellation_followups_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.cancellation_followups
    ADD CONSTRAINT cancellation_followups_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: chart_access_logs chart_access_logs_break_glass_session_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.chart_access_logs
    ADD CONSTRAINT chart_access_logs_break_glass_session_id_fkey FOREIGN KEY (break_glass_session_id) REFERENCES tenant_sandbox.break_glass_sessions(id) ON DELETE SET NULL;


--
-- Name: chart_access_logs chart_access_logs_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.chart_access_logs
    ADD CONSTRAINT chart_access_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE SET NULL;


--
-- Name: chart_access_logs chart_access_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.chart_access_logs
    ADD CONSTRAINT chart_access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id) ON DELETE SET NULL;


--
-- Name: claims claims_encounter_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.claims
    ADD CONSTRAINT claims_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES tenant_sandbox.visits(id) ON DELETE CASCADE;


--
-- Name: claims claims_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.claims
    ADD CONSTRAINT claims_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: clinical_alerts clinical_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.clinical_alerts
    ADD CONSTRAINT clinical_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: clinical_alerts clinical_alerts_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.clinical_alerts
    ADD CONSTRAINT clinical_alerts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: documents documents_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.documents
    ADD CONSTRAINT documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: documents documents_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.documents
    ADD CONSTRAINT documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: documents documents_uploader_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.documents
    ADD CONSTRAINT documents_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: documents documents_visit_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.documents
    ADD CONSTRAINT documents_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES tenant_sandbox.visits(id);


--
-- Name: drug_sales drug_sales_encounter_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.drug_sales
    ADD CONSTRAINT drug_sales_encounter_fkey FOREIGN KEY (encounter) REFERENCES tenant_sandbox.visits(id) ON DELETE CASCADE;


--
-- Name: drug_sales drug_sales_pid_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.drug_sales
    ADD CONSTRAINT drug_sales_pid_fkey FOREIGN KEY (pid) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: drug_sales drug_sales_prescription_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.drug_sales
    ADD CONSTRAINT drug_sales_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES tenant_sandbox.prescriptions(id);


--
-- Name: drug_sales drug_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.drug_sales
    ADD CONSTRAINT drug_sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: family_history family_history_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.family_history
    ADD CONSTRAINT family_history_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: fee_sheet_categories fee_sheet_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.fee_sheet_categories
    ADD CONSTRAINT fee_sheet_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: fee_sheet_category_codes fee_sheet_category_codes_category_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.fee_sheet_category_codes
    ADD CONSTRAINT fee_sheet_category_codes_category_id_fkey FOREIGN KEY (category_id) REFERENCES tenant_sandbox.fee_sheet_categories(id) ON DELETE CASCADE;


--
-- Name: flag_types flag_types_clinic_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.flag_types
    ADD CONSTRAINT flag_types_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: inbox_items inbox_items_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.inbox_items
    ADD CONSTRAINT inbox_items_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: inbox_items inbox_items_completed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.inbox_items
    ADD CONSTRAINT inbox_items_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: inbox_items inbox_items_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.inbox_items
    ADD CONSTRAINT inbox_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: inbox_items inbox_items_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.inbox_items
    ADD CONSTRAINT inbox_items_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id);


--
-- Name: inbox_notes inbox_notes_item_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.inbox_notes
    ADD CONSTRAINT inbox_notes_item_id_fkey FOREIGN KEY (item_id) REFERENCES tenant_sandbox.inbox_items(id) ON DELETE CASCADE;


--
-- Name: inbox_notes inbox_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.inbox_notes
    ADD CONSTRAINT inbox_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: locations locations_organization_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.locations
    ADD CONSTRAINT locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES tenant_sandbox.organizations(id);


--
-- Name: medications medications_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.medications
    ADD CONSTRAINT medications_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: medications medications_prescriber_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.medications
    ADD CONSTRAINT medications_prescriber_id_fkey FOREIGN KEY (prescriber_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: messages messages_from_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.messages
    ADD CONSTRAINT messages_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: messages messages_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.messages
    ADD CONSTRAINT messages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: messages messages_to_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.messages
    ADD CONSTRAINT messages_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: orders orders_ordered_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.orders
    ADD CONSTRAINT orders_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: orders orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.orders
    ADD CONSTRAINT orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: orders orders_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.orders
    ADD CONSTRAINT orders_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: orders orders_visit_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.orders
    ADD CONSTRAINT orders_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES tenant_sandbox.visits(id);


--
-- Name: patient_flag_acknowledgments patient_flag_acknowledgments_clinic_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flag_acknowledgments
    ADD CONSTRAINT patient_flag_acknowledgments_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: patient_flag_acknowledgments patient_flag_acknowledgments_patient_flag_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flag_acknowledgments
    ADD CONSTRAINT patient_flag_acknowledgments_patient_flag_id_fkey FOREIGN KEY (patient_flag_id) REFERENCES tenant_sandbox.patient_flags(id) ON DELETE CASCADE;


--
-- Name: patient_flag_acknowledgments patient_flag_acknowledgments_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flag_acknowledgments
    ADD CONSTRAINT patient_flag_acknowledgments_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id) ON DELETE CASCADE;


--
-- Name: patient_flags patient_flags_clinic_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flags
    ADD CONSTRAINT patient_flags_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: patient_flags patient_flags_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flags
    ADD CONSTRAINT patient_flags_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES tenant_sandbox.users(id) ON DELETE SET NULL;


--
-- Name: patient_flags patient_flags_flag_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flags
    ADD CONSTRAINT patient_flags_flag_type_id_fkey FOREIGN KEY (flag_type_id) REFERENCES tenant_sandbox.flag_types(id) ON DELETE CASCADE;


--
-- Name: patient_flags patient_flags_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flags
    ADD CONSTRAINT patient_flags_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: patient_flags patient_flags_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_flags
    ADD CONSTRAINT patient_flags_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES tenant_sandbox.users(id) ON DELETE SET NULL;


--
-- Name: patient_portal_accounts patient_portal_accounts_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_accounts
    ADD CONSTRAINT patient_portal_accounts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: patient_portal_audit_log patient_portal_audit_log_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_audit_log
    ADD CONSTRAINT patient_portal_audit_log_account_id_fkey FOREIGN KEY (account_id) REFERENCES tenant_sandbox.patient_portal_accounts(id) ON DELETE SET NULL;


--
-- Name: patient_portal_audit_log patient_portal_audit_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_audit_log
    ADD CONSTRAINT patient_portal_audit_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: patient_portal_invites patient_portal_invites_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_invites
    ADD CONSTRAINT patient_portal_invites_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: patient_portal_invites patient_portal_invites_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_invites
    ADD CONSTRAINT patient_portal_invites_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: patient_portal_permissions patient_portal_permissions_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patient_portal_permissions
    ADD CONSTRAINT patient_portal_permissions_account_id_fkey FOREIGN KEY (account_id) REFERENCES tenant_sandbox.patient_portal_accounts(id) ON DELETE CASCADE;


--
-- Name: patients patients_photo_document_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patients
    ADD CONSTRAINT patients_photo_document_id_fkey FOREIGN KEY (photo_document_id) REFERENCES tenant_sandbox.documents(id) ON DELETE SET NULL;


--
-- Name: patients patients_primary_care_provider_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patients
    ADD CONSTRAINT patients_primary_care_provider_fkey FOREIGN KEY (primary_care_provider) REFERENCES tenant_sandbox.users(id);


--
-- Name: patients patients_restricted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.patients
    ADD CONSTRAINT patients_restricted_by_user_id_fkey FOREIGN KEY (restricted_by_user_id) REFERENCES tenant_sandbox.users(id) ON DELETE SET NULL;


--
-- Name: portal_appointment_requests portal_appointment_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_appointment_requests
    ADD CONSTRAINT portal_appointment_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id);


--
-- Name: portal_appointment_requests portal_appointment_requests_portal_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_appointment_requests
    ADD CONSTRAINT portal_appointment_requests_portal_account_id_fkey FOREIGN KEY (portal_account_id) REFERENCES tenant_sandbox.patient_portal_accounts(id) ON DELETE CASCADE;


--
-- Name: portal_appointment_requests portal_appointment_requests_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_appointment_requests
    ADD CONSTRAINT portal_appointment_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: portal_message_threads portal_message_threads_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_message_threads
    ADD CONSTRAINT portal_message_threads_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: portal_message_threads portal_message_threads_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_message_threads
    ADD CONSTRAINT portal_message_threads_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id);


--
-- Name: portal_messages portal_messages_sender_portal_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_messages
    ADD CONSTRAINT portal_messages_sender_portal_account_id_fkey FOREIGN KEY (sender_portal_account_id) REFERENCES tenant_sandbox.patient_portal_accounts(id);


--
-- Name: portal_messages portal_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_messages
    ADD CONSTRAINT portal_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: portal_messages portal_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.portal_messages
    ADD CONSTRAINT portal_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES tenant_sandbox.portal_message_threads(id);


--
-- Name: prescription_interactions prescription_interactions_prescription_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.prescription_interactions
    ADD CONSTRAINT prescription_interactions_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES tenant_sandbox.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.prescriptions
    ADD CONSTRAINT prescriptions_created_by_fkey FOREIGN KEY (created_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.prescriptions
    ADD CONSTRAINT prescriptions_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES tenant_sandbox.pharmacies(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_prescriber_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.prescriptions
    ADD CONSTRAINT prescriptions_prescriber_id_fkey FOREIGN KEY (prescriber_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: prescriptions prescriptions_visit_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.prescriptions
    ADD CONSTRAINT prescriptions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES tenant_sandbox.visits(id) ON DELETE SET NULL;


--
-- Name: privacy_alerts privacy_alerts_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.privacy_alerts
    ADD CONSTRAINT privacy_alerts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE SET NULL;


--
-- Name: privacy_alerts privacy_alerts_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.privacy_alerts
    ADD CONSTRAINT privacy_alerts_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES tenant_sandbox.users(id) ON DELETE SET NULL;


--
-- Name: privacy_alerts privacy_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.privacy_alerts
    ADD CONSTRAINT privacy_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id) ON DELETE SET NULL;


--
-- Name: problems problems_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.problems
    ADD CONSTRAINT problems_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.referrals
    ADD CONSTRAINT referrals_created_by_fkey FOREIGN KEY (created_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: referrals referrals_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.referrals
    ADD CONSTRAINT referrals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_visit_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.referrals
    ADD CONSTRAINT referrals_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES tenant_sandbox.visits(id);


--
-- Name: role_privileges role_privileges_privilege_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.role_privileges
    ADD CONSTRAINT role_privileges_privilege_id_fkey FOREIGN KEY (privilege_id) REFERENCES tenant_sandbox.privileges(id) ON DELETE CASCADE;


--
-- Name: role_privileges role_privileges_role_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.role_privileges
    ADD CONSTRAINT role_privileges_role_id_fkey FOREIGN KEY (role_id) REFERENCES tenant_sandbox.roles(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id) ON DELETE CASCADE;


--
-- Name: social_history social_history_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.social_history
    ADD CONSTRAINT social_history_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: superbill_audit_logs superbill_audit_logs_superbill_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_audit_logs
    ADD CONSTRAINT superbill_audit_logs_superbill_id_fkey FOREIGN KEY (superbill_id) REFERENCES tenant_sandbox.superbills(id) ON DELETE CASCADE;


--
-- Name: superbill_audit_logs superbill_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_audit_logs
    ADD CONSTRAINT superbill_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbill_diagnoses superbill_diagnoses_superbill_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_diagnoses
    ADD CONSTRAINT superbill_diagnoses_superbill_id_fkey FOREIGN KEY (superbill_id) REFERENCES tenant_sandbox.superbills(id) ON DELETE CASCADE;


--
-- Name: superbill_lines superbill_lines_rendering_provider_id_override_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_lines
    ADD CONSTRAINT superbill_lines_rendering_provider_id_override_fkey FOREIGN KEY (rendering_provider_id_override) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbill_lines superbill_lines_superbill_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_lines
    ADD CONSTRAINT superbill_lines_superbill_id_fkey FOREIGN KEY (superbill_id) REFERENCES tenant_sandbox.superbills(id) ON DELETE CASCADE;


--
-- Name: superbill_payments_summary superbill_payments_summary_superbill_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_payments_summary
    ADD CONSTRAINT superbill_payments_summary_superbill_id_fkey FOREIGN KEY (superbill_id) REFERENCES tenant_sandbox.superbills(id) ON DELETE CASCADE;


--
-- Name: superbill_suggested_lines superbill_suggested_lines_superbill_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbill_suggested_lines
    ADD CONSTRAINT superbill_suggested_lines_superbill_id_fkey FOREIGN KEY (superbill_id) REFERENCES tenant_sandbox.superbills(id) ON DELETE CASCADE;


--
-- Name: superbills superbills_billing_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_billing_provider_id_fkey FOREIGN KEY (billing_provider_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbills superbills_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_created_by_fkey FOREIGN KEY (created_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbills superbills_facility_location_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_facility_location_id_fkey FOREIGN KEY (facility_location_id) REFERENCES tenant_sandbox.locations(id);


--
-- Name: superbills superbills_finalized_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_finalized_by_fkey FOREIGN KEY (finalized_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbills superbills_insurance_policy_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_insurance_policy_id_fkey FOREIGN KEY (insurance_policy_id) REFERENCES tenant_sandbox.payer_policies(id);


--
-- Name: superbills superbills_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: superbills superbills_previous_version_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_previous_version_id_fkey FOREIGN KEY (previous_version_id) REFERENCES tenant_sandbox.superbills(id);


--
-- Name: superbills superbills_ready_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_ready_by_fkey FOREIGN KEY (ready_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbills superbills_referring_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_referring_provider_id_fkey FOREIGN KEY (referring_provider_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbills superbills_rendering_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_rendering_provider_id_fkey FOREIGN KEY (rendering_provider_id) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbills superbills_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: superbills superbills_visit_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES tenant_sandbox.visits(id) ON DELETE CASCADE;


--
-- Name: superbills superbills_voided_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.superbills
    ADD CONSTRAINT superbills_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES tenant_sandbox.roles(id);


--
-- Name: visits visits_note_signed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.visits
    ADD CONSTRAINT visits_note_signed_by_fkey FOREIGN KEY (note_signed_by) REFERENCES tenant_sandbox.users(id);


--
-- Name: visits visits_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.visits
    ADD CONSTRAINT visits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_sandbox.patients(id) ON DELETE CASCADE;


--
-- Name: visits visits_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_sandbox; Owner: -
--

ALTER TABLE ONLY tenant_sandbox.visits
    ADD CONSTRAINT visits_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES tenant_sandbox.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Jf7w9z0bTkp8ufc9djaZfTBH8ens1JlNgYuzRYHrVeQikA6gyzHHHmh91hhtycb

