-- Allow half-step planned RPE (0–10, 0.5 increments) on sessions.
-- Run in Supabase → SQL Editor before relying on decimal planned RPE in the UI.

ALTER TABLE public.sessions
  ALTER COLUMN rpe_planned TYPE numeric(3, 1)
  USING rpe_planned::numeric(3, 1);
