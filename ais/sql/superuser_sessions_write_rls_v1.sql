-- AIS — Allow platform superusers to write sessions across orgs (org switcher).
-- Symptom: "new row violates row-level security policy for table \"sessions\"" on calendar Save session.
-- Cause: sessions_isolation enforces org_id = get_current_org_id() (home org); superuser UI
--   targets active org via org switcher. Same pattern as superuser_periodisation_write_rls_v1.sql.
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql
-- Note: .insert().select() requires SELECT visibility on the new row (RETURNING check).

DROP POLICY IF EXISTS sessions_platform_superuser_select ON public.sessions;
CREATE POLICY sessions_platform_superuser_select
  ON public.sessions FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS session_athlete_logs_platform_superuser_select ON public.session_athlete_logs;
CREATE POLICY session_athlete_logs_platform_superuser_select
  ON public.session_athlete_logs FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS sessions_platform_superuser_insert ON public.sessions;
CREATE POLICY sessions_platform_superuser_insert
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS sessions_platform_superuser_update ON public.sessions;
CREATE POLICY sessions_platform_superuser_update
  ON public.sessions FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS sessions_platform_superuser_delete ON public.sessions;
CREATE POLICY sessions_platform_superuser_delete
  ON public.sessions FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS session_athlete_logs_platform_superuser_insert ON public.session_athlete_logs;
CREATE POLICY session_athlete_logs_platform_superuser_insert
  ON public.session_athlete_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS session_athlete_logs_platform_superuser_update ON public.session_athlete_logs;
CREATE POLICY session_athlete_logs_platform_superuser_update
  ON public.session_athlete_logs FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS session_athlete_logs_platform_superuser_delete ON public.session_athlete_logs;
CREATE POLICY session_athlete_logs_platform_superuser_delete
  ON public.session_athlete_logs FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
