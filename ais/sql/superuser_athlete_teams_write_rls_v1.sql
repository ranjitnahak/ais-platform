-- AIS — Allow platform superusers to insert/update/delete athlete_teams across orgs.
-- Symptom: team unassignment shows "Changes saved" but reverts after refresh for superuser in switched org.
-- Cause: athlete_teams_isolation enforces team.org_id = get_current_org_id() (home org); only SELECT had a superuser bypass.

DROP POLICY IF EXISTS athlete_teams_platform_superuser_insert ON public.athlete_teams;
CREATE POLICY athlete_teams_platform_superuser_insert
  ON public.athlete_teams FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_teams_platform_superuser_update ON public.athlete_teams;
CREATE POLICY athlete_teams_platform_superuser_update
  ON public.athlete_teams FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_teams_platform_superuser_delete ON public.athlete_teams;
CREATE POLICY athlete_teams_platform_superuser_delete
  ON public.athlete_teams FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
