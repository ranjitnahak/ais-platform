-- AIS — Allow platform superusers to read cross-org staff/user rows (Admin → Users list).
-- Symptom: superuser sees athletes across orgs but newly invited staff in another org is missing.
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql

DROP POLICY IF EXISTS users_platform_superuser_select ON public.users;
CREATE POLICY users_platform_superuser_select
  ON public.users FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS user_roles_platform_superuser_select ON public.user_roles;
CREATE POLICY user_roles_platform_superuser_select
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS users_platform_superuser_update ON public.users;
CREATE POLICY users_platform_superuser_update
  ON public.users FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS users_platform_superuser_delete ON public.users;
CREATE POLICY users_platform_superuser_delete
  ON public.users FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
