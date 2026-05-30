-- =============================================================================
-- Haryana Steelers Academy — bulk athlete roster seed
-- =============================================================================
-- Run in Supabase SQL Editor (review team/org IDs first).
--
-- Creates athlete profiles and assigns them to team "Haryana Steelers Academy".
-- Does NOT send login invites or upload photos — use Admin → Users after import.
--
-- Idempotent: skips athletes already in org (matched by email, or name+DOB if no email).
-- Safe to re-run — will insert missing athletes and add missing team links.
--
-- NOTE: Uses two separate INSERT statements (not chained CTEs) so PostgreSQL does
-- not evaluate athlete insert and team link concurrently.
-- =============================================================================

-- Verify org + team before running (expect one row):
SELECT t.id AS team_id, t.name, t.org_id, o.name AS org_name
FROM public.teams t
JOIN public.organisations o ON o.id = t.org_id
WHERE t.id = '56df726a-fe78-484e-8228-65c13ff5fc36'
   OR (t.org_id = 'a3000000-0000-0000-0000-000000000001' AND t.name ILIKE '%Haryana Steelers Academy%');

BEGIN;

-- Shared seed data (25 athletes; duplicates from form removed)
CREATE TEMP TABLE _hsa_seed ON COMMIT DROP AS
SELECT *
FROM (VALUES
  ('Nilesh Ravindra', 'Shinde', '2002-12-04'::date, 'nileshshindecr7@gmail.com', '9763169297',
   'Chiplun 415605, dist ratnagiri, Maharashtra. Chiplun, Maharashtra 415605'),
  ('Sagar Anil', 'Jagdale', '2010-08-26'::date, 'sagarjagadale2424@gmail.com', '9423465079',
   'Tq.ashti, dis.beed, maharashtra. Ashti, Maharashtra 414203'),
  ('Ashish Arun', 'Padale', '2005-07-03'::date, 'ashishpadale223@gmail.com', '9130858019',
   'Suryamukhi Ganesh mandir mahalunge pune. Pune, Maharashtra 411045'),
  ('Rahul', 'Poriya', '2005-01-05'::date, 'rahulkbd57@gmail.com', '9817114263',
   'VPO-malar district-jind. Safidon, Haryana 126112'),
  ('Rohan Subhash', 'Lone', '2011-02-20'::date, 'Rohanlone4595@gmail.com', '9325379120',
   'Churmapuri tq ambad dist jalna. Jalna, Maharashtra 431203'),
  ('Nitish Bhardwaj', 'Bhardwaj', '2010-02-09'::date, 'nbhardwajbhardwaj64@gmail.com', '7015558761',
   'Kherainti. Rohtak, Haryana 124514'),
  ('Ishant Rathee', 'Rathee', '2009-03-16'::date, 'ishantrathee55@gmail.com', '7206897358',
   'Lakhan majra. Rohtak, Haryana 124514'),
  ('Aakash', 'Deshwal', '2004-07-05'::date, 'aakashdeswal366@gmail.com', '9813616390',
   'vpo. kheri jasaur (Bahadurgarh) jhajjar. Bahadurgarh, Haryana 124505'),
  ('Sachin', 'Dhiman', '2005-10-28'::date, 'dhimansachin303@gmail.com', '9813964062',
   'V.p.o bapoli. Panipat, Haryana 132104'),
  ('Sachin', 'Khatkar', '2008-10-10'::date, 'khatkarsachin676@gmail.com', '9467634398',
   'VPO - Karsindhu (Jind). Jind, Haryana 126115'),
  ('Naveen', 'Chahar', '2007-10-15'::date, 'n31398217@gmail.com', '9053146745',
   'VPO_Kanhori (Rewari). Rewari, Haryana 123035'),
  ('Pravin', 'Kumar', '2008-07-07'::date, 'pravinkumartalfara@gmail.com', '6367487902',
   'Talfara kumher. Deeg, Rajasthan 321202'),
  ('Shivam', 'Teotia', '2007-01-05'::date, 'shivamkabaddi10@gmail.com', '8923600359',
   'Vill- Bhatona. Bulandshahr, Uttar Pradesh 203408'),
  ('Parvesh Kumar', 'Rathee', '2007-05-15'::date, 'parveshrathee311@gmail.com', '9996121989',
   'Lakhan majra. Rohtak, Haryana 124514'),
  ('Mohit', 'Goyat', '2008-03-23'::date, 'Mohitgoyat10@gmail.com', '9817715936',
   'Kungar bhaini. Bhiwani, Haryana 127041'),
  ('Vinay', 'Sehrawat', '2008-01-23'::date, 'vikramsehrawat144@gmail.com', '7206801706',
   'V.P.O Bhainsru khurd. Rohtak, Haryana 124501'),
  ('Ashish', 'Budhwar', '2008-03-18'::date, 'sunariyaashish@gmail.com', '9728140414',
   'sunariya kurdh. Rohtak, Haryana 124001'),
  ('Deepanshu', 'Nandal', '2009-01-01'::date, 'deepanshunandal306@gmail.com', '8607641309',
   'Vpo nandal, lakhanmajra block, Rohtak. Rohtak, Haryana 124514'),
  ('Harsh', 'Jaglan', '2009-05-07'::date, 'jaglan8050@gmail.com', '8295314502',
   'Naultha. Panipat, Haryana 132103'),
  ('Deepak', 'Sihag', '2007-08-01'::date, 'sihagdeepak816@gmail.com', '7015570945',
   'Vpo Galar. Churu, Rajasthan 331701'),
  ('Anoop', 'Choudhary', '2009-01-10'::date, 'jaat21420@gmail.com', '7404461457',
   'Galar churu Rajasthan. Churu, Rajasthan 331701'),
  ('Bhupesh', 'Chandel', '2007-11-14'::date, NULL::text, '9459108511',
   'Village plasara nihla post office Nangal tehsil Nalagarh district solan himachal pradesh. Nalagarh, Himachal Pradesh 174101'),
  ('Jasbir', 'Dahiya', '2005-10-19'::date, 'jdahiya605@gmail.com', '8053853381',
   'Sisana. Sonipat, Haryana 131408'),
  ('Amit', 'Singh', '2008-12-22'::date, 'amitsolath2@gmail.com', '8607524176',
   'Durjanpur. Bhiwani, Haryana 127032'),
  ('Aman', 'Rathee', '2008-08-08'::date, 'amanratheekabaddi50@gmail.com', '7015479146',
   'Lakhan majra. Rohtak, Haryana 124001')
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

-- Post-run checks (expect athletes_on_team = 25)
SELECT count(*) AS athletes_on_team
FROM public.athlete_teams at
WHERE at.team_id = '56df726a-fe78-484e-8228-65c13ff5fc36';

SELECT a.first_name, a.last_name, a.email, a.date_of_birth, a.position
FROM public.athletes a
JOIN public.athlete_teams at ON at.athlete_id = a.id
WHERE at.team_id = '56df726a-fe78-484e-8228-65c13ff5fc36'
ORDER BY a.first_name, a.last_name;
