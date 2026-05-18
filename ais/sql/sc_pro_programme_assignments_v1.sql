-- S&C Pro — explicit programme ↔ team / athlete assignments (v1)
-- Run in Supabase SQL editor after public.programmes / teams / athletes exist.
--
-- Rules:
--   * programme_teams: programme is offered to every athlete on that team.
--   * programme_athletes: programme is offered only to those athletes.
--   * Both may exist on the same programme (union for roster display).
-- Legacy: programmes.athlete_id may still exist; backfill into programme_athletes, then clear if desired.

CREATE TABLE IF NOT EXISTS public.programme_teams (
  programme_id uuid NOT NULL REFERENCES public.programmes (id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (programme_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_programme_teams_org_team
  ON public.programme_teams (org_id, team_id);

CREATE INDEX IF NOT EXISTS idx_programme_teams_org_programme
  ON public.programme_teams (org_id, programme_id);

CREATE TABLE IF NOT EXISTS public.programme_athletes (
  programme_id uuid NOT NULL REFERENCES public.programmes (id) ON DELETE CASCADE,
  athlete_id   uuid NOT NULL REFERENCES public.athletes (id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (programme_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_programme_athletes_org_athlete
  ON public.programme_athletes (org_id, athlete_id);

CREATE INDEX IF NOT EXISTS idx_programme_athletes_org_programme
  ON public.programme_athletes (org_id, programme_id);

-- One-time backfill from legacy single-athlete column (idempotent)
INSERT INTO public.programme_athletes (programme_id, athlete_id, org_id)
SELECT p.id, p.athlete_id, p.org_id
FROM public.programmes p
WHERE p.athlete_id IS NOT NULL
ON CONFLICT (programme_id, athlete_id) DO NOTHING;

-- Row-level security: run ais/sql/sc_pro_programme_assignments_rls_v1.sql so the
-- client can SELECT/INSERT/DELETE assignment rows (otherwise inserts fail with RLS).
