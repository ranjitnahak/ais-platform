-- =============================================================================
-- S&C Pro — system default exercise_library seed (v1)
-- =============================================================================
-- Source: SC_Pro_Architecture_v1.0.md §4.2 (Exercise Record) + movement coverage
-- Rules:
--   * org_id NULL, is_system_default true, created_by NULL (platform-global)
--   * Idempotent: partial unique index on name + INSERT ... ON CONFLICT DO NOTHING
--   * Pass 1: insert all rows (reference_max_id NULL, suggested_swap_ids empty)
--   * Pass 2: UPDATE reference_max_id by exercise name
--   * Pass 3: UPDATE suggested_swap_ids by exercise name
-- Two-pass approach is used so ON CONFLICT remains valid without hard-coded UUIDs;
-- each insert still uses gen_random_uuid() for id.
-- Do not run without reviewing; requires public.exercise_library + enum types from
-- ais/sql/sc_pro_schema_v1.sql
-- =============================================================================

-- Partial unique index: required for ON CONFLICT on system-default rows by name.
-- Predicate must match ON CONFLICT ... WHERE (...) below (PostgreSQL index inference).
CREATE UNIQUE INDEX IF NOT EXISTS ux_exercise_library_system_default_name
  ON public.exercise_library (name)
  WHERE (org_id IS NULL AND is_system_default IS TRUE);

