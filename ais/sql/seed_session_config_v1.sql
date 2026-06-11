-- =============================================================================
-- Session type + venue defaults — template org + backfill all existing orgs
-- Safe to re-run (ON CONFLICT DO NOTHING).
-- =============================================================================

BEGIN;

-- Default template org (same as wellness)
INSERT INTO public.session_type_options (org_id, key, label, sort_order, default_venue)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'strength', 'Strength session', 1, 'Gym'),
  ('a1000000-0000-0000-0000-000000000001', 'speed_agility', 'Speed & agility', 2, 'Field'),
  ('a1000000-0000-0000-0000-000000000001', 'recovery', 'Recovery', 3, 'Pool'),
  ('a1000000-0000-0000-0000-000000000001', 'technical_tactical', 'Technical & Tactical', 4, 'Field'),
  ('a1000000-0000-0000-0000-000000000001', 'match', 'Match', 5, 'Field'),
  ('a1000000-0000-0000-0000-000000000001', 'mat_session', 'Mat session', 6, 'Mat'),
  ('a1000000-0000-0000-0000-000000000001', 'self_session', 'Self session', 7, NULL),
  ('a1000000-0000-0000-0000-000000000001', 'other', 'Other', 8, NULL)
ON CONFLICT (org_id, key) DO NOTHING;

INSERT INTO public.session_venue_options (org_id, label, sort_order)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Gym', 1),
  ('a1000000-0000-0000-0000-000000000001', 'Field', 2),
  ('a1000000-0000-0000-0000-000000000001', 'Pool', 3),
  ('a1000000-0000-0000-0000-000000000001', 'Track', 4),
  ('a1000000-0000-0000-0000-000000000001', 'Mat', 5),
  ('a1000000-0000-0000-0000-000000000001', 'Other', 6)
ON CONFLICT (org_id, label) DO NOTHING;

-- Backfill every org that has no session type options yet
INSERT INTO public.session_type_options (org_id, key, label, sort_order, default_venue)
SELECT o.id, t.key, t.label, t.sort_order, t.default_venue
FROM public.organisations o
CROSS JOIN (
  VALUES
    ('strength', 'Strength session', 1, 'Gym'),
    ('speed_agility', 'Speed & agility', 2, 'Field'),
    ('recovery', 'Recovery', 3, 'Pool'),
    ('technical_tactical', 'Technical & Tactical', 4, 'Field'),
    ('match', 'Match', 5, 'Field'),
    ('mat_session', 'Mat session', 6, 'Mat'),
    ('self_session', 'Self session', 7, NULL),
    ('other', 'Other', 8, NULL)
) AS t(key, label, sort_order, default_venue)
WHERE NOT EXISTS (
  SELECT 1 FROM public.session_type_options sto WHERE sto.org_id = o.id
)
ON CONFLICT (org_id, key) DO NOTHING;

INSERT INTO public.session_venue_options (org_id, label, sort_order)
SELECT o.id, v.label, v.sort_order
FROM public.organisations o
CROSS JOIN (
  VALUES
    ('Gym', 1),
    ('Field', 2),
    ('Pool', 3),
    ('Track', 4),
    ('Mat', 5),
    ('Other', 6)
) AS v(label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.session_venue_options svo WHERE svo.org_id = o.id
)
ON CONFLICT (org_id, label) DO NOTHING;

COMMIT;

SELECT org_id, count(*) AS type_count
FROM public.session_type_options
GROUP BY org_id
ORDER BY org_id;

SELECT org_id, count(*) AS venue_count
FROM public.session_venue_options
GROUP BY org_id
ORDER BY org_id;
