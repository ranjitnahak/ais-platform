-- AIS — RLS for dexa_scans (table exists; RLS was enabled without policies).
-- Symptom: "new row violates row-level security policy for table dexa_scans" on save.
-- Run in Supabase SQL editor. Depends on public.is_platform_superuser().

-- Indexes -------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS dexa_scans_org_id_idx
  ON public.dexa_scans (org_id);

CREATE INDEX IF NOT EXISTS dexa_scans_athlete_id_idx
  ON public.dexa_scans (athlete_id);

CREATE INDEX IF NOT EXISTS dexa_scans_scan_date_idx
  ON public.dexa_scans (scan_date DESC);

-- Org-scoped policies (authenticated staff) -------------------------------

DROP POLICY IF EXISTS dexa_scans_select ON public.dexa_scans;
CREATE POLICY dexa_scans_select
  ON public.dexa_scans FOR SELECT TO authenticated
  USING (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS dexa_scans_insert ON public.dexa_scans;
CREATE POLICY dexa_scans_insert
  ON public.dexa_scans FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
    AND (
      created_by IS NULL
      OR created_by = (
        SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.athletes a
      WHERE a.id = athlete_id
        AND a.org_id = dexa_scans.org_id
    )
  );

DROP POLICY IF EXISTS dexa_scans_update ON public.dexa_scans;
CREATE POLICY dexa_scans_update
  ON public.dexa_scans FOR UPDATE TO authenticated
  USING (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS dexa_scans_delete ON public.dexa_scans;
CREATE POLICY dexa_scans_delete
  ON public.dexa_scans FOR DELETE TO authenticated
  USING (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

-- Superuser bypass (org switcher) -----------------------------------------

DROP POLICY IF EXISTS dexa_scans_platform_superuser_select ON public.dexa_scans;
CREATE POLICY dexa_scans_platform_superuser_select
  ON public.dexa_scans FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS dexa_scans_platform_superuser_insert ON public.dexa_scans;
CREATE POLICY dexa_scans_platform_superuser_insert
  ON public.dexa_scans FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS dexa_scans_platform_superuser_update ON public.dexa_scans;
CREATE POLICY dexa_scans_platform_superuser_update
  ON public.dexa_scans FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS dexa_scans_platform_superuser_delete ON public.dexa_scans;
CREATE POLICY dexa_scans_platform_superuser_delete
  ON public.dexa_scans FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
