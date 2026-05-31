-- AIS — Persisted Staff Logs reports for staff-only shareable links.
-- Snapshot JSON holds filtered roster + notes at share time.

CREATE TABLE IF NOT EXISTS public.staff_log_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  date_range_start date,
  date_range_end date,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS staff_log_reports_org_id_idx
  ON public.staff_log_reports (org_id);

CREATE INDEX IF NOT EXISTS staff_log_reports_team_id_idx
  ON public.staff_log_reports (team_id);

CREATE INDEX IF NOT EXISTS staff_log_reports_created_at_idx
  ON public.staff_log_reports (created_at DESC);

ALTER TABLE public.staff_log_reports ENABLE ROW LEVEL SECURITY;

-- Org-scoped read for authenticated staff in the same organisation
DROP POLICY IF EXISTS staff_log_reports_select ON public.staff_log_reports;
CREATE POLICY staff_log_reports_select
  ON public.staff_log_reports FOR SELECT TO authenticated
  USING (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS staff_log_reports_insert ON public.staff_log_reports;
CREATE POLICY staff_log_reports_insert
  ON public.staff_log_reports FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
    AND created_by = (
      SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

-- Superuser bypass (org switcher)
DROP POLICY IF EXISTS staff_log_reports_platform_superuser_select ON public.staff_log_reports;
CREATE POLICY staff_log_reports_platform_superuser_select
  ON public.staff_log_reports FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS staff_log_reports_platform_superuser_insert ON public.staff_log_reports;
CREATE POLICY staff_log_reports_platform_superuser_insert
  ON public.staff_log_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());