-- -----------------------------------------------------------------------------
-- Pass 1 — INSERT all system exercises (no cross-references yet)
-- ON CONFLICT: (name) WHERE org_id IS NULL AND is_system_default
-- -----------------------------------------------------------------------------
-- Push
INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Bench Press', 'push', 'Chest / triceps', ARRAY['barbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_press','barbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'DB Bench Press', 'push', 'Chest / triceps', ARRAY['dumbbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_press','dumbbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Overhead Press', 'push', 'Shoulders / triceps', ARRAY['barbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['vertical_press','barbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Push-up', 'push', 'Chest / shoulders / triceps', ARRAY['bodyweight']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_press','bodyweight'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'DB Shoulder Press', 'push', 'Shoulders', ARRAY['dumbbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['vertical_press','dumbbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Landmine Press', 'push', 'Chest / shoulders', ARRAY['barbell','rack']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_press','landmine'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Pull-up', 'pull', 'Back / biceps', ARRAY['bodyweight']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['vertical_pull','bodyweight'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Chin-up', 'pull', 'Back / biceps', ARRAY['bodyweight']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['vertical_pull','bodyweight'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Bent Over Row', 'pull', 'Back / biceps', ARRAY['barbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_pull','barbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'DB Row', 'pull', 'Back / biceps', ARRAY['dumbbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_pull','dumbbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Seated Cable Row', 'pull', 'Back / biceps', ARRAY['cable']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_pull','cable'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Face Pull', 'pull', 'Rear delt / upper back', ARRAY['cable']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_pull','shoulder_health'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Band Pull Apart', 'pull', 'Rear delt / upper back', ARRAY['band']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['horizontal_pull','band'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Deadlift', 'hinge', 'Posterior chain', ARRAY['barbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['hinge','barbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Romanian Deadlift', 'hinge', 'Hamstrings / glutes', ARRAY['barbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['hinge','barbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'DB Romanian Deadlift', 'hinge', 'Hamstrings / glutes', ARRAY['dumbbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['hinge','dumbbell'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Rack Pull', 'hinge', 'Back / posterior chain', ARRAY['barbell','rack']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['hinge','partial_range'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Good Morning', 'hinge', 'Hamstrings / lower back', ARRAY['barbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['hinge','accessory'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Kettlebell Swing', 'hinge', 'Glutes / hamstrings', ARRAY['kettlebell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['hinge','power_endurance'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Back Squat', 'squat', 'Quads / glutes', ARRAY['barbell','rack']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['squat','bilateral'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Front Squat', 'squat', 'Quads / core', ARRAY['barbell','rack']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['squat','bilateral'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Goblet Squat', 'squat', 'Quads / glutes', ARRAY['kettlebell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['squat','learning_pattern'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Bulgarian Split Squat', 'squat', 'Quads / glutes', ARRAY['dumbbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['squat','unilateral'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Leg Press', 'squat', 'Quads / glutes', ARRAY['machine']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['squat','machine'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Box Squat', 'squat', 'Quads / glutes', ARRAY['barbell','rack']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['squat','box'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Pause Squat', 'squat', 'Quads / glutes', ARRAY['barbell','rack']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['squat','paused'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Farmer''s Carry', 'carry', 'Grip / traps / core', ARRAY['dumbbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['carry','bilateral'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Suitcase Carry', 'carry', 'Core / grip', ARRAY['dumbbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['carry','unilateral'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Overhead Carry', 'carry', 'Shoulders / core / grip', ARRAY['dumbbell']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['carry','vertical'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Pallof Press', 'rotate', 'Core / anti-rotation', ARRAY['cable']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['rotation','anti_extension'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Cable Woodchop', 'rotate', 'Core / obliques', ARRAY['cable']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['rotation','diagonal'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Landmine Rotation', 'rotate', 'Core / hips', ARRAY['barbell','rack']::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['rotation','landmine'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Med Ball Rotational Throw', 'rotate', 'Core / power', ARRAY[]::text[], 'reps', 'weight_kg', NULL, NULL, NULL, '{}', ARRAY['rotation','medicine_ball','power'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Box Jump', 'jump', 'Lower body power', ARRAY[]::text[], 'reps', 'none', NULL, NULL, NULL, '{}', ARRAY['jump','plyometric'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Broad Jump', 'jump', 'Lower body power', ARRAY[]::text[], 'reps', 'none', NULL, NULL, NULL, '{}', ARRAY['jump','horizontal'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Depth Jump', 'jump', 'Lower body power', ARRAY[]::text[], 'reps', 'none', NULL, NULL, NULL, '{}', ARRAY['jump','plyometric','advanced'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Vertical Jump', 'jump', 'Lower body power', ARRAY[]::text[], 'reps', 'none', NULL, NULL, NULL, '{}', ARRAY['jump','testing'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Trap Bar Jump', 'jump', 'Lower body power', ARRAY['barbell']::text[], 'reps', 'none', NULL, NULL, NULL, '{}', ARRAY['jump','trap_bar'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Dumbbell Jump Squat', 'jump', 'Lower body power', ARRAY['dumbbell']::text[], 'reps', 'none', NULL, NULL, NULL, '{}', ARRAY['jump','loaded'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, '10m Sprint', 'sprint', 'Acceleration', ARRAY[]::text[], 'distance', 'none', NULL, NULL, NULL, '{}', ARRAY['sprint','linear'], TRUE, NULL),
  (gen_random_uuid(), NULL, '20m Sprint', 'sprint', 'Acceleration / velocity', ARRAY[]::text[], 'distance', 'none', NULL, NULL, NULL, '{}', ARRAY['sprint','linear'], TRUE, NULL),
  (gen_random_uuid(), NULL, '30m Sprint', 'sprint', 'Max velocity', ARRAY[]::text[], 'distance', 'none', NULL, NULL, NULL, '{}', ARRAY['sprint','linear'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Flying 10m', 'sprint', 'Max velocity', ARRAY[]::text[], 'distance', 'none', NULL, NULL, NULL, '{}', ARRAY['sprint','flying'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Resisted Sprint', 'sprint', 'Acceleration', ARRAY[]::text[], 'distance', 'none', NULL, NULL, NULL, '{}', ARRAY['sprint','resisted'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Assisted Sprint', 'sprint', 'Max velocity', ARRAY[]::text[], 'distance', 'none', NULL, NULL, NULL, '{}', ARRAY['sprint','assisted'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Wall Sit', 'isometric', 'Quads', ARRAY['bodyweight']::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['isometric','lower_body'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Plank', 'isometric', 'Core', ARRAY['bodyweight']::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['isometric','anterior_core'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Side Plank', 'isometric', 'Obliques / lateral core', ARRAY['bodyweight']::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['isometric','lateral_core'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Copenhagen Plank', 'isometric', 'Adductors / core', ARRAY['bodyweight']::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['isometric','adductor'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Isometric Mid-Thigh Pull', 'isometric', 'Total body / grip', ARRAY['barbell','rack']::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['isometric','testing','pull'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

INSERT INTO public.exercise_library (
  id, org_id, name, movement_pattern, primary_muscle_group, equipment_required,
  parameter_1, parameter_2, video_url, coaching_cues, reference_max_id, suggested_swap_ids, tags,
  is_system_default, created_by
) VALUES
  (gen_random_uuid(), NULL, 'Assault Bike', 'custom', 'Full body conditioning', ARRAY['machine']::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['conditioning','bike'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Row Erg', 'custom', 'Full body conditioning', ARRAY['machine']::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['conditioning','erg'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Ski Erg', 'custom', 'Upper body / conditioning', ARRAY['machine']::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['conditioning','erg'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Sled Push', 'custom', 'Lower body power / conditioning', ARRAY[]::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['conditioning','sled'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Sled Pull', 'custom', 'Posterior chain / conditioning', ARRAY[]::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['conditioning','sled'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Battle Ropes', 'custom', 'Upper body / conditioning', ARRAY[]::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['conditioning','ropes'], TRUE, NULL),
  (gen_random_uuid(), NULL, 'Shuttle Run', 'custom', 'Change of direction / conditioning', ARRAY[]::text[], 'time', 'none', NULL, NULL, NULL, '{}', ARRAY['conditioning','shuttle'], TRUE, NULL)
ON CONFLICT (name) WHERE (org_id IS NULL AND is_system_default IS TRUE) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Pass 2 — reference_max_id (1RM source exercise)
-- -----------------------------------------------------------------------------
UPDATE public.exercise_library child
SET reference_max_id = parent.id,
    updated_at = now()
FROM public.exercise_library parent
WHERE child.org_id IS NULL AND child.is_system_default IS TRUE
  AND parent.org_id IS NULL AND parent.is_system_default IS TRUE
  AND child.name = 'Pause Squat' AND parent.name = 'Back Squat';

UPDATE public.exercise_library child
SET reference_max_id = parent.id,
    updated_at = now()
FROM public.exercise_library parent
WHERE child.org_id IS NULL AND child.is_system_default IS TRUE
  AND parent.org_id IS NULL AND parent.is_system_default IS TRUE
  AND child.name = 'Box Squat' AND parent.name = 'Back Squat';

UPDATE public.exercise_library child
SET reference_max_id = parent.id,
    updated_at = now()
FROM public.exercise_library parent
WHERE child.org_id IS NULL AND child.is_system_default IS TRUE
  AND parent.org_id IS NULL AND parent.is_system_default IS TRUE
  AND child.name = 'Bulgarian Split Squat' AND parent.name = 'Back Squat';

UPDATE public.exercise_library child
SET reference_max_id = parent.id,
    updated_at = now()
FROM public.exercise_library parent
WHERE child.org_id IS NULL AND child.is_system_default IS TRUE
  AND parent.org_id IS NULL AND parent.is_system_default IS TRUE
  AND child.name = 'DB Romanian Deadlift' AND parent.name = 'Deadlift';

UPDATE public.exercise_library child
SET reference_max_id = parent.id,
    updated_at = now()
FROM public.exercise_library parent
WHERE child.org_id IS NULL AND child.is_system_default IS TRUE
  AND parent.org_id IS NULL AND parent.is_system_default IS TRUE
  AND child.name = 'Rack Pull' AND parent.name = 'Deadlift';

UPDATE public.exercise_library child
SET reference_max_id = parent.id,
    updated_at = now()
FROM public.exercise_library parent
WHERE child.org_id IS NULL AND child.is_system_default IS TRUE
  AND parent.org_id IS NULL AND parent.is_system_default IS TRUE
  AND child.name = 'DB Bench Press' AND parent.name = 'Bench Press';

UPDATE public.exercise_library child
SET reference_max_id = parent.id,
    updated_at = now()
FROM public.exercise_library parent
WHERE child.org_id IS NULL AND child.is_system_default IS TRUE
  AND parent.org_id IS NULL AND parent.is_system_default IS TRUE
  AND child.name = 'Landmine Press' AND parent.name = 'Overhead Press';

UPDATE public.exercise_library child
SET reference_max_id = parent.id,
    updated_at = now()
FROM public.exercise_library parent
WHERE child.org_id IS NULL AND child.is_system_default IS TRUE
  AND parent.org_id IS NULL AND parent.is_system_default IS TRUE
  AND child.name = 'Chin-up' AND parent.name = 'Pull-up';

-- -----------------------------------------------------------------------------
-- Pass 3 — suggested_swap_ids (pre-defined alternatives)
-- -----------------------------------------------------------------------------
UPDATE public.exercise_library anchor
SET suggested_swap_ids = ARRAY(
  SELECT s.id FROM public.exercise_library s
  WHERE s.org_id IS NULL AND s.is_system_default IS TRUE
    AND s.name IN ('Front Squat', 'Goblet Squat', 'Leg Press')
  ORDER BY array_position(ARRAY['Front Squat','Goblet Squat','Leg Press']::text[], s.name)
),
updated_at = now()
WHERE anchor.org_id IS NULL AND anchor.is_system_default IS TRUE AND anchor.name = 'Back Squat';

UPDATE public.exercise_library anchor
SET suggested_swap_ids = ARRAY(
  SELECT s.id FROM public.exercise_library s
  WHERE s.org_id IS NULL AND s.is_system_default IS TRUE
    AND s.name IN ('Romanian Deadlift', 'Rack Pull', 'DB Romanian Deadlift')
  ORDER BY array_position(ARRAY['Romanian Deadlift','Rack Pull','DB Romanian Deadlift']::text[], s.name)
),
updated_at = now()
WHERE anchor.org_id IS NULL AND anchor.is_system_default IS TRUE AND anchor.name = 'Deadlift';

UPDATE public.exercise_library anchor
SET suggested_swap_ids = ARRAY(
  SELECT s.id FROM public.exercise_library s
  WHERE s.org_id IS NULL AND s.is_system_default IS TRUE
    AND s.name IN ('DB Bench Press', 'Push-up', 'Landmine Press')
  ORDER BY array_position(ARRAY['DB Bench Press','Push-up','Landmine Press']::text[], s.name)
),
updated_at = now()
WHERE anchor.org_id IS NULL AND anchor.is_system_default IS TRUE AND anchor.name = 'Bench Press';

UPDATE public.exercise_library anchor
SET suggested_swap_ids = ARRAY(
  SELECT s.id FROM public.exercise_library s
  WHERE s.org_id IS NULL AND s.is_system_default IS TRUE
    AND s.name IN ('Chin-up', 'Bent Over Row', 'Seated Cable Row')
  ORDER BY array_position(ARRAY['Chin-up','Bent Over Row','Seated Cable Row']::text[], s.name)
),
updated_at = now()
WHERE anchor.org_id IS NULL AND anchor.is_system_default IS TRUE AND anchor.name = 'Pull-up';

UPDATE public.exercise_library anchor
SET suggested_swap_ids = ARRAY(
  SELECT s.id FROM public.exercise_library s
  WHERE s.org_id IS NULL AND s.is_system_default IS TRUE
    AND s.name IN ('DB Shoulder Press', 'Landmine Press')
  ORDER BY array_position(ARRAY['DB Shoulder Press','Landmine Press']::text[], s.name)
),
updated_at = now()
WHERE anchor.org_id IS NULL AND anchor.is_system_default IS TRUE AND anchor.name = 'Overhead Press';

-- -----------------------------------------------------------------------------
-- Verification: total system-default rows (expected 57 after first full run)
-- -----------------------------------------------------------------------------
SELECT count(*)::int AS system_default_exercise_library_rows
FROM public.exercise_library
WHERE org_id IS NULL AND is_system_default IS TRUE;
