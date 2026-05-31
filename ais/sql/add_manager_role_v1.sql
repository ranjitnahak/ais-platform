-- Add Manager role + default permissions for all orgs, backfill user_roles for manager users.
-- Idempotent — safe to re-run.
--
-- Default permissions: copy from each org's Admin role with can_delete = false.
-- Tune per org in Admin → Roles after applying.

-- 1) Create Manager role where missing (mirror Admin is_system flag per org)
INSERT INTO public.roles (org_id, name, description, is_system)
SELECT admin.org_id,
       'Manager',
       'Operations and roster management',
       admin.is_system
FROM public.roles admin
WHERE admin.name = 'Admin'
  AND NOT EXISTS (
    SELECT 1
    FROM public.roles existing
    WHERE existing.org_id = admin.org_id
      AND existing.name = 'Manager'
  );

-- 2) Seed role_permissions from Admin (no delete by default)
INSERT INTO public.role_permissions (
  role_id,
  org_id,
  resource,
  visible,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT mgr.id,
       mgr.org_id,
       rp.resource,
       rp.visible,
       rp.can_view,
       rp.can_create,
       rp.can_edit,
       false
FROM public.roles mgr
JOIN public.roles admin
  ON admin.org_id = mgr.org_id
 AND admin.name = 'Admin'
JOIN public.role_permissions rp
  ON rp.role_id = admin.id
WHERE mgr.name = 'Manager'
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions existing
    WHERE existing.role_id = mgr.id
      AND existing.resource = rp.resource
  );

-- 3) Link existing users.role = 'manager' to the Manager role
INSERT INTO public.user_roles (user_id, role_id, org_id)
SELECT u.id,
       mgr.id,
       u.org_id
FROM public.users u
JOIN public.roles mgr
  ON mgr.org_id = u.org_id
 AND mgr.name = 'Manager'
WHERE u.role = 'manager'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = u.id
      AND ur.role_id = mgr.id
      AND ur.org_id = u.org_id
  );

-- Verify (expect one Manager row per org, permissions, and linked manager users):
-- SELECT o.name, r.name, COUNT(rp.id) AS perm_count
-- FROM organisations o
-- JOIN roles r ON r.org_id = o.id AND r.name = 'Manager'
-- LEFT JOIN role_permissions rp ON rp.role_id = r.id
-- GROUP BY o.name, r.name
-- ORDER BY o.name;
