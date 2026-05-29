-- AIS — Allow platform superusers to manage cross-org roles and permissions (Admin → Roles tab).
-- Symptom: Roles / permissions empty when org switcher is on a non-home org (e.g. JSW Sports).
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql

DROP POLICY IF EXISTS roles_platform_superuser_select ON public.roles;
CREATE POLICY roles_platform_superuser_select
  ON public.roles FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS role_permissions_platform_superuser_select ON public.role_permissions;
CREATE POLICY role_permissions_platform_superuser_select
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS role_permissions_platform_superuser_insert ON public.role_permissions;
CREATE POLICY role_permissions_platform_superuser_insert
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS role_permissions_platform_superuser_update ON public.role_permissions;
CREATE POLICY role_permissions_platform_superuser_update
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());
