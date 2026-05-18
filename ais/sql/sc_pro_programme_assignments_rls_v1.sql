-- S&C Pro — RLS for programme_teams / programme_athletes (v1)
-- Run in Supabase SQL editor after sc_pro_programme_assignments_v1.sql.
--
-- Fixes: "new row violates row-level security policy for table 'programme_athletes'".
-- Policies allow anon + authenticated (browser uses the anon key with a user JWT).
-- Rows must tie programme, team/athlete, and org_id consistently (multi-tenant safe).

ALTER TABLE public.programme_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_teams ENABLE ROW LEVEL SECURITY;

-- programme_athletes ----------------------------------------------------------

DROP POLICY IF EXISTS programme_athletes_sc_v1 ON public.programme_athletes;

CREATE POLICY programme_athletes_sc_v1
  ON public.programme_athletes
  FOR ALL
  TO authenticated, anon
  USING (
    org_id = (SELECT p.org_id FROM public.programmes p WHERE p.id = programme_athletes.programme_id)
    AND EXISTS (
      SELECT 1
      FROM public.athletes a
      WHERE a.id = programme_athletes.athlete_id
        AND a.org_id = programme_athletes.org_id
    )
  )
  WITH CHECK (
    org_id = (SELECT p.org_id FROM public.programmes p WHERE p.id = programme_id)
    AND EXISTS (
      SELECT 1 FROM public.athletes a WHERE a.id = athlete_id AND a.org_id = org_id
    )
  );

COMMENT ON POLICY programme_athletes_sc_v1 ON public.programme_athletes IS
  'SC Pro v1: CRUD when org_id matches programme and athlete (same org).';

-- programme_teams -------------------------------------------------------------

DROP POLICY IF EXISTS programme_teams_sc_v1 ON public.programme_teams;

CREATE POLICY programme_teams_sc_v1
  ON public.programme_teams
  FOR ALL
  TO authenticated, anon
  USING (
    org_id = (SELECT p.org_id FROM public.programmes p WHERE p.id = programme_teams.programme_id)
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = programme_teams.team_id
        AND t.org_id = programme_teams.org_id
    )
  )
  WITH CHECK (
    org_id = (SELECT p.org_id FROM public.programmes p WHERE p.id = programme_id)
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.org_id = org_id)
  );

COMMENT ON POLICY programme_teams_sc_v1 ON public.programme_teams IS
  'SC Pro v1: CRUD when org_id matches programme and team (same org).';

-- Grants (safe if already granted)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_athletes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_teams TO authenticated, anon;
