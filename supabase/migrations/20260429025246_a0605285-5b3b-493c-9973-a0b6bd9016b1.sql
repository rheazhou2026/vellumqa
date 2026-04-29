-- ============================================================
-- VELLUM: Clinical AI Trust Infrastructure - Foundation Migration
-- Drops legacy clinical QA tables and creates full Vellum schema.
-- ============================================================

-- Drop legacy tables (clean slate)
DROP TABLE IF EXISTS public.note_analyses CASCADE;
DROP TABLE IF EXISTS public.clinical_notes CASCADE;
DROP TABLE IF EXISTS public.batch_job_items CASCADE;
DROP TABLE IF EXISTS public.batch_jobs CASCADE;
DROP TABLE IF EXISTS public.clinical_guidelines CASCADE;
DROP TABLE IF EXISTS public.ai_sources CASCADE;

-- Drop legacy types if present
DROP TYPE IF EXISTS public.batch_status CASCADE;
DROP TYPE IF EXISTS public.item_status CASCADE;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  jurisdiction TEXT DEFAULT 'US_FEDERAL',
  state_jurisdiction TEXT,
  compliance_settings JSONB DEFAULT '{}'::jsonb,
  guideline_profile JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  site_type TEXT NOT NULL,
  specialty_config JSONB DEFAULT '{}'::jsonb,
  local_policy JSONB DEFAULT '{}'::jsonb,
  guideline_overrides JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Vellum membership (separate from existing profiles/user_roles which we keep for auth)
CREATE TABLE public.vellum_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  vellum_role TEXT NOT NULL DEFAULT 'clinician',
  specialty TEXT,
  display_name TEXT,
  credentials TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vellum_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ENCOUNTERS + SOURCES
-- ============================================================
CREATE TABLE public.encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  encounter_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  patient_id TEXT,
  specialty TEXT NOT NULL,
  care_setting TEXT NOT NULL,
  chief_complaint TEXT,
  visit_type TEXT,
  patient_age_group TEXT,
  patient_risk_flags JSONB DEFAULT '[]'::jsonb,
  ai_vendor TEXT,
  ai_model_version TEXT,
  workflow_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_encounters_user ON public.encounters(user_id);
CREATE INDEX idx_encounters_org ON public.encounters(organization_id);
CREATE INDEX idx_encounters_specialty ON public.encounters(specialty);

