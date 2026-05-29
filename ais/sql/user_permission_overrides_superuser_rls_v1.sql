-- Allow platform superusers to manage user_permission_overrides in any org
-- (org switcher context). Existing org-scoped admin policy remains for regular admins.

DROP POLICY IF EXISTS user_permission_overrides_platform_superuser_select ON public.user_permission_overrides;
CREATE POLICY user_permission_overrides_platform_superuser_select
  ON public.user_permission_overrides FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS user_permission_overrides_platform_superuser_insert ON public.user_permission_overrides;
CREATE POLICY user_permission_overrides_platform_superuser_insert
  ON public.user_permission_overrides FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS user_permission_overrides_platform_superuser_update ON public.user_permission_overrides;
CREATE POLICY user_permission_overrides_platform_superuser_update
  ON public.user_permission_overrides FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS user_permission_overrides_platform_superuser_delete ON public.user_permission_overrides;
CREATE POLICY user_permission_overrides_platform_superuser_delete
  ON public.user_permission_overrides FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
