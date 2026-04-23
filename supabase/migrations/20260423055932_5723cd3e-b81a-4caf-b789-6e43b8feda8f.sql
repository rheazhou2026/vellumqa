
CREATE TYPE public.app_role AS ENUM ('admin', 'reviewer', 'viewer');
CREATE TYPE public.severity_level AS ENUM ('critical', 'important', 'minor', 'info');
CREATE TYPE public.batch_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.item_status AS ENUM ('queued', 'processing', 'done', 'error');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  organization TEXT,
  role_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'reviewer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.ai_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  vendor TEXT,
  model_version TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI sources viewable by authenticated" ON public.ai_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert AI sources" ON public.ai_sources FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update AI sources" ON public.ai_sources FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete AI sources" ON public.ai_sources FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_ai_sources_updated BEFORE UPDATE ON public.ai_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.clinical_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  specialty TEXT NOT NULL,
  condition_keywords TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  red_flags TEXT,
  citation TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinical_guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guidelines viewable by authenticated" ON public.clinical_guidelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert guidelines" ON public.clinical_guidelines FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin update guidelines" ON public.clinical_guidelines FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creator or admin delete guidelines" ON public.clinical_guidelines FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_guidelines_updated BEFORE UPDATE ON public.clinical_guidelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_source_id UUID REFERENCES public.ai_sources(id) ON DELETE SET NULL,
  patient_label TEXT,
  chief_complaint TEXT,
  specialty TEXT,
  note_text TEXT NOT NULL,
  source_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notes or admin" ON public.clinical_notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own notes" ON public.clinical_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notes" ON public.clinical_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notes" ON public.clinical_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_clinical_notes_user ON public.clinical_notes(user_id, created_at DESC);
CREATE INDEX idx_clinical_notes_ai_source ON public.clinical_notes(ai_source_id);

CREATE TABLE public.note_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_source_id UUID REFERENCES public.ai_sources(id) ON DELETE SET NULL,
  top_clinical_risk TEXT,
  overall_trust_score NUMERIC(5,2),
  reasoning_rating TEXT,
  recognized_pattern TEXT,
  safety_score NUMERIC(5,2),
  completeness_score NUMERIC(5,2),
  accuracy_score NUMERIC(5,2),
  reasoning_score NUMERIC(5,2),
  clinical_reasoning JSONB,
  red_flags JSONB,
  cognitive_biases JSONB,
  issues JSONB,
  pattern_matches JSONB,
  gold_standard JSONB,
  risk_impact JSONB,
  guideline_references JSONB,
  model_used TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.note_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own analyses or admin" ON public.note_analyses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own analyses" ON public.note_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own analyses" ON public.note_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_note_analyses_user_created ON public.note_analyses(user_id, created_at DESC);
CREATE INDEX idx_note_analyses_ai_source ON public.note_analyses(ai_source_id, created_at DESC);
CREATE INDEX idx_note_analyses_note ON public.note_analyses(note_id);

CREATE TABLE public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_source_id UUID REFERENCES public.ai_sources(id) ON DELETE SET NULL,
  label TEXT,
  status public.batch_status NOT NULL DEFAULT 'pending',
  total_items INT NOT NULL DEFAULT 0,
  processed_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,
  aggregate_summary JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own batches or admin" ON public.batch_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own batches" ON public.batch_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own batches" ON public.batch_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own batches" ON public.batch_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON public.batch_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.batch_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batch_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  patient_label TEXT,
  note_text TEXT NOT NULL,
  status public.item_status NOT NULL DEFAULT 'queued',
  analysis_id UUID REFERENCES public.note_analyses(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.batch_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own batch items or admin" ON public.batch_job_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own batch items" ON public.batch_job_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own batch items" ON public.batch_job_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own batch items" ON public.batch_job_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_batch_items_batch ON public.batch_job_items(batch_id, position);
CREATE TRIGGER trg_batch_items_updated BEFORE UPDATE ON public.batch_job_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.clinical_guidelines (name, organization, specialty, condition_keywords, summary, recommendations, red_flags, citation) VALUES
('Chest Pain Risk Stratification', 'AHA / ACC', 'Cardiology',
 ARRAY['chest pain','angina','acs','myocardial','cardiac'],
 'Risk-stratify all chest pain using HEART or TIMI; obtain ECG within 10 min and serial troponin.',
 E'- ECG within 10 minutes of presentation\n- Serial high-sensitivity troponin at 0 and 1-3 hours\n- HEART score documentation\n- Aspirin if ACS suspected and not contraindicated\n- Disposition rationale (admit / observe / discharge)',
 'Sudden tearing pain (dissection), syncope, hypotension, new murmur, ST changes, hemodynamic instability.',
 'AHA/ACC 2021 Chest Pain Guideline'),
('Asthma Severity & Control (EPR-4 / NAEPP)', 'NAEPP', 'Pulmonology',
 ARRAY['asthma','wheeze','wheezing','reactive airway'],
 'Classify severity, assess control, and use stepwise therapy with ICS-formoterol where appropriate.',
 E'- Document severity classification (intermittent / mild / moderate / severe persistent)\n- Asthma control assessment (ACT or symptom frequency)\n- Inhaler technique review\n- Written asthma action plan\n- Trigger identification and avoidance counseling',
 'Inability to speak in full sentences, silent chest, SpO2 <90%, accessory muscle use, altered mental status.',
 'NAEPP 2020 Focused Updates'),
('Headache - Red Flag Screening (SNOOP)', 'ICHD / AAN', 'Neurology',
 ARRAY['headache','migraine','cephalgia','head pain'],
 'Screen all headaches for SNOOP red flags before assigning a primary headache diagnosis.',
 E'- SNOOP screening: Systemic symptoms, Neurologic deficits, Onset sudden/severe, Older age (>50), Pattern change\n- Differential: tension, migraine, cluster, secondary causes (mass, hemorrhage, GCA, IIH)\n- Imaging criteria (when neuro deficit, thunderclap, or red flag positive)\n- Medication overuse counseling if analgesic use >10-15 d/mo\n- Defined follow-up interval',
 'Thunderclap onset, focal deficit, fever + neck stiffness, papilledema, new headache age >50, progressive worsening.',
 'ICHD-3 + AAN Practice Parameters'),
('Sepsis Recognition & Bundle', 'IDSA / SCCM', 'Infectious Disease',
 ARRAY['sepsis','infection','fever','bacteremia','septic'],
 'Recognize sepsis early; apply 1-hour bundle when suspected.',
 E'- qSOFA / SIRS documentation\n- Lactate measurement\n- Blood cultures before antibiotics\n- Broad-spectrum antibiotics within 1 hour\n- Fluid resuscitation 30 mL/kg if hypotension or lactate >=4',
 'Hypotension, lactate >=4, altered mental status, oliguria, mottling, rigors.',
 'Surviving Sepsis Campaign 2021'),
('Type 2 Diabetes Standards of Care', 'ADA', 'Endocrinology',
 ARRAY['diabetes','dm','hyperglycemia','a1c','hba1c'],
 'Individualize A1c targets and prioritize cardio-renal protective agents in high-risk patients.',
 E'- A1c target documented and individualized\n- ASCVD / CKD / HF risk assessment\n- SGLT2i or GLP-1 RA when indicated\n- Statin therapy decision\n- Lifestyle counseling and follow-up interval',
 'DKA features, HHS, severe hypoglycemia, foot ulcer with infection.',
 'ADA Standards of Care 2024');
