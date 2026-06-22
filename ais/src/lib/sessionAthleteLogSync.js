/** Active athletes on a team roster (org-scoped). */
export async function fetchActiveTeamAthleteIds(supabase, { teamId, orgId }) {
  if (!teamId || !orgId) return [];

  const { data, error } = await supabase
    .from('athlete_teams')
    .select('athlete_id, athletes!inner(id, is_active)')
    .eq('team_id', teamId)
    .eq('athletes.org_id', orgId)
    .eq('athletes.is_active', true)
    .is('left_at', null);

  if (error) throw error;
  return (data ?? []).map((row) => row.athlete_id).filter(Boolean);
}

export async function fetchSessionAthleteIds(supabase, { sessionId, orgId }) {
  if (!sessionId || !orgId) return [];

  const { data, error } = await supabase
    .from('session_athlete_logs')
    .select('athlete_id')
    .eq('session_id', sessionId)
    .eq('org_id', orgId);

  if (error) throw error;
  return (data ?? []).map((row) => row.athlete_id);
}

export async function seedSessionAthleteLogs(supabase, { sessionId, athleteIds, orgId, teamId }) {
  if (!sessionId || !orgId || !teamId || !athleteIds?.length) return 0;

  const rows = athleteIds.map((athleteId) => ({
    session_id: sessionId,
    athlete_id: athleteId,
    org_id: orgId,
    team_id: teamId,
  }));

  const { error } = await supabase.from('session_athlete_logs').insert(rows);
  if (error) throw error;
  return rows.length;
}

/**
 * Copy athlete assignments from one session to another.
 * Falls back to the full team roster when the source session has no logs.
 */
export async function copySessionAthleteLogs(supabase, { fromSessionId, toSessionId, orgId, teamId }) {
  if (!toSessionId || !orgId || !teamId) return 0;

  let athleteIds = [];
  if (fromSessionId) {
    athleteIds = await fetchSessionAthleteIds(supabase, { sessionId: fromSessionId, orgId });
  }
  if (!athleteIds.length) {
    athleteIds = await fetchActiveTeamAthleteIds(supabase, { teamId, orgId });
  }

  return seedSessionAthleteLogs(supabase, {
    sessionId: toSessionId,
    athleteIds,
    orgId,
    teamId,
  });
}
