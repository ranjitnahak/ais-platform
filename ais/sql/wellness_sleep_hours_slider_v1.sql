-- Sleep hours: number input → 0–10 hour slider; fix Nitish Bhardwaj erroneous entry (63 → 6).

BEGIN;

-- All orgs: sleep_hours as 0–10 slider (tracked separately from 1–5 readiness composite).
UPDATE public.wellness_form_items
SET
  input_type = 'slider',
  scale_min = 0,
  scale_max = 10,
  scale_min_label = '0 hours',
  scale_max_label = '10 hours',
  direction = 'higher_better'
WHERE key = 'sleep_hours';

-- Nitish Bhardwaj: correct sleep_hours and readiness composite (7 × 1–5 sliders only).
UPDATE public.wellness_logs wl
SET
  responses = jsonb_set(COALESCE(wl.responses, '{}'::jsonb), '{sleep_hours}', '6'::jsonb),
  composite_score = round((
    (5 - (wl.responses->>'fatigue')::numeric + 1) +
    (5 - (wl.responses->>'soreness')::numeric + 1) +
    (wl.responses->>'sleep_quality')::numeric +
    (wl.responses->>'mood')::numeric +
    (wl.responses->>'motivation')::numeric +
    (wl.responses->>'performance_satisfaction')::numeric +
    (wl.responses->>'plan_adherence')::numeric
  ) / 7.0, 2)
WHERE wl.athlete_id = '483355b3-cda9-4f14-9ae1-58b0eeacb6af'::uuid
  AND wl.responses ? 'sleep_hours'
  AND (wl.responses->>'sleep_hours')::numeric >= 10;

COMMIT;
