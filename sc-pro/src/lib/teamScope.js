export const ACTIVE_TEAM_STORAGE_KEY = 'ais_active_team_id';

export function readStoredTeamId(orgId) {
  if (typeof window === 'undefined' || !orgId) return null;
  try {
    const map = JSON.parse(window.localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY) ?? '{}');
    return map[orgId] ?? null;
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

export function getEffectiveTeamId(activeTeamId, availableTeamIds) {
  const ids = availableTeamIds ?? [];
  if (!ids.length) return null;
  if (activeTeamId && ids.includes(activeTeamId)) return activeTeamId;
  return ids[0] ?? null;
}

/** Returns scoped team ids for queries — single active team when set. */
export function getScopedTeamIds(userTeamIds, activeTeamId) {
  const ids = userTeamIds ?? [];
  if (activeTeamId && ids.includes(activeTeamId)) return [activeTeamId];
  if (activeTeamId) return [activeTeamId];
  return ids;
}
