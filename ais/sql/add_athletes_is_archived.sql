-- Add is_archived column if it doesn't already exist (run in Supabase SQL editor)
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
