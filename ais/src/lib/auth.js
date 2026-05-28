import { supabase } from './supabase';

const ACTION_MAP = { view: 'canView', create: 'canCreate', edit: 'canEdit', delete: 'canDelete', admin: 'canEdit' };
const PERMISSION_COLUMN = { canView: 'can_view', canCreate: 'can_create', canEdit: 'can_edit', canDelete: 'can_delete' };

function applyPermissionOverrides(permissions, overrideRows) {
  const merged = { ...permissions };
  for (const row of overrideRows ?? []) {
    if (!merged[row.resource]) {
      merged[row.resource] = { canView: false, canCreate: false, canEdit: false, canDelete: false };
    }
    for (const [key, col] of Object.entries(PERMISSION_COLUMN)) {
      if (row[col] != null) merged[row.resource][key] = Boolean(row[col]);
    }
  }
  return merged;
}

function resolvePermission(user, resource, action) {
  if (!user) return false;
  if (user.isSuperuser) return true;
  const permKey = ACTION_MAP[action];
  return Boolean(user?.permissions?.[resource]?.[permKey]);
}

export async function getCurrentUser() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) return null;
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, org_id, role, athlete_id, full_name')
      .eq('auth_id', session.user.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return null;

    const { data: roleRows, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_id, roles(name), group_id')
      .eq('user_id', user.id)
      .eq('org_id', user.org_id);
    if (rolesError) throw rolesError;
    const primaryRole = roleRows?.[0];
    const roleName = Array.isArray(primaryRole?.roles) ? primaryRole.roles[0]?.name : primaryRole?.roles?.name;
    if (!primaryRole?.role_id || !roleName) {
      console.error('[auth.js] no role found for current user');
      return null;
    }

    if (roleName?.toLowerCase() === 'superuser') {
      const [orgsResult, teamsResult] = await Promise.all([
        supabase.from('organisations').select('id, name, slug').order('name'),
        supabase.from('teams').select('id, org_id, name').order('name'),
      ]);
      if (orgsResult.error) throw orgsResult.error;
      if (teamsResult.error) throw teamsResult.error;

      const allOrgs = orgsResult.data ?? [];
      const allTeams = teamsResult.data ?? [];
      const localActiveOrgId = typeof window !== 'undefined' ? window.localStorage.getItem('activeOrgId') : null;
      const activeOrgId = allOrgs.some((org) => org.id === localActiveOrgId) ? localActiveOrgId : user.org_id;

      return {
        id: user.id,
        orgId: activeOrgId,
        fullName: user.full_name ?? null,
        role: 'superuser',
        permissions: {},
        teamIds: allTeams.map((team) => team.id),
        athleteId: null,
        isSuperuser: true,
        allOrgs,
        allTeams,
      };
    }
    const [teamsResult, permissionsResult, overridesResult] = await Promise.all([
      supabase.from('teams').select('id').eq('org_id', user.org_id),
      supabase
        .from('role_permissions')
        .select('resource, can_view, can_create, can_edit, can_delete')
        .eq('role_id', primaryRole.role_id)
        .eq('org_id', user.org_id),
      supabase
        .from('user_permission_overrides')
        .select('resource, can_view, can_create, can_edit, can_delete')
        .eq('user_id', user.id)
        .eq('org_id', user.org_id),
    ]);
    if (teamsResult.error) throw teamsResult.error;
    if (permissionsResult.error) throw permissionsResult.error;
    if (overridesResult.error) throw overridesResult.error;

    const teamRows = teamsResult.data;
    const permissionRows = permissionsResult.data;
    const overrideRows = overridesResult.data;

    const permissions = {};
    for (const row of permissionRows ?? []) {
      permissions[row.resource] = {
        canView: Boolean(row.can_view), canCreate: Boolean(row.can_create),
        canEdit: Boolean(row.can_edit), canDelete: Boolean(row.can_delete),
      };
    }

    const resolvedPermissions = applyPermissionOverrides(permissions, overrideRows);

    return {
      id: user.id, orgId: user.org_id, fullName: user.full_name ?? null,
      role: roleName?.toLowerCase(), permissions: resolvedPermissions,
      teamIds: (teamRows ?? []).map((team) => team.id),
      athleteId: user.athlete_id ?? null,
      isSuperuser: false,
      allOrgs: [],
      allTeams: [],
    };
  } catch (err) {
    console.error('[auth.js] failed to resolve current user:', err);
    return null;
  }
}

// Use canSync() in JSX/components with user from useUser() (UserContext)
// Use can() in async lib functions and hooks
export function canSync(user, resource, action) {
  return resolvePermission(user, resource, action);
}

export async function can(resource, action) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user?.orgId) return false;
    if (user.isSuperuser) return true;

    const permKey = ACTION_MAP[action];
    const column = PERMISSION_COLUMN[permKey];
    const { data: overrideRow, error: overrideError } = await supabase
      .from('user_permission_overrides')
      .select('can_view, can_create, can_edit, can_delete')
      .eq('user_id', user.id)
      .eq('org_id', user.orgId)
      .eq('resource', resource)
      .maybeSingle();
    if (overrideError) throw overrideError;
    if (overrideRow && overrideRow[column] != null) return Boolean(overrideRow[column]);

    return resolvePermission(user, resource, action);
  } catch (err) {
    console.error('[auth.js] permission check failed:', err);
    return false;
  }
}

export async function getAccessibleTeams() { try { const user = await getCurrentUser(); return user?.teamIds ?? []; } catch (err) { console.error('[auth.js] accessible teams check failed:', err); return []; } }

export async function canEditPlan(plan) { try { const allowed = await can('periodisation', 'edit'); const user = await getCurrentUser(); return Boolean(allowed && user?.teamIds?.includes(plan?.team_id)); } catch (err) { console.error('[auth.js] plan edit check failed:', err); return false; } }

export async function canEditSessionLibrary() { try { return await can('sessionLibrary', 'admin'); } catch (err) { console.error('[auth.js] session library check failed:', err); return false; } }

// const FALLBACK_USER = {
//   id: 'u1000000-0000-0000-0000-000000000001',
//   orgId: 'a1000000-0000-0000-0000-000000000001',
//   role: 'staff',
//   permissions: {
//     periodisation: 'edit',
//     assessments: 'edit',
//     reports: 'view',
//     sessionLibrary: 'admin',
//     adminConfig: 'admin',
//     programme: 'edit',
//     viewCoachingData: true,
//   },
//   teamIds: [
//     'b2000000-0000-0000-0000-000000000001',
//     'b2000000-0000-0000-0000-000000000002',
//     'b1000000-0000-0000-0000-000000000001',
//   ],
// };
