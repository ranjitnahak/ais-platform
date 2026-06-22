-- AIS — Allow platform superusers to read/write assessment config across orgs.
-- Symptom: Settings → Assessments → Test Battery empty for superuser in switched org
--   (e.g. home org AKFI a2000000, org switcher on JSW Sports a3000000).
-- Cause: test_definitions / benchmark_tiers / benchmarks isolation uses
--   org_id = get_current_org_id(); superuser_cross_org_rls_v1.sql omitted these tables.
-- Requires: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql

-- test_definitions
DROP POLICY IF EXISTS test_definitions_platform_superuser_select ON public.test_definitions;
CREATE POLICY test_definitions_platform_superuser_select
  ON public.test_definitions FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS test_definitions_platform_superuser_insert ON public.test_definitions;
CREATE POLICY test_definitions_platform_superuser_insert
  ON public.test_definitions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS test_definitions_platform_superuser_update ON public.test_definitions;
CREATE POLICY test_definitions_platform_superuser_update
  ON public.test_definitions FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS test_definitions_platform_superuser_delete ON public.test_definitions;
CREATE POLICY test_definitions_platform_superuser_delete
  ON public.test_definitions FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- benchmark_tiers (Settings → Benchmarks tab)
DROP POLICY IF EXISTS benchmark_tiers_platform_superuser_select ON public.benchmark_tiers;
CREATE POLICY benchmark_tiers_platform_superuser_select
  ON public.benchmark_tiers FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS benchmark_tiers_platform_superuser_insert ON public.benchmark_tiers;
CREATE POLICY benchmark_tiers_platform_superuser_insert
  ON public.benchmark_tiers FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS benchmark_tiers_platform_superuser_update ON public.benchmark_tiers;
CREATE POLICY benchmark_tiers_platform_superuser_update
  ON public.benchmark_tiers FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS benchmark_tiers_platform_superuser_delete ON public.benchmark_tiers;
CREATE POLICY benchmark_tiers_platform_superuser_delete
  ON public.benchmark_tiers FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- benchmarks (legacy table; squad/athlete scoring)
DROP POLICY IF EXISTS benchmarks_platform_superuser_select ON public.benchmarks;
CREATE POLICY benchmarks_platform_superuser_select
  ON public.benchmarks FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS benchmarks_platform_superuser_insert ON public.benchmarks;
CREATE POLICY benchmarks_platform_superuser_insert
  ON public.benchmarks FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS benchmarks_platform_superuser_update ON public.benchmarks;
CREATE POLICY benchmarks_platform_superuser_update
  ON public.benchmarks FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS benchmarks_platform_superuser_delete ON public.benchmarks;
CREATE POLICY benchmarks_platform_superuser_delete
  ON public.benchmarks FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
