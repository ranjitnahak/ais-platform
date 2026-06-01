-- =============================================================================
-- RLS for wellness_form_items and wellness_thresholds
-- Org-scoped read; admin/superuser write.
-- =============================================================================

-- Helper: current user's org_id
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.org_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;

-- Helper: admin or superuser in org
CREATE OR REPLACE FUNCTION public.can_manage_org_config(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_platform_superuser()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id AND ur.org_id = p_org_id
      JOIN public.roles r ON r.id = ur.role_id
      WHERE u.auth_id = auth.uid()
        AND u.org_id = p_org_id
        AND lower(trim(r.name)) IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.org_id = p_org_id
        AND lower(trim(u.role::text)) IN ('admin', 'manager')
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_org_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_org_config(uuid) TO authenticated;

-- wellness_form_items -------------------------------------------------------

ALTER TABLE public.wellness_form_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wellness_form_items_select ON public.wellness_form_items;
CREATE POLICY wellness_form_items_select
  ON public.wellness_form_items FOR SELECT TO authenticated
  USING (
    org_id = public.current_user_org_id()
    OR public.is_platform_superuser()
  );

DROP POLICY IF EXISTS wellness_form_items_insert ON public.wellness_form_items;
CREATE POLICY wellness_form_items_insert
  ON public.wellness_form_items FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_config(org_id));

DROP POLICY IF EXISTS wellness_form_items_update ON public.wellness_form_items;
CREATE POLICY wellness_form_items_update
  ON public.wellness_form_items FOR UPDATE TO authenticated
  USING (public.can_manage_org_config(org_id))
  WITH CHECK (public.can_manage_org_config(org_id));

DROP POLICY IF EXISTS wellness_form_items_delete ON public.wellness_form_items;
CREATE POLICY wellness_form_items_delete
  ON public.wellness_form_items FOR DELETE TO authenticated
  USING (public.can_manage_org_config(org_id));

-- wellness_thresholds -------------------------------------------------------

ALTER TABLE public.wellness_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wellness_thresholds_select ON public.wellness_thresholds;
CREATE POLICY wellness_thresholds_select
  ON public.wellness_thresholds FOR SELECT TO authenticated
  USING (
    org_id = public.current_user_org_id()
    OR public.is_platform_superuser()
  );

DROP POLICY IF EXISTS wellness_thresholds_insert ON public.wellness_thresholds;
CREATE POLICY wellness_thresholds_insert
  ON public.wellness_thresholds FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_config(org_id));

DROP POLICY IF EXISTS wellness_thresholds_update ON public.wellness_thresholds;
CREATE POLICY wellness_thresholds_update
  ON public.wellness_thresholds FOR UPDATE TO authenticated
  USING (public.can_manage_org_config(org_id))
  WITH CHECK (public.can_manage_org_config(org_id));

DROP POLICY IF EXISTS wellness_thresholds_delete ON public.wellness_thresholds;
CREATE POLICY wellness_thresholds_delete
  ON public.wellness_thresholds FOR DELETE TO authenticated
  USING (public.can_manage_org_config(org_id));
