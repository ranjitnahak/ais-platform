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
