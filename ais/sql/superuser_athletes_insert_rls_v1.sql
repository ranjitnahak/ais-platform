-- AIS — Allow platform superusers to insert athletes across orgs.
-- Symptom: "new row violates row-level security policy for table \"athletes\"" in Add User flow.
-- Cause: existing athlete_isolation policy enforces org_id = get_current_org_id() (home org), while
-- superuser UI can target a different active org via org switcher.

DROP POLICY IF EXISTS athletes_platform_superuser_insert ON public.athletes;
CREATE POLICY athletes_platform_superuser_insert
  ON public.athletes FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());
