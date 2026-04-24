-- Optional third prescription slot (e.g. weight + velocity + %1RM).
-- Idempotent: safe to run on existing DBs.

ALTER TABLE public.session_exercises
  ADD COLUMN IF NOT EXISTS tertiary_prescription_type public.sc_pro_prescription_type,
  ADD COLUMN IF NOT EXISTS tertiary_prescription_value numeric;

DO $$ BEGIN
  ALTER TABLE public.session_exercises
    ADD CONSTRAINT session_exercises_tertiary_prescription_pair_chk
    CHECK (
      (tertiary_prescription_type IS NULL AND tertiary_prescription_value IS NULL)
      OR (tertiary_prescription_type IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
