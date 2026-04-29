-- Add clinical reasoning analysis to evaluation_runs
ALTER TABLE public.evaluation_runs
  ADD COLUMN IF NOT EXISTS reasoning_quality text,
  ADD COLUMN IF NOT EXISTS reasoning_strengths jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reasoning_gaps jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reasoning_summary text,
  ADD COLUMN IF NOT EXISTS guideline_matches jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS red_flag_findings jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cognitive_biases jsonb DEFAULT '[]'::jsonb;

-- Add evidence-based suggestions to guideline_sources content
ALTER TABLE public.guideline_sources
  ADD COLUMN IF NOT EXISTS key_recommendations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS red_flag_criteria jsonb DEFAULT '[]'::jsonb;