CREATE TABLE public.encounter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.encounter_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.source_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.encounter_sources(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  speaker TEXT,
  start_time INTERVAL,
  end_time INTERVAL,
  text_content TEXT NOT NULL,
  span_tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.source_spans ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_source_spans_encounter ON public.source_spans(encounter_id);

-- ============================================================
-- NOTES + CLAIMS
-- ============================================================
CREATE TABLE public.note_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  content JSONB NOT NULL,
  raw_text TEXT,
  generation_metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.note_artifacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.note_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES public.note_artifacts(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  content TEXT NOT NULL,
  section_order INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.note_sections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.clinical_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES public.note_artifacts(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.note_sections(id) ON DELETE SET NULL,
  claim_type TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  claim_entities JSONB DEFAULT '[]'::jsonb,
  status TEXT,
  risk_weight DECIMAL(4,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinical_claims ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_claims_artifact ON public.clinical_claims(artifact_id);

CREATE TABLE public.claim_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.clinical_claims(id) ON DELETE CASCADE,
  source_span_id UUID REFERENCES public.source_spans(id) ON DELETE SET NULL,
  link_type TEXT,
  confidence DECIMAL(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.claim_evidence_links ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GUIDELINES
-- ============================================================
CREATE TABLE public.guideline_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  abbreviation TEXT,
  specialty TEXT,
  source_type TEXT,
  source_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.guideline_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.guideline_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.guideline_sources(id) ON DELETE CASCADE,
  version_string TEXT NOT NULL,
  effective_date DATE,
  retired_date DATE,
  change_summary TEXT,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.guideline_versions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RUBRIC
-- ============================================================
CREATE TABLE public.rubric_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  core_question TEXT,
  main_failure_type TEXT,
  display_order INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rubric_domains ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id TEXT UNIQUE NOT NULL,
  domain_id UUID REFERENCES public.rubric_domains(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  specialty_modules TEXT[] DEFAULT '{}',
  artifact_types TEXT[] DEFAULT '{}',
  trigger_logic JSONB DEFAULT '{}'::jsonb,
  evidence_requirements JSONB DEFAULT '{}'::jsonb,
  scoring JSONB DEFAULT '{}'::jsonb,
  review_action JSONB DEFAULT '{}'::jsonb,
  severity_level TEXT,
  critical_failure_possible BOOLEAN NOT NULL DEFAULT FALSE,
  explainability_template TEXT,
  version TEXT,
  effective_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rubric_load_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  loaded_modules TEXT[] DEFAULT '{}',
  excluded_modules JSONB DEFAULT '[]'::jsonb,
  guideline_versions JSONB DEFAULT '[]'::jsonb,
  assembled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rubric_load_manifests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EVALUATIONS
-- ============================================================
CREATE TABLE public.evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES public.note_artifacts(id) ON DELETE CASCADE,
  manifest_id UUID REFERENCES public.rubric_load_manifests(id) ON DELETE SET NULL,
  trust_score DECIMAL(5,2),
  source_faithfulness_index DECIMAL(5,2),
  omission_hazard_score DECIMAL(5,2),
  guideline_concordance_score DECIMAL(5,2),
  differential_integrity_score DECIMAL(5,2),
  patient_safety_escalation_score DECIMAL(5,2),
  uncertainty_calibration_score DECIMAL(5,2),
  medico_legal_exposure_score DECIMAL(5,2),
  reviewability_index DECIMAL(5,2),
  evaluator_confidence DECIMAL(5,2),
  critical_failures TEXT[] DEFAULT '{}',
  auto_escalated BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evaluation_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_eval_encounter ON public.evaluation_runs(encounter_id);

CREATE TABLE public.criterion_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_run_id UUID NOT NULL REFERENCES public.evaluation_runs(id) ON DELETE CASCADE,
  criterion_id TEXT REFERENCES public.rubric_criteria(criterion_id) ON DELETE SET NULL,
  applicability TEXT,
  result TEXT,
  confidence DECIMAL(4,3),
  score_delta DECIMAL(6,2),
  severity TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  explanation TEXT,
  review_action TEXT,
  requires_human_adjudication BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.criterion_results ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_crit_results_run ON public.criterion_results(evaluation_run_id);

-- ============================================================
-- RISK / REVIEW / AUDIT
-- ============================================================
CREATE TABLE public.risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE CASCADE,
  evaluation_run_id UUID REFERENCES public.evaluation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT,
  affected_claims JSONB DEFAULT '[]'::jsonb,
  action_taken TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_risk_user ON public.risk_events(user_id);

CREATE TABLE public.reviewer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES public.note_artifacts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  assigned_by UUID,
  priority TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviewer_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_assign_reviewer ON public.reviewer_assignments(reviewer_id);

CREATE TABLE public.adjudications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.reviewer_assignments(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  criterion_result_id UUID REFERENCES public.criterion_results(id) ON DELETE CASCADE,
  adjudication TEXT,
  reviewer_notes TEXT,
  adjudicated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.adjudications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  encounter_id UUID,
  artifact_id UUID,
  user_id UUID,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_user ON public.audit_events(user_id);

-- ============================================================
-- DRIFT / CORRECTIVE ACTIONS
-- ============================================================
CREATE TABLE public.drift_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID,
  specialty TEXT,
  ai_vendor TEXT,
  ai_model_version TEXT,
  metric_date DATE NOT NULL,
  avg_trust_score DECIMAL(5,2),
  hallucination_rate DECIMAL(6,4),
  omission_rate DECIMAL(6,4),
  critical_failure_rate DECIMAL(6,4),
  sample_size INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drift_metrics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_by_event_id UUID REFERENCES public.risk_events(id) ON DELETE SET NULL,
  action_type TEXT,
  description TEXT,
  assigned_to UUID,
  status TEXT NOT NULL DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================
-- Helper: encounter ownership via owning user_id
-- For simplicity in this build, every authenticated user owns their encounters.
-- Admin role from existing user_roles table can see all.

-- organizations / sites / vellum_users: viewable to authenticated, mutable by admin
CREATE POLICY "Orgs viewable by authenticated" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Orgs admin write" ON public.organizations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sites viewable by authenticated" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sites admin write" ON public.sites FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vellum users view own or admin" ON public.vellum_users FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Vellum users insert own" ON public.vellum_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Vellum users update own" ON public.vellum_users FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Encounters and child rows: owned by user_id
CREATE POLICY "Enc view own or admin" ON public.encounters FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Enc insert own" ON public.encounters FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enc update own" ON public.encounters FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Enc delete own" ON public.encounters FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Generic helper policy: rows tied to an encounter inherit access
CREATE POLICY "Sources via encounter" ON public.encounter_sources FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND e.user_id = auth.uid()));

CREATE POLICY "Spans via encounter" ON public.source_spans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND e.user_id = auth.uid()));

CREATE POLICY "Artifacts via encounter" ON public.note_artifacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND e.user_id = auth.uid()));

CREATE POLICY "Sections via artifact" ON public.note_sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.note_artifacts a JOIN public.encounters e ON e.id = a.encounter_id WHERE a.id = artifact_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.note_artifacts a JOIN public.encounters e ON e.id = a.encounter_id WHERE a.id = artifact_id AND e.user_id = auth.uid()));

