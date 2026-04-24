-- Run in Supabase SQL editor before deploying app changes that select first_name / last_name.
-- Migrates legacy full_name into first_name so display helpers show the same string until
-- staff split names in the athlete profile.

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- One-time backfill: entire legacy name lives in first_name until manually split in the app.
UPDATE public.athletes
SET first_name = trim(full_name)
WHERE trim(COALESCE(first_name, '')) = ''
  AND trim(COALESCE(full_name, '')) <> '';

-- last_name remains null until set in the UI. The app keeps `full_name` in sync on save.
