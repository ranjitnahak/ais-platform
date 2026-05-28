-- AIS — Allow platform superusers to delete athletes across orgs.
-- Symptom: delete action appears to "do nothing" for superuser in switched org.
-- Cause: athlete_isolation policy enforces org_id = get_current_org_id() (home org), so delete can no-op.

DROP POLICY IF EXISTS athletes_platform_superuser_delete ON public.athletes;
CREATE POLICY athletes_platform_superuser_delete
  ON public.athletes FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
