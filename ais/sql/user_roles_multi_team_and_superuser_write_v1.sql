-- AIS — Fix staff multi-team assignment on user_roles.
-- Symptom: duplicate key on user_roles_user_id_role_id_org_id_key when saving staff with 2+ teams.
-- Causes:
--   1) UNIQUE (user_id, role_id, org_id) ignores group_id, so only one row per role/org was allowed.
--   2) Superusers had INSERT/SELECT on user_roles but not DELETE/UPDATE, so syncStaffTeams could not
--      remove the org-wide row (group_id NULL) before inserting team-scoped rows.
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_id_org_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_org_group_key
  ON public.user_roles (user_id, role_id, org_id, group_id)
  NULLS NOT DISTINCT;

DROP POLICY IF EXISTS user_roles_platform_superuser_delete ON public.user_roles;
CREATE POLICY user_roles_platform_superuser_delete
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS user_roles_platform_superuser_update ON public.user_roles;
CREATE POLICY user_roles_platform_superuser_update
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());
