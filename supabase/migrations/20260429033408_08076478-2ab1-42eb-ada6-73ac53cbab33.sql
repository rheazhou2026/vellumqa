-- 1. Guideline versioning on evaluation runs
ALTER TABLE public.evaluation_runs
  ADD COLUMN IF NOT EXISTS guideline_versions_used jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Seed an initial "v1.0" current version for any guideline source that has none
INSERT INTO public.guideline_versions (source_id, version_string, is_current, effective_date, change_summary)
SELECT gs.id, 'v1.0', true, CURRENT_DATE, 'Initial seeded version'
FROM public.guideline_sources gs
WHERE NOT EXISTS (
  SELECT 1 FROM public.guideline_versions gv WHERE gv.source_id = gs.id
);

-- 2. Finding feedback table
CREATE TABLE IF NOT EXISTS public.finding_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_run_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  finding_type text NOT NULL CHECK (finding_type IN ('criterion','reasoning_strength','reasoning_gap','guideline_match','red_flag','cognitive_bias','claim')),
  finding_key text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('correct','incorrect','partial')),
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_run_id, reviewer_id, finding_type, finding_key)
);

CREATE INDEX IF NOT EXISTS finding_feedback_run_idx ON public.finding_feedback(evaluation_run_id);
CREATE INDEX IF NOT EXISTS finding_feedback_type_idx ON public.finding_feedback(finding_type, verdict);

ALTER TABLE public.finding_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feedback view own or admin" ON public.finding_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = reviewer_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Feedback insert own" ON public.finding_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Feedback update own" ON public.finding_feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id);

CREATE TRIGGER trg_finding_feedback_updated_at
  BEFORE UPDATE ON public.finding_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Helper view: false-positive rate per finding_type to feed back into scoring
CREATE OR REPLACE VIEW public.finding_feedback_stats AS
SELECT
  finding_type,
  count(*) FILTER (WHERE verdict = 'incorrect')::numeric / NULLIF(count(*), 0) AS false_positive_rate,
  count(*) AS total_feedback,
  count(*) FILTER (WHERE verdict = 'correct') AS confirmed_count,
  count(*) FILTER (WHERE verdict = 'incorrect') AS rejected_count,
  count(*) FILTER (WHERE verdict = 'partial')   AS partial_count
FROM public.finding_feedback
GROUP BY finding_type;

GRANT SELECT ON public.finding_feedback_stats TO authenticated;