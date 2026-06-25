import { supabase } from './supabase';
import { formatRoleOrPosition } from './adminUserConstants';
import { resolveTeamIdsForGroups } from './teamGroups';

const ACTION_MAP = { view: 'canView', create: 'canCreate', edit: 'canEdit', delete: 'canDelete', admin: 'canEdit' };
const PERMISSION_COLUMN = { canView: 'can_view', canCreate: 'can_create', canEdit: 'can_edit', canDelete: 'can_delete' };
const ACTIVE_ORG_STORAGE_KEY = 'ais_active_org_id';

function emptyPermission() {
  return { canView: false, canCreate: false, canEdit: false, canDelete: false, visible: true };
}

function applyPermissionOverrides(permissions, overrideRows) {
  const merged = { ...permissions };
  for (const row of overrideRows ?? []) {
    if (!merged[row.resource]) {
      merged[row.resource] = emptyPermission();
    }
    for (const [key, col] of Object.entries(PERMISSION_COLUMN)) {
      if (row[col] != null) merged[row.resource][key] = Boolean(row[col]);
    }
    if (row.visible != null) merged[row.resource].visible = Boolean(row.visible);
  }
  return merged;
}

function resolvePermission(user, resource, action) {
  if (!user) return false;
  if (user.isSuperuser) return true;
  const permKey = ACTION_MAP[action];
  return Boolean(user?.permissions?.[resource]?.[permKey]);
}

function resolveVisible(user, resource) {
  if (!user) return false;
  if (user.isSuperuser) return true;
  const perm = user?.permissions?.[resource];
  if (perm && typeof perm.visible === 'boolean') return perm.visible;
  return true;
}

async function loadOrgProfile(orgId) {
  if (!orgId) return { orgName: null, orgLogoUrl: null };
  try {
    const { data, error } = await supabase
      .from('organisations')
      .select('name, logo_url')
      .eq('id', orgId)
      .maybeSingle();
    if (error) throw error;
    return { orgName: data?.name ?? null, orgLogoUrl: data?.logo_url ?? null };
  } catch (err) {
    console.error('[auth.js] loadOrgProfile failed:', err);
    return { orgName: null, orgLogoUrl: null };
  }
}

async function loadAthleteProfile(orgId, athleteId) {
  if (!orgId || !athleteId) return { position: null, teamName: null, primaryTeamId: null };
  try {
    const [athleteResult, teamResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('position')
        .eq('org_id', orgId)
        .eq('id', athleteId)
        .maybeSingle(),
      supabase
        .from('athlete_teams')
        .select('team_id, teams(id, name)')
        .eq('athlete_id', athleteId)
        .is('left_at', null)
        .order('joined_at', { ascending: true }),
    ]);
    if (athleteResult.error) throw athleteResult.error;
    if (teamResult.error) throw teamResult.error;
    const primaryLink = (teamResult.data ?? [])[0];
    const teams = primaryLink?.teams;
    const teamName = Array.isArray(teams) ? teams[0]?.name : teams?.name;
    return {
      position: athleteResult.data?.position ?? null,
      teamName: teamName ?? null,
      primaryTeamId: primaryLink?.team_id ?? null,
    };
  } catch (err) {
    console.error('[auth.js] loadAthleteProfile failed:', err);
    return { position: null, teamName: null, primaryTeamId: null };
  }
}

