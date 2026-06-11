-- =============================================================================
-- RLS for session_type_options and session_venue_options
-- Requires can_manage_org_config() from wellness_form_items_admin_rls_v1.sql
-- =============================================================================

ALTER TABLE public.session_type_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_venue_options ENABLE ROW LEVEL SECURITY;

-- session_type_options -------------------------------------------------------

DROP POLICY IF EXISTS session_type_options_select ON public.session_type_options;
CREATE POLICY session_type_options_select
  ON public.session_type_options FOR SELECT TO authenticated
  USING (
    org_id = public.current_user_org_id()
    OR public.is_platform_superuser()
  );

DROP POLICY IF EXISTS session_type_options_insert ON public.session_type_options;
CREATE POLICY session_type_options_insert
  ON public.session_type_options FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_config(org_id));

DROP POLICY IF EXISTS session_type_options_update ON public.session_type_options;
CREATE POLICY session_type_options_update
  ON public.session_type_options FOR UPDATE TO authenticated
  USING (public.can_manage_org_config(org_id))
  WITH CHECK (public.can_manage_org_config(org_id));

DROP POLICY IF EXISTS session_type_options_delete ON public.session_type_options;
CREATE POLICY session_type_options_delete
  ON public.session_type_options FOR DELETE TO authenticated
  USING (public.can_manage_org_config(org_id));

-- session_venue_options ------------------------------------------------------

DROP POLICY IF EXISTS session_venue_options_select ON public.session_venue_options;
CREATE POLICY session_venue_options_select
  ON public.session_venue_options FOR SELECT TO authenticated
  USING (
    org_id = public.current_user_org_id()
    OR public.is_platform_superuser()
  );

DROP POLICY IF EXISTS session_venue_options_insert ON public.session_venue_options;
CREATE POLICY session_venue_options_insert
  ON public.session_venue_options FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_config(org_id));

DROP POLICY IF EXISTS session_venue_options_update ON public.session_venue_options;
CREATE POLICY session_venue_options_update
  ON public.session_venue_options FOR UPDATE TO authenticated
  USING (public.can_manage_org_config(org_id))
  WITH CHECK (public.can_manage_org_config(org_id));

DROP POLICY IF EXISTS session_venue_options_delete ON public.session_venue_options;
CREATE POLICY session_venue_options_delete
  ON public.session_venue_options FOR DELETE TO authenticated
  USING (public.can_manage_org_config(org_id));
