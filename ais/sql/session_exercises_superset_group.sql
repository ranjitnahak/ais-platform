-- S&C Pro: optional superset grouping for session_exercises (coach-linked pairs).
-- Run against the same database as sc_pro_schema_v1.sql.

ALTER TABLE public.session_exercises
  ADD COLUMN IF NOT EXISTS superset_group integer;

COMMENT ON COLUMN public.session_exercises.superset_group IS
  'Exercises in the same block with the same non-null value are shown as a linked superset; NULL = unlinked.';
