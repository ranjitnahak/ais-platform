-- AIS — Allow platform superusers to write periodisation data (org switcher + new org setup).
-- Symptom: "new row violates row-level security policy for table \"periodisation_plans\"" on Create plan.
-- Evidence: authenticated superuser, org_id matches home org; error 42501 on INSERT.
-- Cause: periodisation_plans had superuser SELECT bypass only; base INSERT policy still blocks
--   (team membership / created_by / org isolation). Same pattern as superuser_teams_insert_rls_v1.sql.
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql

DROP POLICY IF EXISTS periodisation_plans_platform_superuser_insert ON public.periodisation_plans;
CREATE POLICY periodisation_plans_platform_superuser_insert
  ON public.periodisation_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS periodisation_plans_platform_superuser_update ON public.periodisation_plans;
CREATE POLICY periodisation_plans_platform_superuser_update
  ON public.periodisation_plans FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS periodisation_plans_platform_superuser_delete ON public.periodisation_plans;
CREATE POLICY periodisation_plans_platform_superuser_delete
  ON public.periodisation_plans FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_rows_platform_superuser_insert ON public.plan_rows;
CREATE POLICY plan_rows_platform_superuser_insert
  ON public.plan_rows FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_rows_platform_superuser_update ON public.plan_rows;
CREATE POLICY plan_rows_platform_superuser_update
  ON public.plan_rows FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_rows_platform_superuser_delete ON public.plan_rows;
CREATE POLICY plan_rows_platform_superuser_delete
  ON public.plan_rows FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_cells_platform_superuser_insert ON public.plan_cells;
CREATE POLICY plan_cells_platform_superuser_insert
  ON public.plan_cells FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_cells_platform_superuser_update ON public.plan_cells;
CREATE POLICY plan_cells_platform_superuser_update
  ON public.plan_cells FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_cells_platform_superuser_delete ON public.plan_cells;
CREATE POLICY plan_cells_platform_superuser_delete
  ON public.plan_cells FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
