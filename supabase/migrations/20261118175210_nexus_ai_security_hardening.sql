ALTER VIEW public.appointments SET (security_invoker = true);
ALTER FUNCTION public.current_user_company_id() SET search_path = pg_catalog;
ALTER FUNCTION public.current_user_company_role() SET search_path = pg_catalog;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog;
ALTER FUNCTION public.handle_updated_at() SET search_path = pg_catalog;

REVOKE EXECUTE ON FUNCTION public.current_user_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_company_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_company_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;