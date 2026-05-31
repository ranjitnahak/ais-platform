-- AIS — RLS policies and indexes for staff_observations (table already exists).
-- submitted_by references public.users(id); resolve via auth_id = auth.uid().

-- Indexes -------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS staff_observations_org_id_idx
  ON public.staff_observations (org_id);

CREATE INDEX IF NOT EXISTS staff_observations_team_id_idx
  ON public.staff_observations (team_id);

CREATE INDEX IF NOT EXISTS staff_observations_submitted_by_idx
  ON public.staff_observations (submitted_by);

CREATE INDEX IF NOT EXISTS staff_observations_observation_date_idx
  ON public.staff_observations (observation_date);

-- Org-scoped policies -------------------------------------------------------

DROP POLICY IF EXISTS staff_observations_select ON public.staff_observations;
CREATE POLICY staff_observations_select
  ON public.staff_observations FOR SELECT TO authenticated
  USING (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS staff_observations_insert ON public.staff_observations;
CREATE POLICY staff_observations_insert
  ON public.staff_observations FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (
      SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
    AND submitted_by = (
      SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS staff_observations_update ON public.staff_observations;
CREATE POLICY staff_observations_update
  ON public.staff_observations FOR UPDATE TO authenticated
  USING (
    submitted_by = (
      SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    submitted_by = (
      SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS staff_observations_delete ON public.staff_observations;
CREATE POLICY staff_observations_delete
  ON public.staff_observations FOR DELETE TO authenticated
  USING (
    submitted_by = (
      SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    )
  );

-- Superuser bypass (org switcher) — depends on is_platform_superuser() --------

DROP POLICY IF EXISTS staff_observations_platform_superuser_select ON public.staff_observations;
CREATE POLICY staff_observations_platform_superuser_select
  ON public.staff_observations FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS staff_observations_platform_superuser_insert ON public.staff_observations;
CREATE POLICY staff_observations_platform_superuser_insert
  ON public.staff_observations FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS staff_observations_platform_superuser_update ON public.staff_observations;
CREATE POLICY staff_observations_platform_superuser_update
  ON public.staff_observations FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS staff_observations_platform_superuser_delete ON public.staff_observations;
CREATE POLICY staff_observations_platform_superuser_delete
  ON public.staff_observations FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
