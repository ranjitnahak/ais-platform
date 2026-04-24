-- Remove placeholder rows created before the add-row flow required a name.
-- Run after ensuring no FK blocks deletes (plan_cells cascade or delete first).

DELETE FROM public.plan_cells
WHERE row_id IN (SELECT id FROM public.plan_rows WHERE label = 'New row');

DELETE FROM public.plan_rows
WHERE label = 'New row';
