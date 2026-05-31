-- AIS — Allow platform superusers to delete/update athlete_staff_notes across orgs (org switcher).
-- Symptom: user delete fails with FK 23503 on athlete_staff_notes_author_id_fkey after cleanup no-ops.
-- Cause: staff_notes_isolation enforces org_id = get_current_org_id(); no superuser bypass.

DROP POLICY IF EXISTS athlete_staff_notes_platform_superuser_select ON public.athlete_staff_notes;
CREATE POLICY athlete_staff_notes_platform_superuser_select
  ON public.athlete_staff_notes FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_staff_notes_platform_superuser_delete ON public.athlete_staff_notes;
CREATE POLICY athlete_staff_notes_platform_superuser_delete
  ON public.athlete_staff_notes FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_staff_notes_platform_superuser_update ON public.athlete_staff_notes;
CREATE POLICY athlete_staff_notes_platform_superuser_update
  ON public.athlete_staff_notes FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());
