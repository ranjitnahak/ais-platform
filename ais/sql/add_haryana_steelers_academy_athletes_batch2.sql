-- =============================================================================
-- Haryana Steelers Academy — add athletes (batch 2)
-- =============================================================================
-- Run in Supabase SQL Editor (review team/org IDs first).
--
-- Creates athlete profiles and assigns them to team "Haryana Steelers Academy".
-- Does NOT send login invites or upload photos — use Admin → Users after import.
--
-- Idempotent: skips athletes already in org (matched by email, or name+DOB if no email).
-- Safe to re-run — will insert missing athletes and add missing team links.
-- =============================================================================

-- Verify org + team before running (expect one row):
SELECT t.id AS team_id, t.name, t.org_id, o.name AS org_name
FROM public.teams t
JOIN public.organisations o ON o.id = t.org_id
WHERE t.id = '56df726a-fe78-484e-8228-65c13ff5fc36'
   OR (t.org_id = 'a3000000-0000-0000-0000-000000000001' AND t.name ILIKE '%Haryana Steelers Academy%');

BEGIN;

CREATE TEMP TABLE _hsa_seed ON COMMIT DROP AS
SELECT *
FROM (VALUES
  ('Nikhil', 'Kodan', '2005-08-15'::date, 'nikhilkodan396@gmail.com', '8307792564',
   'Silani gate Jhajjar. Jhajjar, Haryana 124103'),
  ('Akshit', 'Nandal', '2006-09-26'::date, 'akshitnandal26@gmail.com', '8368150955',
   'Vishal nagar sonipat. Sonipat, Haryana 131001'),
  ('Tarun', 'Kaushik', '2006-04-07'::date, 'Tarunpandat5803@gmail.com', '7291818268',
   'Shamsher. Ghaziabad, Uttar Pradesh 201001'),
  ('Shreenivasa Hulugappa', 'H', '2006-06-05'::date, 'srinivasah0522@gmail.com', '7892530271',
   'Tekkalakote (T) Siruguppa (d) ballari Karnataka. Tekkalakote, Karnataka 583122')
) AS v(first_name, last_name, date_of_birth, email, phone, address);

-- Step 1: insert missing athlete profiles
INSERT INTO public.athletes (
  org_id,
  first_name,
  last_name,
  full_name,
  date_of_birth,
  gender,
  position,
  email,
  phone,
  address,
  is_active
)
SELECT
  'a3000000-0000-0000-0000-000000000001'::uuid,
  s.first_name,
  s.last_name,
  trim(s.first_name || ' ' || s.last_name),
  s.date_of_birth,
  'male',
  'raider',
  nullif(trim(s.email), ''),
  nullif(trim(s.phone), ''),
  s.address,
  true
FROM _hsa_seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.athletes a
  WHERE a.org_id = 'a3000000-0000-0000-0000-000000000001'::uuid
    AND (
      (s.email IS NOT NULL AND lower(trim(a.email)) = lower(trim(s.email)))
      OR (
        s.email IS NULL
        AND lower(trim(a.first_name)) = lower(trim(s.first_name))
        AND lower(trim(a.last_name)) = lower(trim(s.last_name))
        AND a.date_of_birth = s.date_of_birth
      )
    )
);

-- Step 2: assign all seed athletes to Haryana Steelers Academy
INSERT INTO public.athlete_teams (athlete_id, team_id, joined_at)
SELECT
  a.id,
  '56df726a-fe78-484e-8228-65c13ff5fc36'::uuid,
  now()
FROM _hsa_seed s
JOIN public.athletes a
  ON a.org_id = 'a3000000-0000-0000-0000-000000000001'::uuid
 AND (
   (s.email IS NOT NULL AND lower(trim(a.email)) = lower(trim(s.email)))
   OR (
     s.email IS NULL
     AND lower(trim(a.first_name)) = lower(trim(s.first_name))
     AND lower(trim(a.last_name)) = lower(trim(s.last_name))
     AND a.date_of_birth = s.date_of_birth
   )
 )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.athlete_teams at
  WHERE at.athlete_id = a.id
    AND at.team_id = '56df726a-fe78-484e-8228-65c13ff5fc36'::uuid
);

COMMIT;

-- Post-run checks (expect 4 new athletes on team, or prior total + new inserts)
SELECT a.first_name, a.last_name, a.email, a.date_of_birth, a.phone, a.address
FROM public.athletes a
JOIN public.athlete_teams at ON at.athlete_id = a.id
WHERE at.team_id = '56df726a-fe78-484e-8228-65c13ff5fc36'
  AND lower(a.email) IN (
    'nikhilkodan396@gmail.com',
    'akshitnandal26@gmail.com',
    'tarunpandat5803@gmail.com',
    'srinivasah0522@gmail.com'
  )
ORDER BY a.first_name, a.last_name;
