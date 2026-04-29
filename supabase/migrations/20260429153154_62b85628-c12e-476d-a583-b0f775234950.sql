ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_events;
ALTER TABLE public.risk_events REPLICA IDENTITY FULL;