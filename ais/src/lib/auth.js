import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const ACTION_MAP = { view: 'canView', create: 'canCreate', edit: 'canEdit', delete: 'canDelete', admin: 'canEdit' };

export async function getCurrentUser() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) return null;
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, org_id, role')
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
    return {
      id: user.id, orgId: user.org_id, role: roleName, permissions,
      teamIds: (teamRows ?? []).map((team) => team.id),
    };
  } catch (err) {
    console.error('[auth.js] failed to resolve current user:', err);
    return null;
  }
}

// Use canSync() in JSX/components with user from useCurrentUser()
// Use can() in async lib functions and hooks
export function canSync(user, resource, action) {
  if (!user) return false;
  return Boolean(user?.permissions?.[resource]?.[ACTION_MAP[action]]);
}

export async function can(resource, action) {
  try {
    const user = await getCurrentUser();
    return Boolean(user?.permissions?.[resource]?.[ACTION_MAP[action]]);
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
