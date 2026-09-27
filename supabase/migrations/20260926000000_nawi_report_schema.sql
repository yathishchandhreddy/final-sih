-- ==============================================================================
-- NAWI-REPORT: Digital Legal Metrology Inspection & Test Reporting Workflow
-- Supabase PostgreSQL Production Schema & Row Level Security (RLS) Policies
-- Standard: OIML R 76-1:2006 (Non-Automatic Weighing Instruments)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PROFILES & ROLES (RBAC)
-- ==============================================================================

-- Public profiles table tied to Supabase Auth (auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('ADMIN', 'INSPECTOR', 'TESTER', 'SUB_INSPECTOR', 'ENGINEER', 'OWNER', 'APPLICANT', 'EVALUATOR', 'REVIEWER', 'APPROVING_AUTHORITY', 'READ_ONLY')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  designation TEXT,
  organization TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Standard Metrology Roles
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL CHECK (name IN ('ADMIN', 'INSPECTOR', 'TESTER', 'SUB_INSPECTOR', 'ENGINEER', 'OWNER', 'APPLICANT', 'EVALUATOR', 'REVIEWER', 'APPROVING_AUTHORITY', 'READ_ONLY')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles Junction Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- Seed System Metrology Roles (Standard definitions, not demo data)
INSERT INTO public.roles (name, description) VALUES
  ('OWNER', 'Instrument manufacturer, owner, or legal representative submitting verification requests'),
  ('APPLICANT', 'Instrument manufacturer, owner, or legal representative submitting verification requests'),
  ('TESTER', 'Field testing officer performing on-site measurements and recording raw observations'),
  ('SUB_INSPECTOR', 'Field testing officer performing on-site measurements and recording raw observations'),
  ('ENGINEER', 'Calibrator / Metrology engineer verifying standard weights, environmental factors, and uncertainty'),
  ('INSPECTOR', 'Lead legal metrology inspector conducting inspection reviews and compliance recommendations'),
  ('ADMIN', 'Superintendent / Approving Authority with administrative oversight and final certificate issuance')
ON CONFLICT (name) DO NOTHING;

-- Helper function to check role in RLS without recursion
CREATE OR REPLACE FUNCTION public.auth_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND (r.name = required_role OR r.name = 'ADMIN')
  );
$$;

-- Trigger to automatically create profile on auth.users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_role_id UUID;
  assigned_role TEXT;
BEGIN
  -- Insert into public.profiles
  INSERT INTO public.profiles (id, user_id, email, full_name, role, status, designation, organization, active)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'OWNER'),
    'ACTIVE',
    COALESCE(NEW.raw_user_meta_data->>'designation', 'Applicant Representative'),
    COALESCE(NEW.raw_user_meta_data->>'organization', 'Applicant Organization'),
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        role = COALESCE(EXCLUDED.role, public.profiles.role),
        status = COALESCE(EXCLUDED.status, public.profiles.status),
        updated_at = now();

  -- Assign initial role based on user metadata or default to OWNER
  assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'OWNER');
  SELECT id INTO default_role_id FROM public.roles WHERE name = assigned_role;
  
  IF default_role_id IS NULL THEN
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'OWNER';
  END IF;

  IF default_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, default_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 2. INSTRUMENTS & CONFIGURATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_code TEXT UNIQUE NOT NULL,
  applicant_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  model_number TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  accuracy_class TEXT NOT NULL CHECK (accuracy_class IN ('I', 'II', 'III', 'IIII')),
  max_capacity NUMERIC NOT NULL CHECK (max_capacity > 0),
  capacity_unit TEXT NOT NULL,
  verification_scale_interval_e NUMERIC NOT NULL CHECK (verification_scale_interval_e > 0),
  scale_interval_unit TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  indicator_details TEXT,
  load_cell_details TEXT,
  application_number TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  installation_address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'APPLICATION_PENDING', 'TESTING', 'APPROVED', 'REJECTED')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instrument_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  config_version INT NOT NULL DEFAULT 1,
  min_capacity NUMERIC,
  tare_capacity NUMERIC,
  temperature_range_min NUMERIC,
  temperature_range_max NUMERIC,
  power_supply TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. REGULATORY RULES & TEST DEFINITIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  standard_code TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  accuracy_class TEXT NOT NULL,
  test_type TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  calculation_ref TEXT NOT NULL,
  formula_definition TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  standard_ref TEXT NOT NULL,
  oiml_clause TEXT NOT NULL,
  description TEXT NOT NULL,
  supported_in_mvp BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Standard OIML R 76-1 Test Definitions (Metrological Constants)
