-- AIS — Org-scoped email conflict lookup for profile save / add user UX.
-- Superseded by users_email_per_org_v1.sql (per-org unique index on users.email).

CREATE OR REPLACE FUNCTION public.get_users_email_conflict(
  p_email text,
  p_org_id uuid,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS TABLE (user_id uuid, full_name text, org_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.full_name, o.name
  FROM public.users u
  LEFT JOIN public.organisations o ON o.id = u.org_id
  WHERE p_email IS NOT NULL
    AND trim(p_email) <> ''
    AND p_org_id IS NOT NULL
    AND u.org_id = p_org_id
    AND lower(trim(u.email)) = lower(trim(p_email))
    AND (p_exclude_user_id IS NULL OR u.id <> p_exclude_user_id)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_users_email_conflict(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_email_conflict(text, uuid, uuid) TO authenticated;
