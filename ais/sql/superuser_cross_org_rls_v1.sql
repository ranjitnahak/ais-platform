-- AIS — Allow platform superusers to read cross-org roster data (org switcher).
-- Symptom: superuser selects JSW Sports; teams/athletes queries return [] while home org works.
-- Run in Supabase SQL editor (or via CLI) as a privileged role.

CREATE OR REPLACE FUNCTION public.is_platform_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND (
        u.role IS NOT NULL
        AND lower(trim(u.role::text)) = 'superuser'
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = u.id
            AND lower(trim(r.name)) = 'superuser'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_superuser() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_superuser() TO authenticated;

-- SELECT policies (OR-combined with existing org-scoped policies)
DROP POLICY IF EXISTS teams_platform_superuser_select ON public.teams;
CREATE POLICY teams_platform_superuser_select
  ON public.teams FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS athletes_platform_superuser_select ON public.athletes;
CREATE POLICY athletes_platform_superuser_select
  ON public.athletes FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_teams_platform_superuser_select ON public.athlete_teams;
CREATE POLICY athlete_teams_platform_superuser_select
  ON public.athlete_teams FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS organisations_platform_superuser_select ON public.organisations;
CREATE POLICY organisations_platform_superuser_select
  ON public.organisations FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS assessment_sessions_platform_superuser_select ON public.assessment_sessions;
CREATE POLICY assessment_sessions_platform_superuser_select
  ON public.assessment_sessions FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS assessment_results_platform_superuser_select ON public.assessment_results;
CREATE POLICY assessment_results_platform_superuser_select
  ON public.assessment_results FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS periodisation_plans_platform_superuser_select ON public.periodisation_plans;
CREATE POLICY periodisation_plans_platform_superuser_select
  ON public.periodisation_plans FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_rows_platform_superuser_select ON public.plan_rows;
CREATE POLICY plan_rows_platform_superuser_select
  ON public.plan_rows FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_cells_platform_superuser_select ON public.plan_cells;
CREATE POLICY plan_cells_platform_superuser_select
  ON public.plan_cells FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS plan_templates_platform_superuser_select ON public.plan_templates;
CREATE POLICY plan_templates_platform_superuser_select
  ON public.plan_templates FOR SELECT TO authenticated
  USING (public.is_platform_superuser());
