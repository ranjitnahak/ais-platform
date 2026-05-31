-- AIS — Allow platform superusers to read/insert groups across orgs (org switcher).
-- Symptom: "new row violates row-level security policy for table \"groups\"" when assigning
-- staff teams (ensureGroupForTeam auto-creates a group per team name).
-- Cause: groups_isolation enforces org_id = get_current_org_id() (home org); no superuser bypass.
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql

DROP POLICY IF EXISTS groups_platform_superuser_select ON public.groups;
CREATE POLICY groups_platform_superuser_select
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS groups_platform_superuser_insert ON public.groups;
CREATE POLICY groups_platform_superuser_insert
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

-- Staff team assignment writes user_roles after resolving group ids.
DROP POLICY IF EXISTS user_roles_platform_superuser_insert ON public.user_roles;
CREATE POLICY user_roles_platform_superuser_insert
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());
