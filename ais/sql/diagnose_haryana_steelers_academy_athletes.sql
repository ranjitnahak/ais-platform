-- =============================================================================
-- Haryana Steelers Academy — diagnostic (read-only)
-- =============================================================================
-- Run in Supabase SQL Editor BEFORE re-running the seed script.
-- Checks whether roster athletes exist in `athletes` and how they are linked
-- in `athlete_teams` (Haryana Steelers Academy vs other teams vs none).
--
-- Result 1: summary counts by status
-- Result 2: full row-by-row detail (scroll or export)
-- =============================================================================

WITH constants AS (
  SELECT
    'a3000000-0000-0000-0000-000000000001'::uuid AS org_id,
    '56df726a-fe78-484e-8228-65c13ff5fc36'::uuid AS team_id
),
seed AS (
  SELECT *
  FROM (VALUES
    ('Nilesh Ravindra', 'Shinde', '2002-12-04'::date, 'nileshshindecr7@gmail.com'),
    ('Sagar Anil', 'Jagdale', '2010-08-26'::date, 'sagarjagadale2424@gmail.com'),
    ('Ashish Arun', 'Padale', '2005-07-03'::date, 'ashishpadale223@gmail.com'),
    ('Rahul', 'Poriya', '2005-01-05'::date, 'rahulkbd57@gmail.com'),
    ('Rohan Subhash', 'Lone', '2011-02-20'::date, 'Rohanlone4595@gmail.com'),
    ('Nitish Bhardwaj', 'Bhardwaj', '2010-02-09'::date, 'nbhardwajbhardwaj64@gmail.com'),
    ('Ishant Rathee', 'Rathee', '2009-03-16'::date, 'ishantrathee55@gmail.com'),
    ('Aakash', 'Deshwal', '2004-07-05'::date, 'aakashdeswal366@gmail.com'),
    ('Sachin', 'Dhiman', '2005-10-28'::date, 'dhimansachin303@gmail.com'),
    ('Sachin', 'Khatkar', '2008-10-10'::date, 'khatkarsachin676@gmail.com'),
    ('Naveen', 'Chahar', '2007-10-15'::date, 'n31398217@gmail.com'),
    ('Pravin', 'Kumar', '2008-07-07'::date, 'pravinkumartalfara@gmail.com'),
    ('Shivam', 'Teotia', '2007-01-05'::date, 'shivamkabaddi10@gmail.com'),
    ('Parvesh Kumar', 'Rathee', '2007-05-15'::date, 'parveshrathee311@gmail.com'),
    ('Mohit', 'Goyat', '2008-03-23'::date, 'Mohitgoyat10@gmail.com'),
    ('Vinay', 'Sehrawat', '2008-01-23'::date, 'vikramsehrawat144@gmail.com'),
    ('Ashish', 'Budhwar', '2008-03-18'::date, 'sunariyaashish@gmail.com'),
    ('Deepanshu', 'Nandal', '2009-01-01'::date, 'deepanshunandal306@gmail.com'),
    ('Harsh', 'Jaglan', '2009-05-07'::date, 'jaglan8050@gmail.com'),
    ('Deepak', 'Sihag', '2007-08-01'::date, 'sihagdeepak816@gmail.com'),
    ('Anoop', 'Choudhary', '2009-01-10'::date, 'jaat21420@gmail.com'),
    ('Bhupesh', 'Chandel', '2007-11-14'::date, NULL::text),
    ('Jasbir', 'Dahiya', '2005-10-19'::date, 'jdahiya605@gmail.com'),
    ('Amit', 'Singh', '2008-12-22'::date, 'amitsolath2@gmail.com'),
    ('Aman', 'Rathee', '2008-08-08'::date, 'amanratheekabaddi50@gmail.com')
  ) AS v(first_name, last_name, date_of_birth, email)
),
matched AS (
  SELECT
    s.first_name AS seed_first_name,
    s.last_name AS seed_last_name,
    s.email AS seed_email,
    a.id AS athlete_id,
    a.first_name AS db_first_name,
    a.last_name AS db_last_name,
    a.email AS db_email,
    a.position,
    a.created_at
  FROM seed s
  CROSS JOIN constants c
  LEFT JOIN public.athletes a
    ON a.org_id = c.org_id
   AND (
     (s.email IS NOT NULL AND lower(trim(a.email)) = lower(trim(s.email)))
     OR (
       s.email IS NULL
       AND lower(trim(a.first_name)) = lower(trim(s.first_name))
       AND lower(trim(a.last_name)) = lower(trim(s.last_name))
       AND a.date_of_birth = s.date_of_birth
     )
   )
),
team_links AS (
  SELECT
    m.*,
    CASE
      WHEN m.athlete_id IS NULL THEN 'NOT_IN_DB'
      WHEN EXISTS (
        SELECT 1
        FROM public.athlete_teams at
        CROSS JOIN constants c
        WHERE at.athlete_id = m.athlete_id
          AND at.team_id = c.team_id
      ) THEN 'ON_HSA_TEAM'
      WHEN EXISTS (
        SELECT 1
        FROM public.athlete_teams at
        WHERE at.athlete_id = m.athlete_id
      ) THEN 'ON_OTHER_TEAM_ONLY'
      ELSE 'IN_DB_NO_TEAM'
    END AS link_status,
    (
      SELECT string_agg(t.name, ', ' ORDER BY t.name)
      FROM public.athlete_teams at
      JOIN public.teams t ON t.id = at.team_id
      WHERE at.athlete_id = m.athlete_id
    ) AS current_teams
  FROM matched m
)
SELECT link_status, count(*) AS athlete_count
FROM team_links
GROUP BY link_status
ORDER BY link_status;

