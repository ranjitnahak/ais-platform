import { useEffect, useState } from 'react';
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
      .select('id, org_id, role, athlete_id')
      .eq('auth_id', session.user.id)
      .single();
    if (userError) throw userError;

    const { data: roleRows, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_id, roles(name), group_id')
      .eq('user_id', user.id)
      .eq('org_id', user.org_id);
    if (rolesError) throw rolesError;
    const primaryRole = roleRows?.[0];
    const roleName = Array.isArray(primaryRole?.roles) ? primaryRole.roles[0]?.name : primaryRole?.roles?.name;
    if (!primaryRole?.role_id || !roleName) throw new Error('No role found for current user.');
    const { data: teamRows, error: teamsError } = await supabase
      .from('teams')
      .select('id')
      .eq('org_id', user.org_id);
    if (teamsError) throw teamsError;

    const { data: permissionRows, error: permissionsError } = await supabase
      .from('role_permissions')
      .select('resource, can_view, can_create, can_edit, can_delete')
      .eq('role_id', primaryRole.role_id)
      .eq('org_id', user.org_id);
    if (permissionsError) throw permissionsError;
    const permissions = {};
    for (const row of permissionRows ?? []) {
      permissions[row.resource] = {
        canView: Boolean(row.can_view), canCreate: Boolean(row.can_create),
        canEdit: Boolean(row.can_edit), canDelete: Boolean(row.can_delete),
      };
    }

    const { data: overrideRows, error: overridesError } = await supabase
      .from('user_permission_overrides')
      .select('resource, can_view, can_create, can_edit, can_delete')
      .eq('user_id', user.id)
      .eq('org_id', user.org_id);
    if (overridesError) throw overridesError;

    const resolvedPermissions = applyPermissionOverrides(permissions, overrideRows);

    return {
      id: user.id, orgId: user.org_id, role: roleName, permissions: resolvedPermissions,
      teamIds: (teamRows ?? []).map((team) => team.id),
      athleteId: user.athlete_id ?? null,
    };
  } catch (err) {
    console.error('[auth.js] failed to resolve current user:', err);
    return null;
  }
}

// Use canSync() in JSX/components with user from useCurrentUser()
// Use can() in async lib functions and hooks
export function canSync(user, resource, action) {
  return resolvePermission(user, resource, action);
}

export async function can(resource, action) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user?.orgId) return false;

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

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        if (mounted) setUser(currentUser);
      } catch (err) {
        console.error('[auth.js] useCurrentUser failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUser();
    return () => { mounted = false; };
  }, []);
  return { user, loading };
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
