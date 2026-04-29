-- Restore EXECUTE on has_role for authenticated users.
-- It is SECURITY DEFINER with a locked search_path, and is required by RLS policies
-- across most tables. Revoking it broke all role-gated reads/writes.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
-- anon should not call it (no RLS policies reference it for anon role).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;