-- S&C Pro: optional calendar anchor for programme week grid (Week 1 Mon–Sun).
-- Run in Supabase after public.programmes exists. App falls back to created_at when null.

ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS start_date date;

COMMENT ON COLUMN public.programmes.start_date IS
  'Local calendar date used with Monday-aligned week grid; Week 1 is the week containing this date. Null = use created_at.';