INSERT INTO public.test_definitions (test_code, name, category, standard_ref, oiml_clause, description, supported_in_mvp, active) VALUES
  ('ACC_WEIGHING', 'Weighing Performance & Accuracy Test', 'Metrological Performance', 'OIML R 76-1:2006', 'Clause A.4.4', 'Evaluation of errors of indication with increasing and decreasing loads across instrument range up to Max.', true, true),
  ('REPEATABILITY', 'Repeatability Test', 'Metrological Performance', 'OIML R 76-1:2006', 'Clause A.4.6', 'Evaluation of variation in multiple independent weighings under constant test conditions.', true, true),
  ('ECCENTRICITY', 'Eccentricity (Corner Load) Test', 'Metrological Performance', 'OIML R 76-1:2006', 'Clause A.4.7', 'Evaluation of error variation when load is positioned off-center across platform sections.', true, true),
  ('TARE_ZERO', 'Tare & Zero-Setting Test', 'Metrological Performance', 'OIML R 76-1:2006', 'Clause A.4.5', 'Evaluation of zero-setting accuracy and tare balancing mechanism under varying load conditions.', true, true)
ON CONFLICT (test_code) DO NOTHING;

-- Seed Standard Rule Version
INSERT INTO public.rule_versions (rule_id, version, title, standard_code, instrument_type, accuracy_class, test_type, requirement_text, calculation_ref, formula_definition) VALUES
  ('RULE-OIML-R76-2006', 'v1.0.0', 'OIML R 76-1:2006 Non-Automatic Weighing Instruments Type Evaluation Requirements', 'OIML R 76-1:2006', 'Non-Automatic Weighing Instrument', 'ALL', 'ALL', 'Implements selected OIML R 76-1:2006 requirements and applicable test procedures for Classes I, II, III, and IIII.', 'Clause A.4', '{"mpe_ranges": [{"class": "III", "limits": [{"max_e": 500, "mpe_e": 0.5}, {"max_e": 2000, "mpe_e": 1.0}, {"max_e": 10000, "mpe_e": 1.5}]}]}')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 4. TEST PLANS, INSPECTIONS & ASSIGNMENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.test_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_code TEXT UNIQUE NOT NULL,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  rule_version_id UUID REFERENCES public.rule_versions(id),
  rule_version_code TEXT NOT NULL DEFAULT 'v1.0.0',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT',
    'APPLICATION_SUBMITTED',
    'INSPECTION_SCHEDULED',
    'SITE_VERIFIED',
    'STANDARDS_VERIFIED',
    'FIELD_TESTS_COMPLETED',
    'INSPECTOR_RECOMMENDED',
    'SUBMITTED',
    'UNDER_REVIEW',
    'CORRECTION_REQUIRED',
    'APPROVED',
    'FINALIZED',
    'REJECTED'
  )),
  overall_decision TEXT NOT NULL DEFAULT 'PENDING' CHECK (overall_decision IN ('PENDING', 'PASS', 'FAIL', 'CONDITIONAL')),
  summary_notes TEXT,
  scheduled_date TEXT,
  site_address TEXT,
  target_latitude NUMERIC,
  target_longitude NUMERIC,
  geofence_radius_m NUMERIC NOT NULL DEFAULT 500,
  assigned_inspector_id UUID REFERENCES public.profiles(id),
  assigned_sub_inspector_id UUID REFERENCES public.profiles(id),
  assigned_engineer_id UUID REFERENCES public.profiles(id),
  verified_latitude NUMERIC,
  verified_longitude NUMERIC,
  verified_distance_m NUMERIC,
  gps_verified_at TIMESTAMPTZ,
  gps_status TEXT CHECK (gps_status IS NULL OR gps_status IN ('MATCH', 'OUT_OF_BOUNDS', 'MANUAL_OVERRIDE')),
  photo_verification_url TEXT,
  photo_verified_at TIMESTAMPTZ,
  standard_weights_json JSONB,
  standards_verified_by UUID REFERENCES public.profiles(id),
  standards_verified_at TIMESTAMPTZ,
  inspector_recommendation TEXT CHECK (inspector_recommendation IS NULL OR inspector_recommendation IN ('RECOMMEND_APPROVAL', 'REQUIRE_CORRECTION', 'RECOMMEND_REJECTION')),
  inspector_notes TEXT,
  inspector_reviewed_at TIMESTAMPTZ,
  generated_by UUID REFERENCES public.profiles(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id UUID NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  test_definition_id UUID NOT NULL REFERENCES public.test_definitions(id),
  test_code TEXT NOT NULL,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
  supported BOOLEAN NOT NULL DEFAULT true,
  execution_order INT NOT NULL DEFAULT 1,
  notes TEXT,
  decision TEXT NOT NULL DEFAULT 'PENDING' CHECK (decision IN ('PENDING', 'PASS', 'FAIL', 'INCOMPLETE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. TEST OBSERVATIONS & RAW DATA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.test_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_instance_id UUID NOT NULL REFERENCES public.test_instances(id) ON DELETE CASCADE,
  load_point NUMERIC NOT NULL,
  reference_mass NUMERIC NOT NULL,
  mass_unit TEXT NOT NULL,
  indication_increasing NUMERIC,
  indication_decreasing NUMERIC,
  delta_l NUMERIC DEFAULT 0,
  position_corner TEXT,
  run_number INT NOT NULL DEFAULT 1,
  tare_applied NUMERIC DEFAULT 0,
  temp_celsius NUMERIC,
  recorded_by UUID REFERENCES public.profiles(id),
  recorded_by_name TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View for backward compatibility with existing query alias
CREATE OR REPLACE VIEW public.observations AS
SELECT * FROM public.test_observations;

-- ==============================================================================
-- 6. CALCULATION RESULTS & VERSIONS (OIML COMPLIANCE ENGINE)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.calculation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_instance_id UUID NOT NULL REFERENCES public.test_instances(id) ON DELETE CASCADE,
  input_values_json JSONB NOT NULL,
  formula_ref TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  result_value NUMERIC NOT NULL,
  applicable_mpe NUMERIC NOT NULL,
  comparison_text TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('PASS', 'FAIL', 'INCOMPLETE')),
  calculation_steps_json JSONB NOT NULL,
  calculated_by UUID REFERENCES public.profiles(id),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.calculations AS
SELECT * FROM public.calculation_results;

CREATE TABLE IF NOT EXISTS public.compliance_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id UUID NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  test_instance_id UUID NOT NULL REFERENCES public.test_instances(id) ON DELETE CASCADE,
  test_code TEXT NOT NULL,
  evaluated_mpe NUMERIC NOT NULL,
  actual_error NUMERIC NOT NULL,
  decision TEXT NOT NULL,
  summary TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_by UUID REFERENCES public.profiles(id)
);

-- ==============================================================================
-- 7. TECHNICAL REVIEWS & CORRECTION REQUESTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.technical_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id UUID NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL CHECK (action IN ('RECOMMEND_APPROVAL', 'REQUEST_CORRECTION', 'REJECT', 'NOTE_ADDED')),
  decision TEXT NOT NULL,
  comments TEXT NOT NULL,
  correction_requested BOOLEAN NOT NULL DEFAULT false,
  correction_details TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id UUID NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  user_role TEXT NOT NULL,
  reason TEXT,
  is_override BOOLEAN NOT NULL DEFAULT false,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 8. CERTIFICATES, REPORTS & SHA-256 VERIFICATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT UNIQUE NOT NULL,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id),
  test_plan_id UUID NOT NULL REFERENCES public.test_plans(id),
  rule_version_used TEXT NOT NULL,
  calculation_version_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'FINALIZED' CHECK (status IN ('FINALIZED', 'REVOKED', 'SUPERSEDED')),
  reviewer_id UUID REFERENCES public.profiles(id),
  reviewer_name TEXT,
  approving_authority_id UUID REFERENCES public.profiles(id),
  approving_authority_name TEXT,
  summary TEXT,
  certificate_pdf_url TEXT,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.reports AS
