ALTER TABLE public.rubric_load_manifests
  ADD COLUMN IF NOT EXISTS loaded_modules_detail jsonb NOT NULL DEFAULT '[]'::jsonb;