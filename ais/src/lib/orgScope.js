/**
 * Org / team scope for superuser org switching.
 * Superusers: prefer team IDs from getCurrentUser().allTeams (already loaded cross-org).
 */
export function getEffectiveOrgId(user, activeOrgId) {
  const isSuperuser = user?.isSuperuser === true;
  return isSuperuser && activeOrgId ? activeOrgId : user?.orgId;
}

export async function resolveOrgTeamScope(supabase, user, activeOrgId) {
  const isSuperuser = user?.isSuperuser === true;
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  let effectiveTeamIds = user?.teamIds ?? [];

  if (isSuperuser && activeOrgId) {
    const fromCache = (user.allTeams ?? [])
      .filter((team) => team.org_id === activeOrgId)
      .map((team) => team.id);
    if (fromCache.length) {
      effectiveTeamIds = fromCache;
    } else {
      const { data: orgTeams, error } = await supabase
        .from('teams')
        .select('id')
        .eq('org_id', effectiveOrgId); // SUPERUSER: intentional cross-org query
      if (error) throw error;
      effectiveTeamIds = orgTeams?.map((team) => team.id) ?? [];
    }
  }

  return { effectiveOrgId, effectiveTeamIds, isSuperuser };
}

/** Teams already filtered by org_id — do not intersect with empty effectiveTeamIds. */
export function scopeTeamsForDisplay(teamRows, effectiveTeamIds, isSuperuser) {
  const rows = teamRows ?? [];
  if (isSuperuser) return rows;
  if (!effectiveTeamIds?.length) return [];
  return rows.filter((team) => effectiveTeamIds.includes(team.id));
}

export function teamIdsForMembership(effectiveTeamIds, teamRows) {
  if (effectiveTeamIds?.length) return effectiveTeamIds;
  return (teamRows ?? []).map((team) => team.id);
}

/** Resolve active team id against available teams; fall back to first or null. */
export function getEffectiveTeamId(activeTeamId, availableTeamIds) {
  const ids = availableTeamIds ?? [];
  if (!ids.length) return null;
  if (activeTeamId && ids.includes(activeTeamId)) return activeTeamId;
  return ids[0] ?? null;
}

/** Athlete portal: use roster primary team, not staff localStorage team switcher. */
export function resolveAthleteSessionTeamIds(user) {
  const athleteTeamIds = user?.teamIds ?? [];
  if (!athleteTeamIds.length) return [];
  if (user?.primaryTeamId && athleteTeamIds.includes(user.primaryTeamId)) {
    return [user.primaryTeamId];
  }
  if (athleteTeamIds.length === 1) return athleteTeamIds;
  return [athleteTeamIds[0]];
}

/** Narrow scope to a single active team when set. */
export function narrowTeamIds(effectiveTeamIds, activeTeamId) {
  const ids = effectiveTeamIds ?? [];
  if (activeTeamId && ids.includes(activeTeamId)) return [activeTeamId];
  if (activeTeamId) return [activeTeamId];
  return ids;
}

export const ACTIVE_TEAM_STORAGE_KEY = 'ais_active_team_id';

export function readStoredTeamId(orgId) {
  if (typeof window === 'undefined' || !orgId) return null;
  try {
    const map = JSON.parse(window.localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY) ?? '{}');
    const teamId = map[orgId];
    return teamId ?? null;
  } catch {
    return null;
  }
}

export function writeStoredTeamId(orgId, teamId) {
  if (typeof window === 'undefined' || !orgId) return;
  try {
    const map = JSON.parse(window.localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY) ?? '{}');
    if (teamId) map[orgId] = teamId;
    else delete map[orgId];
    window.localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function clearStoredTeamIds() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY);
}
