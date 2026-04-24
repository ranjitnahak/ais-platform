-- =============================================================================
-- S&C Pro — schema migration (v1)
-- =============================================================================
-- Source of truth: ais/docs/SC_Pro_Architecture_v1.0.md §3 (Database Schema)
-- Supabase / PostgreSQL. Review before running in SQL Editor.
--
-- Includes:
--   * PostgreSQL ENUM types (prefixed sc_pro_* to avoid collisions)
--   * S&C Pro–owned tables per §2.3 / §3.1
--   * Additive ALTER on public.sessions (Platform Core) — only columns that
--     do not duplicate existing AIS session fields (see mapping note)
--
-- Notes:
--   * Sessions: see SESSION TABLE — COLUMN MAPPING NOTE below. Do not add
--     parallel columns for SC Pro names that already exist under AIS names.
--   * exercise_library.org_id is NULLABLE per SC Pro spec (null = system default).
--     This is a deliberate exception to AIS Guidelines §4.1 for this table only;
--     RLS (V2) must treat is_system_default / org_id null as platform-global reads.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM types (SC Pro §3.1)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.sc_pro_phase_type AS ENUM (
    'accumulation', 'intensification', 'realisation', 'transition', 'general'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_training_age AS ENUM (
    'beginner', 'intermediate', 'advanced', 'elite'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_difficulty AS ENUM (
    'low', 'moderate', 'high', 'very_high'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_session_category AS ENUM (
    'strength', 'power', 'speed', 'conditioning', 'mobility', 'recovery', 'mixed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_block_type AS ENUM (
    'warmup', 'main', 'accessory', 'cooldown', 'conditioning', 'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_block_format AS ENUM (
    'straight', 'superset', 'circuit', 'emom', 'amrap', 'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_prescription_type AS ENUM (
    'absolute', 'pct_1rm', 'rpe', 'rir', 'velocity', 'max', 'time', 'distance', 'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_movement_pattern AS ENUM (
    'push', 'pull', 'hinge', 'squat', 'carry', 'rotate', 'jump', 'sprint', 'isometric', 'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_library_parameter_1 AS ENUM (
    'reps', 'time', 'distance', 'calories'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_library_parameter_2 AS ENUM (
    'weight_kg', 'weight_pct', 'rpe', 'rir', 'velocity', 'none'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sc_pro_rm_source AS ENUM (
    'tested', 'estimated', 'coach_entered'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

BEGIN;

-- -----------------------------------------------------------------------------
-- loading_schemes — §2.3 (detail left to product; minimal reusable schemes row)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loading_schemes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_loading_schemes_org
  ON public.loading_schemes (org_id);

-- -----------------------------------------------------------------------------
-- exercise_library — §3.1 (org_id nullable = system default)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_library (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid REFERENCES public.organisations (id) ON DELETE CASCADE,
  name                  text NOT NULL,
  movement_pattern      public.sc_pro_movement_pattern NOT NULL DEFAULT 'custom',
  primary_muscle_group  text,
  equipment_required    text[] NOT NULL DEFAULT '{}'::text[],
  parameter_1           public.sc_pro_library_parameter_1 NOT NULL DEFAULT 'reps',
  parameter_2           public.sc_pro_library_parameter_2 NOT NULL DEFAULT 'weight_kg',
  video_url             text,
  coaching_cues         text,
  reference_max_id      uuid,
  suggested_swap_ids    uuid[] NOT NULL DEFAULT '{}'::uuid[],
  tags                  text[] NOT NULL DEFAULT '{}'::text[],
  is_system_default     boolean NOT NULL DEFAULT false,
  created_by            uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_library_org_name
  ON public.exercise_library (org_id, name);

CREATE INDEX IF NOT EXISTS idx_exercise_library_movement
  ON public.exercise_library (movement_pattern);

DO $$ BEGIN
  ALTER TABLE public.exercise_library
    ADD CONSTRAINT exercise_library_reference_max_id_fkey
    FOREIGN KEY (reference_max_id) REFERENCES public.exercise_library (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- programmes — §3.1
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.programmes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  name           text NOT NULL,
  sport          text,
  phase_type     public.sc_pro_phase_type NOT NULL DEFAULT 'general',
  training_age   public.sc_pro_training_age NOT NULL DEFAULT 'intermediate',
  difficulty     public.sc_pro_difficulty NOT NULL DEFAULT 'moderate',
  description    text,
  is_template    boolean NOT NULL DEFAULT false,
  created_by     uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programmes_org
  ON public.programmes (org_id);

CREATE INDEX IF NOT EXISTS idx_programmes_org_phase
  ON public.programmes (org_id, phase_type);

ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS athlete_id uuid REFERENCES public.athletes (id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- programme_weeks — §3.1
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.programme_weeks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id   uuid NOT NULL REFERENCES public.programmes (id) ON DELETE CASCADE,
  org_id         uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  week_number    integer NOT NULL,
  label          text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programme_id, week_number),
  CONSTRAINT programme_weeks_week_number_positive
    CHECK (week_number >= 1)
);

CREATE INDEX IF NOT EXISTS idx_programme_weeks_org_programme
  ON public.programme_weeks (org_id, programme_id);

-- -----------------------------------------------------------------------------
-- programme_sessions — §2.3 / §3.1 (week ↔ shared session)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.programme_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  programme_week_id  uuid NOT NULL REFERENCES public.programme_weeks (id) ON DELETE CASCADE,
  session_id         uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programme_week_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_programme_sessions_org_week
  ON public.programme_sessions (org_id, programme_week_id);

CREATE INDEX IF NOT EXISTS idx_programme_sessions_session
  ON public.programme_sessions (org_id, session_id);

-- -----------------------------------------------------------------------------
-- session_blocks — §3.1
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  label       text NOT NULL,
  block_type  public.sc_pro_block_type NOT NULL DEFAULT 'main',
  format      public.sc_pro_block_format NOT NULL DEFAULT 'straight',
  sort_order  integer NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_blocks_org_session
  ON public.session_blocks (org_id, session_id);

-- -----------------------------------------------------------------------------
-- session_exercises — §3.1 (block_id, exercise_id per spec)
-- Primary + optional secondary prescription (e.g. %1RM load + RPE ceiling).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_exercises (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id            uuid NOT NULL REFERENCES public.session_blocks (id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  exercise_id         uuid NOT NULL REFERENCES public.exercise_library (id) ON DELETE RESTRICT,
  sort_order          integer NOT NULL DEFAULT 0,
  sets                integer,
  -- Primary prescription (required)
  prescription_type   public.sc_pro_prescription_type NOT NULL DEFAULT 'absolute',
  prescription_value  numeric,
  -- Secondary prescription (optional — e.g. RPE target alongside %1RM)
  secondary_prescription_type   public.sc_pro_prescription_type,
  secondary_prescription_value  numeric,
  reps                integer,
  reps_range_high     integer,
  tempo               text,
  rest_seconds        integer,
  is_optional         boolean NOT NULL DEFAULT false,
  coach_note          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_exercises_secondary_prescription_pair_chk
    CHECK (
      (secondary_prescription_type IS NULL AND secondary_prescription_value IS NULL)
      OR (secondary_prescription_type IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_session_exercises_org_block
  ON public.session_exercises (org_id, block_id);

CREATE INDEX IF NOT EXISTS idx_session_exercises_exercise
  ON public.session_exercises (org_id, exercise_id);

-- Idempotent for DBs that created session_exercises before secondary prescription:
ALTER TABLE public.session_exercises
  ADD COLUMN IF NOT EXISTS secondary_prescription_type public.sc_pro_prescription_type;

ALTER TABLE public.session_exercises
  ADD COLUMN IF NOT EXISTS secondary_prescription_value numeric;

ALTER TABLE public.session_exercises
  ADD COLUMN IF NOT EXISTS superset_group integer;

DO $$ BEGIN
  ALTER TABLE public.session_exercises
    ADD CONSTRAINT session_exercises_secondary_prescription_pair_chk
    CHECK (
      (secondary_prescription_type IS NULL AND secondary_prescription_value IS NULL)
      OR (secondary_prescription_type IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

-- -----------------------------------------------------------------------------
-- athlete_1rm — §3.1
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.athlete_1rm (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES public.athletes (id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  exercise_id     uuid NOT NULL REFERENCES public.exercise_library (id) ON DELETE CASCADE,
  tested_1rm      numeric,
  working_max     numeric,
  estimated_1rm   numeric,
  test_date       date,
  source          public.sc_pro_rm_source,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_athlete_1rm_org_athlete
  ON public.athlete_1rm (org_id, athlete_id);

-- -----------------------------------------------------------------------------
-- athlete_exercise_logs — §3.1 (session + exercise + set; not FK to session_exercises)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.athlete_exercise_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  exercise_id      uuid NOT NULL REFERENCES public.exercise_library (id) ON DELETE CASCADE,
  athlete_id       uuid NOT NULL REFERENCES public.athletes (id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  set_number       integer NOT NULL,
  actual_reps      integer,
  actual_weight    numeric,
  actual_rpe       numeric(3, 1),
  actual_rir       integer,
  actual_velocity  numeric,
  completed        boolean NOT NULL DEFAULT false,
  notes            text,
  logged_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, athlete_id, exercise_id, set_number)
);

CREATE INDEX IF NOT EXISTS idx_athlete_exercise_logs_org_athlete
  ON public.athlete_exercise_logs (org_id, athlete_id);

CREATE INDEX IF NOT EXISTS idx_athlete_exercise_logs_session
  ON public.athlete_exercise_logs (org_id, session_id);

-- -----------------------------------------------------------------------------
-- sessions (Platform Core) — additive columns (no duplicates of AIS fields)
-- -----------------------------------------------------------------------------
-- SESSION TABLE — COLUMN MAPPING NOTE
-- AIS naming → S&C Pro naming (same column, different label in each product)
--   session_type   → category
--   start_time     → session_time
--   rpe_planned    → planned_rpe
--   rpe_actual     → actual_rpe
--   duration_planned → planned_duration_min
--   duration_actual  → actual_duration_min
-- These are the same physical column — both products read/write the same row.
-- Do not create duplicate columns. Resolve naming in a single future migration
-- if a canonical name is needed.
-- -----------------------------------------------------------------------------

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS programme_week_id uuid REFERENCES public.programme_weeks (id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS plan_cell_id uuid REFERENCES public.plan_cells (id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS coach_instructions text;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS publish_at timestamptz;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

UPDATE public.sessions SET name = 'Session' WHERE name IS NULL;

COMMIT;

-- =============================================================================
-- Post-run (optional, separate migration or app responsibility):
--   * platform_events table + RLS policies (V2)
--   * Seed exercise_library system defaults (org_id NULL, is_system_default true)
--   * If a canonical sessions column naming pass is desired, rename AIS columns
--     once (see SESSION TABLE — COLUMN MAPPING NOTE); do not add parallel SC columns.
-- =============================================================================
