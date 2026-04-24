-- S&C Pro: optional per-athlete programme assignment.
-- Run manually in Supabase SQL Editor (not executed by the app).

ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS athlete_id
  uuid REFERENCES public.athletes (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.programmes.athlete_id IS
  'If set, this programme is assigned to a specific athlete rather than a team. Mutually exclusive with team assignment via sessions.team_id.';
