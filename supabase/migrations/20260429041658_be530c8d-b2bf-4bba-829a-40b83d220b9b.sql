-- Team management additions to vellum_users
ALTER TABLE public.vellum_users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS invited_email TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_by UUID;

-- Allow user_id to be null for invite-only rows (no auth user yet)
ALTER TABLE public.vellum_users ALTER COLUMN user_id DROP NOT NULL;

-- Validate status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vellum_users_status_chk'
  ) THEN
    ALTER TABLE public.vellum_users
      ADD CONSTRAINT vellum_users_status_chk
      CHECK (status IN ('active','invited','removed'));
  END IF;
END $$;

-- Admin team management policies (in addition to existing self policies)
DROP POLICY IF EXISTS "Vellum users admin manage" ON public.vellum_users;
CREATE POLICY "Vellum users admin manage"
  ON public.vellum_users
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow members of the same org to view team roster
DROP POLICY IF EXISTS "Vellum users view org members" ON public.vellum_users;
CREATE POLICY "Vellum users view org members"
  ON public.vellum_users
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (
      SELECT vu.organization_id FROM public.vellum_users vu
      WHERE vu.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS vellum_users_org_status_idx
  ON public.vellum_users (organization_id, status);
