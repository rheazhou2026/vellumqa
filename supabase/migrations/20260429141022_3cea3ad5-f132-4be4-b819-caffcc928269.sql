
-- Retier the legacy consent-fabrication criterion to softer scoring,
-- and add two new criteria that explicitly tier consent fabrication
-- by clinical consequence: low (verbalized understanding language)
-- and high (treatment / procedure / recording consent).

UPDATE public.rubric_criteria
SET
  severity_level = 'S3',
  critical_failure_possible = false,
  scoring = '{"base":10,"miss_penalty":-8,"score_cap":75}'::jsonb,
  explainability_template = 'Generic consent-style language without source backing. Use the tiered consent-fabrication criteria for treatment/recording consent.'
WHERE criterion_id = 'ALL_CONSENT_FABRICATION_001';

WITH d AS (SELECT id, domain_code FROM public.rubric_domains)
INSERT INTO public.rubric_criteria
  (criterion_id, domain_id, name, specialty_modules, severity_level, critical_failure_possible, explainability_template, version, effective_date, scoring)
VALUES
  ('ALL_CONSENT_FAB_TREATMENT_001',
   (SELECT id FROM d WHERE domain_code='D9_COMPLIANCE_LEGAL'),
   'Treatment / procedure consent supported by source',
   ARRAY['all'],
   'S5', true,
   'Documented consent for a treatment, procedure, surgery, or anesthesia must be supported by transcript, signed form, or EHR record. Fabricated treatment consent is a medico-legal never-event.',
   '2026.04', '2026-04-29',
   '{"base":10,"miss_penalty":-25,"score_cap":0}'::jsonb),

  ('ALL_CONSENT_FAB_RECORDING_001',
   (SELECT id FROM d WHERE domain_code='D9_COMPLIANCE_LEGAL'),
   'Recording / AI scribe consent supported by source',
   ARRAY['all'],
   'S4', false,
   'Statements like "patient consented to AI recording / ambient scribe" must be supported by source. Missing consent for recording is a privacy violation but not a clinical never-event.',
   '2026.04', '2026-04-29',
   '{"base":10,"miss_penalty":-15,"score_cap":50}'::jsonb)
ON CONFLICT (criterion_id) DO NOTHING;