CREATE POLICY "Claims via artifact" ON public.clinical_claims FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.note_artifacts a JOIN public.encounters e ON e.id = a.encounter_id WHERE a.id = artifact_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.note_artifacts a JOIN public.encounters e ON e.id = a.encounter_id WHERE a.id = artifact_id AND e.user_id = auth.uid()));

CREATE POLICY "Claim links via claim" ON public.claim_evidence_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinical_claims c JOIN public.note_artifacts a ON a.id = c.artifact_id JOIN public.encounters e ON e.id = a.encounter_id WHERE c.id = claim_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinical_claims c JOIN public.note_artifacts a ON a.id = c.artifact_id JOIN public.encounters e ON e.id = a.encounter_id WHERE c.id = claim_id AND e.user_id = auth.uid()));

-- Guidelines: org-scoped, viewable to authenticated, admin write
CREATE POLICY "Guideline sources viewable" ON public.guideline_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guideline sources admin write" ON public.guideline_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Guideline versions viewable" ON public.guideline_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guideline versions admin write" ON public.guideline_versions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rubric: viewable to authenticated, admin write
CREATE POLICY "Domains viewable" ON public.rubric_domains FOR SELECT TO authenticated USING (true);
CREATE POLICY "Domains admin write" ON public.rubric_domains FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Criteria viewable" ON public.rubric_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criteria admin write" ON public.rubric_criteria FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Manifests via encounter" ON public.rubric_load_manifests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND e.user_id = auth.uid()));

-- Evaluation runs and criterion results: via encounter
CREATE POLICY "Eval via encounter" ON public.evaluation_runs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND e.user_id = auth.uid()));

CREATE POLICY "Crit results via run" ON public.criterion_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluation_runs r JOIN public.encounters e ON e.id = r.encounter_id WHERE r.id = evaluation_run_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.evaluation_runs r JOIN public.encounters e ON e.id = r.encounter_id WHERE r.id = evaluation_run_id AND e.user_id = auth.uid()));

-- Risk events: own
CREATE POLICY "Risk view own or admin" ON public.risk_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Risk insert own" ON public.risk_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Risk update own" ON public.risk_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Reviewer assignments
CREATE POLICY "Assign view reviewer or admin" ON public.reviewer_assignments FOR SELECT TO authenticated USING (auth.uid() = reviewer_id OR auth.uid() = assigned_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Assign insert authenticated" ON public.reviewer_assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() = assigned_by OR auth.uid() = reviewer_id);
CREATE POLICY "Assign update reviewer" ON public.reviewer_assignments FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id OR public.has_role(auth.uid(), 'admin'));

