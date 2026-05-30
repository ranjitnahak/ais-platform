import { supabase } from './supabase';

/** Ensure a groups row exists for a team (matched by org + name). Returns group id. */
export async function ensureGroupForTeam(orgId, teamId) {
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('id, name, org_id')
    .eq('id', teamId)
    .eq('org_id', orgId)
    .single();
  if (teamErr) throw teamErr;

  const { data: existing, error: findErr } = await supabase
    .from('groups')
    .select('id')
    .eq('org_id', orgId)
    .eq('name', team.name)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from('groups')
    .insert({ org_id: orgId, name: team.name, description: `Team scope: ${team.name}` })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return created.id;
}

/** Map user_roles.group_id values to team ids via matching group/team names within an org. */
export async function resolveTeamIdsForGroups(orgId, groupIds) {
  const uniqueGroupIds = [...new Set((groupIds ?? []).filter(Boolean))];
  if (!uniqueGroupIds.length || !orgId) return [];

  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('id, name')
    .eq('org_id', orgId)
    .in('id', uniqueGroupIds);
  if (gErr) throw gErr;

  const names = [...new Set((groups ?? []).map((g) => g.name).filter(Boolean))];
  if (!names.length) return [];

  const { data: teams, error: tErr } = await supabase
    .from('teams')
    .select('id, name')
    .eq('org_id', orgId)
    .in('name', names);
  if (tErr) throw tErr;

  return (teams ?? []).map((t) => t.id);
}

/** Resolve team ids to group ids, creating groups when needed. */
export async function resolveGroupIdsForTeams(orgId, teamIds) {
  const uniqueTeamIds = [...new Set((teamIds ?? []).filter(Boolean))];
  if (!uniqueTeamIds.length || !orgId) return [];

  const groupIds = [];
  for (const teamId of uniqueTeamIds) {
    groupIds.push(await ensureGroupForTeam(orgId, teamId));
  }
  return groupIds;
}

/** Batch map group_id -> team_id for list views. */
export async function buildGroupToTeamMap(orgId, groupIds) {
  const uniqueGroupIds = [...new Set((groupIds ?? []).filter(Boolean))];
  const map = new Map();
  if (!uniqueGroupIds.length || !orgId) return map;

  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('id, name')
    .eq('org_id', orgId)
    .in('id', uniqueGroupIds);
  if (gErr) throw gErr;

  const names = [...new Set((groups ?? []).map((g) => g.name).filter(Boolean))];
  if (!names.length) return map;

  const { data: teams, error: tErr } = await supabase
    .from('teams')
    .select('id, name')
    .eq('org_id', orgId)
    .in('name', names);
  if (tErr) throw tErr;

  const teamByName = new Map((teams ?? []).map((t) => [t.name, t.id]));
  for (const group of groups ?? []) {
    const teamId = teamByName.get(group.name);
    if (teamId) map.set(group.id, teamId);
  }
  return map;
}
