-- AIS — Allow platform superusers to update/delete teams across orgs.
-- Symptom: team gender/logo save shows success but reverts for superuser in switched org.
-- Cause: team_isolation enforces org_id = get_current_org_id() (home org); only SELECT/INSERT had a superuser bypass.

DROP POLICY IF EXISTS teams_platform_superuser_update ON public.teams;
CREATE POLICY teams_platform_superuser_update
  ON public.teams FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS teams_platform_superuser_delete ON public.teams;
CREATE POLICY teams_platform_superuser_delete
  ON public.teams FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
