-- AIS — Allow platform superusers to write assessment data across orgs (org switcher).
-- Symptom: "new row violates row-level security policy for table \"assessment_sessions\"" on Log → Assessment Save.
-- Cause: assessment_sessions_isolation enforces org_id = get_current_org_id() (home org in users table);
--   superuser UI targets active org via org switcher (e.g. JSW Sports) while get_current_org_id() stays on home org (e.g. AKFI).
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql
-- Note: .insert().select() requires SELECT visibility on the new row (superuser SELECT bypass already exists).

-- assessment_sessions
DROP POLICY IF EXISTS assessment_sessions_platform_superuser_insert ON public.assessment_sessions;
CREATE POLICY assessment_sessions_platform_superuser_insert
  ON public.assessment_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS assessment_sessions_platform_superuser_update ON public.assessment_sessions;
CREATE POLICY assessment_sessions_platform_superuser_update
  ON public.assessment_sessions FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS assessment_sessions_platform_superuser_delete ON public.assessment_sessions;
CREATE POLICY assessment_sessions_platform_superuser_delete
  ON public.assessment_sessions FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- assessment_results (upsert/delete after session exists)
DROP POLICY IF EXISTS assessment_results_platform_superuser_insert ON public.assessment_results;
CREATE POLICY assessment_results_platform_superuser_insert
  ON public.assessment_results FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS assessment_results_platform_superuser_update ON public.assessment_results;
CREATE POLICY assessment_results_platform_superuser_update
  ON public.assessment_results FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS assessment_results_platform_superuser_delete ON public.assessment_results;
CREATE POLICY assessment_results_platform_superuser_delete
  ON public.assessment_results FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
