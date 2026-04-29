CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  severity TEXT,
  title TEXT NOT NULL,
  message TEXT,
  link_path TEXT,
  encounter_id UUID,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read, created_at DESC);

CREATE POLICY "Notifications view own"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Notifications insert own or system"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Notifications update own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Notifications delete own"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Auto-create a notification when a critical/high risk event lands for a user
CREATE OR REPLACE FUNCTION public.notify_on_risk_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity IN ('S4', 'S5') THEN
    INSERT INTO public.notifications (user_id, notification_type, severity, title, message, link_path, encounter_id)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.severity = 'S5' THEN 'risk_critical' ELSE 'risk_high' END,
      NEW.severity,
      CASE WHEN NEW.severity = 'S5' THEN 'Critical risk event' ELSE 'High-severity risk event' END,
      COALESCE(NEW.description, NEW.event_type),
      CASE WHEN NEW.encounter_id IS NOT NULL THEN '/encounters/' || NEW.encounter_id::text ELSE NULL END,
      NEW.encounter_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_risk_event ON public.risk_events;
CREATE TRIGGER trg_notify_risk_event
  AFTER INSERT ON public.risk_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_risk_event();

-- Auto-create a notification when a reviewer assignment is created
CREATE OR REPLACE FUNCTION public.notify_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, notification_type, severity, title, message, link_path, encounter_id)
  VALUES (
    NEW.reviewer_id,
    'review_assigned',
    COALESCE(NEW.priority, 'normal'),
    'New review assigned',
    'A clinical encounter is awaiting your adjudication.',
    '/review/' || NEW.id::text,
    NEW.encounter_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_assignment ON public.reviewer_assignments;
CREATE TRIGGER trg_notify_assignment
  AFTER INSERT ON public.reviewer_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_assignment();