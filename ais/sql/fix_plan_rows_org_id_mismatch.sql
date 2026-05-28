-- Repair plan_rows / plan_cells whose org_id drifted from parent periodisation_plans.
-- Symptom: plan dates show in UI but canvas rows are empty (plan_id matches, org_id filter excludes rows).
-- Run in Supabase SQL editor, then verify with the SELECT at the bottom.

UPDATE public.plan_rows pr
SET org_id = pp.org_id
FROM public.periodisation_plans pp
WHERE pr.plan_id = pp.id
  AND pr.org_id IS DISTINCT FROM pp.org_id;

UPDATE public.plan_cells pc
SET org_id = pp.org_id
FROM public.plan_rows pr
JOIN public.periodisation_plans pp ON pp.id = pr.plan_id
WHERE pc.row_id = pr.id
  AND pc.org_id IS DISTINCT FROM pp.org_id;

-- Verification: plans with zero rows (need template seed or recreate plan)
SELECT pp.id, pp.org_id, pp.team_id, pp.name, COUNT(pr.id) AS row_count
FROM public.periodisation_plans pp
LEFT JOIN public.plan_rows pr ON pr.plan_id = pp.id
GROUP BY pp.id, pp.org_id, pp.team_id, pp.name
ORDER BY pp.org_id, pp.name;