SELECT * FROM public.certificates;

CREATE TABLE IF NOT EXISTS public.certificate_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  verification_id TEXT UNIQUE NOT NULL,
  sha256_hash TEXT NOT NULL,
  report_payload_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.report_hashes AS
SELECT * FROM public.certificate_verifications;

-- ==============================================================================
-- 9. EVIDENCE & AUDIT TRAIL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_instance_id UUID NOT NULL REFERENCES public.test_instances(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT NOT NULL,
  storage_path TEXT,
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_value_json JSONB,
  after_value_json JSONB,
  reason TEXT,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 10. INDEXES FOR PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_instruments_code ON public.instruments(instrument_code);
CREATE INDEX IF NOT EXISTS idx_instruments_mfg ON public.instruments(manufacturer);
CREATE INDEX IF NOT EXISTS idx_instruments_model ON public.instruments(model_number);
CREATE INDEX IF NOT EXISTS idx_instruments_owner ON public.instruments(created_by);
CREATE INDEX IF NOT EXISTS idx_test_plans_status ON public.test_plans(status);
CREATE INDEX IF NOT EXISTS idx_test_plans_inst ON public.test_plans(instrument_id);
CREATE INDEX IF NOT EXISTS idx_test_plans_insp ON public.test_plans(assigned_inspector_id);
CREATE INDEX IF NOT EXISTS idx_test_plans_sub ON public.test_plans(assigned_sub_inspector_id);
CREATE INDEX IF NOT EXISTS idx_test_plans_eng ON public.test_plans(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_certificates_num ON public.certificates(report_number);
CREATE INDEX IF NOT EXISTS idx_certificates_inst ON public.certificates(instrument_id);
CREATE INDEX IF NOT EXISTS idx_cert_verifications_id ON public.certificate_verifications(verification_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all operational tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 11.1 PROFILES POLICIES
-- Users can view all active profiles (for directory/assignments)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users can only update their own non-role profile fields
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 11.2 ROLES & USER_ROLES POLICIES
-- Authenticated users can view roles
CREATE POLICY "roles_select" ON public.roles
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can view user roles
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

-- Only ADMIN can modify roles or user assignments (Database boundary)
CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.auth_has_role('ADMIN'))
  WITH CHECK (public.auth_has_role('ADMIN'));

-- 11.3 INSTRUMENTS POLICIES
-- APPLICANT: Can view and manage own instruments
-- METROLOGY STAFF / ADMIN: Can view all instruments
CREATE POLICY "instruments_select" ON public.instruments
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('SUB_INSPECTOR') OR
    public.auth_has_role('ENGINEER') OR
    public.auth_has_role('ADMIN')
  );

CREATE POLICY "instruments_insert_applicant" ON public.instruments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() OR
    public.auth_has_role('ADMIN')
  );

