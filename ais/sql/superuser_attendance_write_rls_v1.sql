-- AIS — Allow platform superusers to read/write attendance across orgs (org switcher).
-- Symptom: "new row violates row-level security policy for table \"attendance_records\"" on Absent/Late.
-- Cause: attendance_* policies enforce org_id = get_current_org_id() (home org); superuser UI
--   targets active org via org switcher. Same pattern as superuser_sessions_write_rls_v1.sql.
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql
-- Note: .insert().select() requires SELECT visibility on the new row (RETURNING check).

DROP POLICY IF EXISTS attendance_records_platform_superuser_select ON public.attendance_records;
CREATE POLICY attendance_records_platform_superuser_select
  ON public.attendance_records FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS attendance_records_platform_superuser_insert ON public.attendance_records;
CREATE POLICY attendance_records_platform_superuser_insert
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS attendance_records_platform_superuser_delete ON public.attendance_records;
CREATE POLICY attendance_records_platform_superuser_delete
  ON public.attendance_records FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
