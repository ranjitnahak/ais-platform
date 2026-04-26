-- S&C Pro — RLS so the browser (anon / authenticated) can read taxonomy rows.
--
-- Symptom in sc-pro: "Add exercise" shows "No regions loaded" with empty filters
-- but no Supabase error — PostgREST returns [] when RLS denies every row.
--
-- Run this in the Supabase SQL editor after public.exercise_categories exists.
-- Tighten policies in V2 when JWT carries org_id and writes are org-scoped.

-- Ensure API roles can read the table at all (RLS still applies per policy).
GRANT SELECT ON public.exercise_categories TO anon, authenticated;

ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercise_categories_select_taxonomy_v1 ON public.exercise_categories;

CREATE POLICY exercise_categories_select_taxonomy_v1
  ON public.exercise_categories
  AS PERMISSIVE
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY exercise_categories_select_taxonomy_v1 ON public.exercise_categories IS
  'V1: allow read of system (org_id null) and org rows for sc-pro filters. Replace with org-scoped USING when auth model is wired.';

-- If you use public.exercise_tags and see empty tag joins, apply the same pattern there:
--   GRANT SELECT ...; ENABLE ROW LEVEL SECURITY; CREATE POLICY ... FOR SELECT TO anon, authenticated USING (true);