export async function getCurrentUser() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) return null;
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, org_id, role, athlete_id, full_name, is_active')
      .eq('auth_id', session.user.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return null;
    if (user.is_active === false) return null;

    const { data: roleRows, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_id, roles(name), group_id, org_id')
      .eq('user_id', user.id);
    if (rolesError) throw rolesError;

    const roleNameFromRow = (row) => {
      if (!row) return null;
      const roles = row.roles;
      return Array.isArray(roles) ? roles[0]?.name : roles?.name;
    };

    const orgScopedRows = user.org_id
      ? (roleRows ?? []).filter((row) => row.org_id === user.org_id)
      : [];
    const superuserRow = (roleRows ?? []).find(
      (row) => roleNameFromRow(row)?.toLowerCase() === 'superuser',
    );
    const primaryRole = superuserRow ?? orgScopedRows[0] ?? roleRows?.[0];
    let roleName = roleNameFromRow(primaryRole) ?? user.role ?? null;

    if (!roleName) {
      console.error('[auth.js] no role found for current user');
      return null;
    }

    if (roleName.toLowerCase() === 'superuser') {
      const [orgsResult, teamsResult] = await Promise.all([
        supabase.from('organisations').select('id, name, slug, logo_url').order('name'), // SUPERUSER: intentional cross-org query
        supabase.from('teams').select('id, org_id, name').order('name'), // SUPERUSER: intentional cross-org query
      ]);
      if (orgsResult.error) throw orgsResult.error;
      if (teamsResult.error) throw teamsResult.error;

      const allOrgs = orgsResult.data ?? [];
      const allTeams = teamsResult.data ?? [];
      const localActiveOrgId = typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) : null;
      const activeOrgId = allOrgs.some((org) => org.id === localActiveOrgId)
        ? localActiveOrgId
        : (user.org_id ?? allOrgs[0]?.id ?? null);

      const activeOrg = allOrgs.find((org) => org.id === activeOrgId);

      return {
        id: user.id,
        orgId: activeOrgId,
        fullName: user.full_name ?? null,
        role: 'superuser',
        roleLabel: formatRoleOrPosition('superuser'),
        permissions: {},
        teamIds: allTeams.map((team) => team.id),
        athleteId: null,
        isSuperuser: true,
        allOrgs,
        allTeams,
        orgName: activeOrg?.name ?? null,
        orgLogoUrl: activeOrg?.logo_url ?? null,
        position: null,
        teamName: null,
      };
    }

    let roleId = primaryRole?.role_id;
    if (!roleId && user.org_id) {
      const { data: roleRow, error: roleLookupError } = await supabase
        .from('roles')
        .select('id')
        .eq('org_id', user.org_id)
        .ilike('name', roleName)
        .maybeSingle();
      if (roleLookupError) throw roleLookupError;
      roleId = roleRow?.id ?? null;
    }
    if (!roleId || !user.org_id) {
      console.error('[auth.js] no role_id or org_id for current user');
      return null;
    }

    const normalizedRole = roleName?.toLowerCase();
    const athleteTeamsPromise = normalizedRole === 'athlete' && user.athlete_id
      ? supabase
          .from('athlete_teams')
          .select('team_id')
          .eq('athlete_id', user.athlete_id)
          .is('left_at', null)
          .order('joined_at', { ascending: true })
      : Promise.resolve({ data: [], error: null });
    const athleteActivePromise = normalizedRole === 'athlete' && user.athlete_id
      ? supabase.from('athletes').select('is_active').eq('id', user.athlete_id).maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [teamsResult, permissionsResult, overridesResult, athleteTeamsResult, athleteActiveResult] = await Promise.all([
      supabase.from('teams').select('id').eq('org_id', user.org_id),
      supabase
        .from('role_permissions')
        .select('resource, can_view, can_create, can_edit, can_delete, visible')
        .eq('role_id', roleId)
        .eq('org_id', user.org_id),
      supabase
        .from('user_permission_overrides')
        .select('resource, can_view, can_create, can_edit, can_delete, visible')
        .eq('user_id', user.id)
        .eq('org_id', user.org_id),
      athleteTeamsPromise,
      athleteActivePromise,
    ]);
    if (teamsResult.error) throw teamsResult.error;
    if (permissionsResult.error) throw permissionsResult.error;
    if (overridesResult.error) throw overridesResult.error;
    if (athleteTeamsResult.error) throw athleteTeamsResult.error;
    if (athleteActiveResult.error) throw athleteActiveResult.error;
    if (athleteActiveResult.data?.is_active === false) return null;

    const teamRows = teamsResult.data;
    const permissionRows = permissionsResult.data;
    const overrideRows = overridesResult.data;
    const allOrgTeamIds = (teamRows ?? []).map((team) => team.id);
    const assignedStaffGroupIds = [...new Set(orgScopedRows.map((row) => row.group_id).filter(Boolean))];
    const resolvedStaffTeamIds = assignedStaffGroupIds.length
      ? await resolveTeamIdsForGroups(user.org_id, assignedStaffGroupIds)
      : [];
    const athleteTeamIds = (athleteTeamsResult.data ?? []).map((row) => row.team_id);
    const teamIds = normalizedRole === 'athlete'
      ? athleteTeamIds
      : (resolvedStaffTeamIds.length > 0 ? resolvedStaffTeamIds : allOrgTeamIds);

    const permissions = {};
    for (const row of permissionRows ?? []) {
      permissions[row.resource] = {
        canView: Boolean(row.can_view),
        canCreate: Boolean(row.can_create),
        canEdit: Boolean(row.can_edit),
        canDelete: Boolean(row.can_delete),
        visible: row.visible !== false,
      };
    }

    const resolvedPermissions = applyPermissionOverrides(permissions, overrideRows);
    const [orgProfile, athleteProfile] = await Promise.all([
      loadOrgProfile(user.org_id),
      normalizedRole === 'athlete'
        ? loadAthleteProfile(user.org_id, user.athlete_id)
        : Promise.resolve({ position: null, teamName: null }),
    ]);

    return {
      id: user.id, orgId: user.org_id, fullName: user.full_name ?? null,
      role: normalizedRole, permissions: resolvedPermissions,
      teamIds,
      athleteId: user.athlete_id ?? null,
      isSuperuser: false,
      allOrgs: [],
      allTeams: [],
      orgName: orgProfile.orgName,
      orgLogoUrl: orgProfile.orgLogoUrl,
      roleLabel: formatRoleOrPosition(normalizedRole),
      position: athleteProfile.position,
      teamName: athleteProfile.teamName,
      primaryTeamId: athleteProfile.primaryTeamId,
    };
  } catch (err) {
    console.error('[auth.js] failed to resolve current user:', err);
    return null;
  }
}

// Use canSync() in JSX/components with user from useUser() (UserContext)
// Use can() in async lib functions and hooks
export function canSync(user, resource, action) {
  if (user?.isSuperuser === true) return true;
  return resolvePermission(user, resource, action);
}

export function isVisibleSync(user, resource) {
  return resolveVisible(user, resource);
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

export const canEditAttendance = (session, user) => {
  const hoursSince = (Date.now() - new Date(session.session_date)) / 36e5;
  if (hoursSince <= 48) return canSync(user, 'attendance', 'edit');
  return user.role === 'admin' || user.role === 'superuser';
};

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
