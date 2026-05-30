-- =============================================================================
-- Haryana Steelers Academy — link existing athletes to team (repair)
-- =============================================================================
-- Use when diagnose query shows IN_DB_NO_TEAM for seed athletes.
-- Does NOT create new profiles — only adds missing athlete_teams rows.
-- Safe to re-run (skips athletes already on this team).
-- =============================================================================

BEGIN;

INSERT INTO public.athlete_teams (athlete_id, team_id, joined_at)
SELECT
  a.id,
  '56df726a-fe78-484e-8228-65c13ff5fc36'::uuid,
  now()
FROM public.athletes a
WHERE a.org_id = 'a3000000-0000-0000-0000-000000000001'::uuid
  AND a.id IN (
    '6cae79e0-bce5-49a7-81d3-0f2522f9c008',
    '2c093f2b-f43b-47ed-ac44-e8e2befc0490',
    'fb445dc7-2ba2-45fe-b741-cadc2a456f93',
    'c58b1907-b918-4ffc-81d1-d333051e2459',
    '677d0622-0ef6-4f66-9848-c535aa08e2d0',
    'c306be26-83ff-4de7-8573-912110396e68',
    'ff72cd8b-7a96-4b49-84c5-fdc5b416c44f',
    'f08d4252-4060-4886-9e96-b763165b7e51',
    '42d6d482-5a4c-4a5d-b7b1-c2edeabb325e',
    'c216fe43-973e-46ed-ae0f-0ad643cee126',
    'c65ceb48-fd8c-4b1f-934d-6edbfc69613e',
    '7728df1c-3516-4ff2-a77e-5d47045b2a45',
    '8c1926cd-5f0b-4798-93ca-d25f1ef5c7d6',
    '9100ff42-895f-4bb5-aea2-224e1a725f39',
    '483355b3-cda9-4f14-9ae1-58b0eeacb6af',
    'ab086c19-3735-49ed-b02d-ed1504af4305',
    'd4a0d2af-161c-4881-a2a1-f4db758a3932',
    '1667437d-c04f-4c9a-b4c6-3caa7b32eaf6',
    '35dade77-2c9d-4e20-bfd3-17a2120860b8',
    '04c4a7fc-930a-414a-8e0b-64fdf01927f7',
    '8002da5b-4a42-48e1-863d-ecbcd83d783a',
    '9a1350da-e553-4194-936b-0a673b6d1741',
    '7d013169-8ec3-4840-bf65-fe43ba9489c4',
    '486d568d-a3d9-4522-892b-55433f28823d'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.athlete_teams at
    WHERE at.athlete_id = a.id
      AND at.team_id = '56df726a-fe78-484e-8228-65c13ff5fc36'::uuid
  );

COMMIT;

-- Expect 24 rows inserted; 25 total on team (including Nilesh)
SELECT count(*) AS athletes_on_hsa_team
FROM public.athlete_teams
WHERE team_id = '56df726a-fe78-484e-8228-65c13ff5fc36';
