-- Optional: if plan_cells already has `color`, you can migrate data in a follow-up.
ALTER TABLE public.plan_cells
  ADD COLUMN IF NOT EXISTS value_color text;
