-- AIS — Allow platform superusers to update athletes across orgs.
-- Symptom: Admin profile save shows "Changes saved" but athlete email/details do not persist
-- when org switcher targets a non-home org (e.g. JSW Sports).
-- Cause: athlete_isolation UPDATE policy enforces org_id = get_current_org_id() (home org);
-- superuser SELECT/INSERT/DELETE cross-org policies exist but UPDATE was missing.
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql

DROP POLICY IF EXISTS athletes_platform_superuser_update ON public.athletes;
CREATE POLICY athletes_platform_superuser_update
  ON public.athletes FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());