-- Row-by-row detail (run this second query in the same editor tab, or select all)
WITH constants AS (
  SELECT
    'a3000000-0000-0000-0000-000000000001'::uuid AS org_id,
    '56df726a-fe78-484e-8228-65c13ff5fc36'::uuid AS team_id
),
seed AS (
  SELECT *
  FROM (VALUES
    ('Nilesh Ravindra', 'Shinde', '2002-12-04'::date, 'nileshshindecr7@gmail.com'),
    ('Sagar Anil', 'Jagdale', '2010-08-26'::date, 'sagarjagadale2424@gmail.com'),
    ('Ashish Arun', 'Padale', '2005-07-03'::date, 'ashishpadale223@gmail.com'),
    ('Rahul', 'Poriya', '2005-01-05'::date, 'rahulkbd57@gmail.com'),
    ('Rohan Subhash', 'Lone', '2011-02-20'::date, 'Rohanlone4595@gmail.com'),
    ('Nitish Bhardwaj', 'Bhardwaj', '2010-02-09'::date, 'nbhardwajbhardwaj64@gmail.com'),
    ('Ishant Rathee', 'Rathee', '2009-03-16'::date, 'ishantrathee55@gmail.com'),
    ('Aakash', 'Deshwal', '2004-07-05'::date, 'aakashdeswal366@gmail.com'),
    ('Sachin', 'Dhiman', '2005-10-28'::date, 'dhimansachin303@gmail.com'),
    ('Sachin', 'Khatkar', '2008-10-10'::date, 'khatkarsachin676@gmail.com'),
    ('Naveen', 'Chahar', '2007-10-15'::date, 'n31398217@gmail.com'),
    ('Pravin', 'Kumar', '2008-07-07'::date, 'pravinkumartalfara@gmail.com'),
    ('Shivam', 'Teotia', '2007-01-05'::date, 'shivamkabaddi10@gmail.com'),
    ('Parvesh Kumar', 'Rathee', '2007-05-15'::date, 'parveshrathee311@gmail.com'),
    ('Mohit', 'Goyat', '2008-03-23'::date, 'Mohitgoyat10@gmail.com'),
    ('Vinay', 'Sehrawat', '2008-01-23'::date, 'vikramsehrawat144@gmail.com'),
    ('Ashish', 'Budhwar', '2008-03-18'::date, 'sunariyaashish@gmail.com'),
    ('Deepanshu', 'Nandal', '2009-01-01'::date, 'deepanshunandal306@gmail.com'),
    ('Harsh', 'Jaglan', '2009-05-07'::date, 'jaglan8050@gmail.com'),
    ('Deepak', 'Sihag', '2007-08-01'::date, 'sihagdeepak816@gmail.com'),
    ('Anoop', 'Choudhary', '2009-01-10'::date, 'jaat21420@gmail.com'),
    ('Bhupesh', 'Chandel', '2007-11-14'::date, NULL::text),
    ('Jasbir', 'Dahiya', '2005-10-19'::date, 'jdahiya605@gmail.com'),
    ('Amit', 'Singh', '2008-12-22'::date, 'amitsolath2@gmail.com'),
    ('Aman', 'Rathee', '2008-08-08'::date, 'amanratheekabaddi50@gmail.com')
  ) AS v(first_name, last_name, date_of_birth, email)
),
matched AS (
  SELECT
    s.first_name AS seed_first_name,
    s.last_name AS seed_last_name,
    s.email AS seed_email,
    a.id AS athlete_id,
    a.position,
    a.created_at
  FROM seed s
  CROSS JOIN constants c
  LEFT JOIN public.athletes a
    ON a.org_id = c.org_id
   AND (
     (s.email IS NOT NULL AND lower(trim(a.email)) = lower(trim(s.email)))
     OR (
       s.email IS NULL
       AND lower(trim(a.first_name)) = lower(trim(s.first_name))
       AND lower(trim(a.last_name)) = lower(trim(s.last_name))
       AND a.date_of_birth = s.date_of_birth
     )
   )
),
team_links AS (
  SELECT
    m.*,
    CASE
      WHEN m.athlete_id IS NULL THEN 'NOT_IN_DB'
      WHEN EXISTS (
        SELECT 1
        FROM public.athlete_teams at
        CROSS JOIN constants c
        WHERE at.athlete_id = m.athlete_id
          AND at.team_id = c.team_id
      ) THEN 'ON_HSA_TEAM'
      WHEN EXISTS (
        SELECT 1
        FROM public.athlete_teams at
        WHERE at.athlete_id = m.athlete_id
      ) THEN 'ON_OTHER_TEAM_ONLY'
      ELSE 'IN_DB_NO_TEAM'
    END AS link_status,
    (
      SELECT string_agg(t.name, ', ' ORDER BY t.name)
      FROM public.athlete_teams at
      JOIN public.teams t ON t.id = at.team_id
      WHERE at.athlete_id = m.athlete_id
    ) AS current_teams
  FROM matched m
)
SELECT
  link_status,
  seed_first_name,
  seed_last_name,
  seed_email,
  athlete_id,
  position,
  current_teams,
  created_at
FROM team_links
ORDER BY
  CASE link_status
    WHEN 'NOT_IN_DB' THEN 1
    WHEN 'IN_DB_NO_TEAM' THEN 2
    WHEN 'ON_OTHER_TEAM_ONLY' THEN 3
    WHEN 'ON_HSA_TEAM' THEN 4
  END,
  seed_first_name,
  seed_last_name;