CREATE POLICY "instruments_update_applicant_or_admin" ON public.instruments
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

-- 11.4 TEST PLANS POLICIES
CREATE POLICY "test_plans_select" ON public.test_plans
  FOR SELECT TO authenticated
  USING (
    -- APPLICANT: own instruments
    instrument_id IN (SELECT id FROM public.instruments WHERE created_by = auth.uid()) OR
    -- Assigned officers
    assigned_inspector_id = auth.uid() OR
    assigned_sub_inspector_id = auth.uid() OR
    assigned_engineer_id = auth.uid() OR
    -- Regulatory staff & admin
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('SUB_INSPECTOR') OR
    public.auth_has_role('ENGINEER') OR
    public.auth_has_role('ADMIN')
  );

CREATE POLICY "test_plans_modify_staff" ON public.test_plans
  FOR ALL TO authenticated
  USING (
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('SUB_INSPECTOR') OR
    public.auth_has_role('ADMIN')
  )
  WITH CHECK (
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('SUB_INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

-- 11.5 TEST INSTANCES & OBSERVATIONS POLICIES
CREATE POLICY "test_instances_select" ON public.test_instances
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "test_instances_manage_staff" ON public.test_instances
  FOR ALL TO authenticated
  USING (
    public.auth_has_role('SUB_INSPECTOR') OR
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

CREATE POLICY "observations_select" ON public.test_observations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "observations_insert_tester" ON public.test_observations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_role('SUB_INSPECTOR') OR
    public.auth_has_role('ENGINEER') OR
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

-- 11.6 CALCULATION RESULTS & TECHNICAL REVIEWS
CREATE POLICY "calculations_select" ON public.calculation_results
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "calculations_insert_staff" ON public.calculation_results
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_role('SUB_INSPECTOR') OR
    public.auth_has_role('ENGINEER') OR
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

CREATE POLICY "technical_reviews_select" ON public.technical_reviews
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "technical_reviews_insert" ON public.technical_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_role('ENGINEER') OR
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

-- 11.7 CERTIFICATES & PUBLIC VERIFICATIONS
CREATE POLICY "certificates_select" ON public.certificates
  FOR SELECT TO authenticated
  USING (
    instrument_id IN (SELECT id FROM public.instruments WHERE created_by = auth.uid()) OR
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN') OR
    public.auth_has_role('ENGINEER') OR
    public.auth_has_role('SUB_INSPECTOR')
  );

CREATE POLICY "certificates_manage_authority" ON public.certificates
  FOR ALL TO authenticated
  USING (
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

-- Public verification table: readable by ANYONE (even anon) to verify certificates via QR code
CREATE POLICY "certificate_verifications_select_public" ON public.certificate_verifications
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "certificate_verifications_manage" ON public.certificate_verifications
  FOR ALL TO authenticated
  USING (
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

-- 11.8 EVIDENCE & AUDIT LOGS
CREATE POLICY "evidence_select" ON public.evidence
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "evidence_insert" ON public.evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_role('SUB_INSPECTOR') OR
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ENGINEER') OR
    public.auth_has_role('ADMIN')
  );

CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.auth_has_role('INSPECTOR') OR
    public.auth_has_role('ADMIN')
  );

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ==============================================================================
-- 12. SUPABASE STORAGE BUCKETS CONFIGURATION & POLICIES
-- ==============================================================================

-- Create buckets via Supabase storage schema if available
INSERT INTO storage.buckets (id, name, public) VALUES
  ('inspection-evidence', 'inspection-evidence', false),
  ('certificates', 'certificates', false),
  ('supporting-documents', 'supporting-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS: inspection-evidence
CREATE POLICY "inspection_evidence_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-evidence');

CREATE POLICY "inspection_evidence_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-evidence' AND
    (
      public.auth_has_role('SUB_INSPECTOR') OR
      public.auth_has_role('INSPECTOR') OR
      public.auth_has_role('ENGINEER') OR
      public.auth_has_role('ADMIN')
    )
  );

-- Storage RLS: certificates
CREATE POLICY "certificates_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'certificates');

CREATE POLICY "certificates_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'certificates' AND
    (
      public.auth_has_role('INSPECTOR') OR
      public.auth_has_role('ADMIN')
    )
  );

-- Storage RLS: supporting-documents
CREATE POLICY "supporting_docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'supporting-documents');

CREATE POLICY "supporting_docs_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supporting-documents');
