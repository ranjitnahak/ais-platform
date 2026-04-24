ALTER TABLE public.plan_rows
  ADD COLUMN IF NOT EXISTS display_label text;
