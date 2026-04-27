-- Restore EXECUTE permission on security-definer helpers used inside RLS policies.
-- Without this, every policy that calls these functions denies access, even for super_admin.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_can_access_user(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_my_geo() TO authenticated;