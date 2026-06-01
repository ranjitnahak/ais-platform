-- =============================================================================
-- Naveen Kumar — link JSW Sports profile to Haryana Steelers (senior, not Academy)
-- =============================================================================
-- JSW athlete: 722b1ffd-92bb-4670-9adc-d23259b5fe58
-- AKFI athlete: a6f86df0-c6b9-4fd8-b211-b5afaec05e18
-- Haryana Steelers team: b1000000-0000-0000-0000-000000000001 (JSW Sports org)
-- Haryana Steelers Academy: 56df726a-fe78-484e-8228-65c13ff5fc36 — do NOT use here
--
-- Fixes: JSW profile existed but had no team; AKFI profile was incorrectly on JSW team.
-- Safe to re-run.
-- =============================================================================

BEGIN;

INSERT INTO public.athlete_teams (athlete_id, team_id, joined_at)
SELECT
  '722b1ffd-92bb-4670-9adc-d23259b5fe58'::uuid,
  'b1000000-0000-0000-0000-000000000001'::uuid,
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.athlete_teams at
  WHERE at.athlete_id = '722b1ffd-92bb-4670-9adc-d23259b5fe58'::uuid
    AND at.team_id = 'b1000000-0000-0000-0000-000000000001'::uuid
);

DELETE FROM public.athlete_teams
WHERE athlete_id = 'a6f86df0-c6b9-4fd8-b211-b5afaec05e18'::uuid
  AND team_id = 'b1000000-0000-0000-0000-000000000001'::uuid;

COMMIT;

SELECT a.id, o.name AS org_name, a.full_name,
  (
    SELECT string_agg(t.name, ', ' ORDER BY t.name)
    FROM public.athlete_teams at
    JOIN public.teams t ON t.id = at.team_id
    WHERE at.athlete_id = a.id
  ) AS teams
FROM public.athletes a
JOIN public.organisations o ON o.id = a.org_id
WHERE a.id IN (
  '722b1ffd-92bb-4670-9adc-d23259b5fe58'::uuid,
  'a6f86df0-c6b9-4fd8-b211-b5afaec05e18'::uuid
);
