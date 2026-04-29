ALTER TABLE public.rubric_criteria
  ADD COLUMN IF NOT EXISTS last_calibrated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_calibrated_by UUID,
  ADD COLUMN IF NOT EXISTS sensitivity NUMERIC,
  ADD COLUMN IF NOT EXISTS specificity NUMERIC,
  ADD COLUMN IF NOT EXISTS clinician_agreement_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS calibration_matrix JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calibration_status TEXT NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rubric_criteria_calibration_status_chk'
  ) THEN
    ALTER TABLE public.rubric_criteria
      ADD CONSTRAINT rubric_criteria_calibration_status_chk
      CHECK (calibration_status IN ('calibrated','needs_calibration','draft'));
  END IF;
END $$;
