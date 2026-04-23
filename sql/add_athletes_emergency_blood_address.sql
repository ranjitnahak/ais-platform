-- Run in Supabase SQL editor after deploying UI that collects these fields.

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS address text;
