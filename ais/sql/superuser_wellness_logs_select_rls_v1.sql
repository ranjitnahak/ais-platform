-- AIS — Allow platform superusers to read wellness_logs across orgs (org switcher).
-- Symptom: wellness dashboard shows 0 submissions while wellness_logs rows exist for active org.
-- Cause: wellness_logs_isolation enforces org_id = get_current_org_id() (home org); no superuser bypass.

DROP POLICY IF EXISTS wellness_logs_platform_superuser_select ON public.wellness_logs;
CREATE POLICY wellness_logs_platform_superuser_select
  ON public.wellness_logs FOR SELECT TO authenticated
  USING (public.is_platform_superuser());