-- Adjudications
CREATE POLICY "Adj view own or admin" ON public.adjudications FOR SELECT TO authenticated USING (auth.uid() = reviewer_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Adj insert own" ON public.adjudications FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

-- Audit events: append-only, viewable by owner / admin
CREATE POLICY "Audit view own or admin" ON public.audit_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Audit insert authenticated" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Drift metrics: viewable to authenticated, admin write
CREATE POLICY "Drift viewable" ON public.drift_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drift admin write" ON public.drift_metrics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Corrective actions: viewable to authenticated, owner/admin write
CREATE POLICY "CA viewable" ON public.corrective_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "CA insert authenticated" ON public.corrective_actions FOR INSERT TO authenticated WITH CHECK (auth.uid() = assigned_to OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CA update assigned or admin" ON public.corrective_actions FOR UPDATE TO authenticated USING (auth.uid() = assigned_to OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- SEED: Rubric Domains (10)
-- ============================================================
INSERT INTO public.rubric_domains (domain_code, name, core_question, main_failure_type, display_order) VALUES
('D1_SOURCE_FAITHFULNESS','Source Faithfulness','Are documented claims supported by encounter or EHR evidence?','Hallucination, negation, attribution error',1),
('D2_OMISSION_RISK','Omission Risk','Did the AI omit clinically meaningful information?','Silent danger, incomplete history, missing plan',2),
('D3_DIAGNOSTIC_REASONING','Diagnostic Reasoning','Does the assessment reflect appropriate differential logic?','Anchoring, premature closure, weak differential',3),
('D4_GUIDELINE_CONCORDANCE','Guideline Concordance','Does the note align with trusted guideline and local policy expectations?','Outdated, incomplete, contraindicated care',4),
('D5_SAFETY_ESCALATION','Patient Safety Escalation','Are emergencies, deterioration risks, and follow-up dangers handled?','Missed red flag, unsafe disposition',5),
('D6_UNCERTAINTY_CALIBRATION','Uncertainty Calibration','Does the note preserve uncertainty and avoid unsupported confidence?','Overconfidence, false reassurance',6),
('D7_DOCUMENTATION_INTEGRITY','Documentation Integrity','Is the note structured, usable, and correctly placed?','Misfiled data, note bloat, section contamination',7),
('D8_LONGITUDINAL_CONSISTENCY','Longitudinal Consistency','Does the note fit prior history, medications, and trajectory?','Copy-forward, contradiction, stale data',8),
('D9_COMPLIANCE_LEGAL','Compliance & Legal Defensibility','Does the artifact satisfy consent, audit, billing, and review obligations?','Consent fabrication, PHI risk, unsupported coding',9),
('D10_GOVERNANCE_RELIABILITY','Governance Reliability','Is the evaluation calibrated, reproducible, and auditable?','Untrusted scores, evaluator drift',10);

-- ============================================================
-- SEED: Rubric Criteria (25+)
-- ============================================================
WITH d AS (SELECT id, domain_code FROM public.rubric_domains)
INSERT INTO public.rubric_criteria (criterion_id, domain_id, name, specialty_modules, severity_level, critical_failure_possible, explainability_template, version, effective_date, scoring) VALUES
('EM_CHESTPAIN_TROPONIN_001', (SELECT id FROM d WHERE domain_code='D5_SAFETY_ESCALATION'), 'Troponin documented for adult chest pain', ARRAY['emergency_medicine','cardiology'], 'S4', false, 'Adult chest pain encounters require documented troponin assessment per AHA/ACC chest pain pathway.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-15,"score_cap":70}'::jsonb),
('PSY_SI_PLAN_MEANS_001', (SELECT id FROM d WHERE domain_code='D5_SAFETY_ESCALATION'), 'Suicidal ideation with method/means documented', ARRAY['psychiatry','emergency_medicine'], 'S5', true, 'Suicidal ideation with method or means identified in transcript but absent from note. Complete safety assessment required.', '2026.04', '2026-02-01', '{"base":10,"miss_penalty":-12,"score_cap":40}'::jsonb),
('PEDS_WEIGHT_DOSE_001', (SELECT id FROM d WHERE domain_code='D5_SAFETY_ESCALATION'), 'Pediatric weight-based dosing verified', ARRAY['pediatrics','emergency_medicine'], 'S5', true, 'Pediatric medication doses must reflect documented current weight (mg/kg).', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-15,"score_cap":40}'::jsonb),
('SURG_LATERALITY_CONSENT_001', (SELECT id FROM d WHERE domain_code='D9_COMPLIANCE_LEGAL'), 'Surgical laterality and site match consent', ARRAY['surgery'], 'S5', true, 'Procedure laterality / site in note must match signed consent.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-20,"score_cap":40}'::jsonb),
('ALL_CONSENT_FABRICATION_001', (SELECT id FROM d WHERE domain_code='D9_COMPLIANCE_LEGAL'), 'Consent statements supported by source', ARRAY['all'], 'S5', true, 'Documented consent must be supported by transcript, signed form, or EHR record.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-20,"score_cap":0}'::jsonb),
('ALL_ALLERGY_INVERSION_001', (SELECT id FROM d WHERE domain_code='D1_SOURCE_FAITHFULNESS'), 'Allergy status not inverted', ARRAY['all'], 'S5', true, 'Documented allergy status must match patient-reported allergies in transcript and EHR.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-20,"score_cap":0}'::jsonb),
('ALL_WRONG_PATIENT_001', (SELECT id FROM d WHERE domain_code='D1_SOURCE_FAITHFULNESS'), 'No wrong-patient data contamination', ARRAY['all'], 'S5', true, 'Note content must originate from this encounter only. Cross-contamination between patients is a never-event.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-30,"score_cap":0}'::jsonb),
('ONC_NEUTROPENIC_FEVER_001', (SELECT id FROM d WHERE domain_code='D5_SAFETY_ESCALATION'), 'Neutropenic fever recognized and escalated', ARRAY['oncology','emergency_medicine'], 'S5', true, 'Fever in chemotherapy patient requires neutropenic precautions and antibiotic escalation per NCCN.', '2025.02', '2025-03-15', '{"base":10,"miss_penalty":-15,"score_cap":40}'::jsonb),
('ICU_HEMODYNAMIC_CAPTURE_001', (SELECT id FROM d WHERE domain_code='D2_OMISSION_RISK'), 'Hemodynamic instability documented', ARRAY['critical_care'], 'S5', true, 'ICU notes must capture vasopressor doses, MAP targets, and trend.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-15,"score_cap":40}'::jsonb),
('EM_DIFFERENTIAL_LIFETHREAT_001', (SELECT id FROM d WHERE domain_code='D3_DIAGNOSTIC_REASONING'), 'Life-threatening differentials addressed', ARRAY['emergency_medicine'], 'S4', false, 'ED assessments must address can''t-miss diagnoses for the chief complaint.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-12,"score_cap":70}'::jsonb),
('PSY_HOMICIDAL_IDEATION_001', (SELECT id FROM d WHERE domain_code='D5_SAFETY_ESCALATION'), 'Homicidal ideation documented when present', ARRAY['psychiatry','emergency_medicine'], 'S5', true, 'Homicidal ideation in transcript must be documented with target, plan, and means.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-15,"score_cap":40}'::jsonb),
('CARD_ANTICOAG_RECONCILE_001', (SELECT id FROM d WHERE domain_code='D8_LONGITUDINAL_CONSISTENCY'), 'Anticoagulation reconciled with prior records', ARRAY['cardiology','primary_care'], 'S4', false, 'Active anticoagulants must be reconciled with EHR med list.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-12,"score_cap":70}'::jsonb),
('ALL_NEGATION_INVERSION_001', (SELECT id FROM d WHERE domain_code='D1_SOURCE_FAITHFULNESS'), 'Symptom presence/absence not inverted', ARRAY['all'], 'S4', false, 'Reported symptoms must not be negated, and denied symptoms must not be asserted.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-12,"score_cap":70}'::jsonb),
('ALL_COPY_FORWARD_001', (SELECT id FROM d WHERE domain_code='D8_LONGITUDINAL_CONSISTENCY'), 'No stale copy-forward content', ARRAY['all'], 'S2', false, 'Note must reflect current encounter, not prior visit content.', '2026.01', '2026-01-01', '{"base":5,"miss_penalty":-6,"score_cap":85}'::jsonb),
('PC_FOLLOWUP_LOOP_001', (SELECT id FROM d WHERE domain_code='D2_OMISSION_RISK'), 'Closed-loop follow-up plan documented', ARRAY['primary_care'], 'S2', false, 'Plan must specify who, what, when for follow-up.', '2026.01', '2026-01-01', '{"base":5,"miss_penalty":-6,"score_cap":85}'::jsonb),
('ONC_STAGING_FIDELITY_001', (SELECT id FROM d WHERE domain_code='D1_SOURCE_FAITHFULNESS'), 'Cancer staging matches source documentation', ARRAY['oncology'], 'S4', false, 'Staging in note must match pathology and imaging reports.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-12,"score_cap":70}'::jsonb),
('ALL_BILLING_INTEGRITY_001', (SELECT id FROM d WHERE domain_code='D9_COMPLIANCE_LEGAL'), 'Documentation supports billed level of service', ARRAY['all'], 'S3', false, 'E/M coding must be supported by documented complexity and time.', '2026.01', '2026-01-01', '{"base":5,"miss_penalty":-8,"score_cap":80}'::jsonb),
('ALL_OVERCONFIDENCE_001', (SELECT id FROM d WHERE domain_code='D6_UNCERTAINTY_CALIBRATION'), 'Uncertainty preserved in assessment', ARRAY['all'], 'S3', false, 'Uncertain findings must not be stated as definitive.', '2026.01', '2026-01-01', '{"base":5,"miss_penalty":-8,"score_cap":80}'::jsonb),
('ALL_SECTION_CONTAMINATION_001', (SELECT id FROM d WHERE domain_code='D7_DOCUMENTATION_INTEGRITY'), 'Content placed in correct section', ARRAY['all'], 'S2', false, 'Findings must appear in the appropriate note section.', '2026.01', '2026-01-01', '{"base":5,"miss_penalty":-5,"score_cap":85}'::jsonb),
('PSY_CAPACITY_CONSENT_001', (SELECT id FROM d WHERE domain_code='D9_COMPLIANCE_LEGAL'), 'Decision-making capacity documented when relevant', ARRAY['psychiatry'], 'S4', false, 'Capacity assessment required when refusing care or consenting to high-risk procedures.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-12,"score_cap":70}'::jsonb),
('PEDS_FEVER_AGE_001', (SELECT id FROM d WHERE domain_code='D5_SAFETY_ESCALATION'), 'Age-appropriate fever workup documented', ARRAY['pediatrics'], 'S4', false, 'Infants <90 days with fever require sepsis workup per AAP guidance.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-12,"score_cap":70}'::jsonb),
('ALL_DISPOSITION_SAFETY_001', (SELECT id FROM d WHERE domain_code='D5_SAFETY_ESCALATION'), 'Disposition matches clinical risk', ARRAY['emergency_medicine','primary_care'], 'S4', false, 'Discharge disposition must address documented risk and red-flag return precautions.', '2026.01', '2026-01-01', '{"base":10,"miss_penalty":-12,"score_cap":70}'::jsonb),
('ALL_GUIDELINE_CONCORDANCE_001', (SELECT id FROM d WHERE domain_code='D4_GUIDELINE_CONCORDANCE'), 'Plan aligns with applicable guideline', ARRAY['all'], 'S3', false, 'Plan must reflect guideline-recommended workup and treatment for the working diagnosis.', '2026.01', '2026-01-01', '{"base":5,"miss_penalty":-8,"score_cap":80}'::jsonb),
('ALL_REVIEWABILITY_001', (SELECT id FROM d WHERE domain_code='D10_GOVERNANCE_RELIABILITY'), 'Note is reviewable by independent clinician', ARRAY['all'], 'S1', false, 'Note structure and detail must allow another clinician to verify reasoning.', '2026.01', '2026-01-01', '{"base":3,"miss_penalty":-3,"score_cap":90}'::jsonb),
('ALL_RED_FLAG_RETURN_001', (SELECT id FROM d WHERE domain_code='D5_SAFETY_ESCALATION'), 'Return precautions list specific red flags', ARRAY['all'], 'S3', false, 'Discharge instructions must list specific red flags warranting return.', '2026.01', '2026-01-01', '{"base":5,"miss_penalty":-8,"score_cap":80}'::jsonb),
('ALL_MED_RECONCILIATION_001', (SELECT id FROM d WHERE domain_code='D8_LONGITUDINAL_CONSISTENCY'), 'Medication reconciliation completed', ARRAY['all'], 'S3', false, 'Active medications must be reconciled with EHR and patient report.', '2026.01', '2026-01-01', '{"base":5,"miss_penalty":-8,"score_cap":80}'::jsonb);

-- ============================================================
-- SEED: Default organization + sample guidelines
-- ============================================================
INSERT INTO public.organizations (id, name, slug, jurisdiction, state_jurisdiction)
VALUES ('00000000-0000-0000-0000-000000000001', 'Vellum Demo Health', 'vellum-demo', 'US_FEDERAL', 'CA');

INSERT INTO public.guideline_sources (organization_id, name, abbreviation, specialty, source_type, active) VALUES
('00000000-0000-0000-0000-000000000001','AHA/ACC Chest Pain Pathway','AHA_CP','cardiology','national_guideline',true),
('00000000-0000-0000-0000-000000000001','ADA Standards of Care','ADA_SOC','primary_care','national_guideline',true),
('00000000-0000-0000-0000-000000000001','ED Sepsis Protocol','ED_SEP','emergency_medicine','local_policy',true),
('00000000-0000-0000-0000-000000000001','NCCN Febrile Neutropenia','NCCN_FN','oncology','society_guideline',true),
('00000000-0000-0000-0000-000000000001','APA Suicide Risk Assessment','APA_SRA','psychiatry','society_guideline',true),
('00000000-0000-0000-0000-000000000001','AAP Febrile Infant','AAP_FI','pediatrics','national_guideline',true);
