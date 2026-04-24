-- Safe additive DDL (no drops, no data changes).
-- Run in Supabase → SQL Editor (or psql with your DB connection) before relying on session library UI.

-- Session library items (Periodisation drawer + library search)
ALTER TABLE IF EXISTS public.session_library_items
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS name text;

-- Team sessions (weekly drawer upsert)
ALTER TABLE IF EXISTS public.sessions
  ADD COLUMN IF NOT EXISTS session_type text,
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS screening_notes text,
  ADD COLUMN IF NOT EXISTS content_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rpe_planned integer,
  ADD COLUMN IF NOT EXISTS rpe_actual integer,
  ADD COLUMN IF NOT EXISTS duration_planned integer,
  ADD COLUMN IF NOT EXISTS duration_actual integer,
  ADD COLUMN IF NOT EXISTS recovery_modality text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS plan_id uuid;

-- Plan templates (create-plan modal)
ALTER TABLE IF EXISTS public.plan_templates
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rows_config jsonb DEFAULT '[]'::jsonb;

-- Plan-level week notes (weekly view)
ALTER TABLE IF EXISTS public.periodisation_plans
  ADD COLUMN IF NOT EXISTS notes text;
