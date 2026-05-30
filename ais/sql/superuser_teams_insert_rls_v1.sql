-- AIS — Allow platform superusers to insert teams across orgs.
-- Symptom: "new row violates row-level security policy for table \"teams\"" in Admin → Teams.
-- Cause: team_isolation enforces org_id = get_current_org_id() (home org), while superuser UI
-- targets active org via org switcher. SELECT already has teams_platform_superuser_select.

DROP POLICY IF EXISTS teams_platform_superuser_insert ON public.teams;
CREATE POLICY teams_platform_superuser_insert
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());
