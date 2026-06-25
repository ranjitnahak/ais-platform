/** Local calendar date (YYYY-MM-DD) — avoids UTC midnight skew on athlete devices. */
export function localTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Today's sessions for an athlete on their primary team.
 * Mirrors the team calendar schedule; merges any existing RPE log for this athlete.
 */
export async function fetchAthleteTodaySessions(supabase, { athleteId, orgId, today, teamIds }) {
  const effectiveTeamIds = (teamIds ?? []).filter(Boolean);
  if (!effectiveTeamIds.length) return [];

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, session_date, start_time, session_type, venue, rpe_planned, duration_planned, team_id, plan_id')
    .eq('org_id', orgId)
    .in('team_id', effectiveTeamIds)
    .eq('session_date', today)
    .order('start_time');

  if (sessionsError) throw sessionsError;
  if (!sessions?.length) return [];

  const sessionIds = sessions.map((s) => s.id);

  const { data: athleteLogs, error: athleteLogsError } = await supabase
    .from('session_athlete_logs')
    .select('session_id, actual_rpe, actual_duration_min')
    .eq('athlete_id', athleteId)
    .eq('org_id', orgId)
    .in('session_id', sessionIds);

  if (athleteLogsError) throw athleteLogsError;

  const athleteLogBySession = new Map((athleteLogs ?? []).map((log) => [log.session_id, log]));

  const result = sessions.map((session) => {
    const log = athleteLogBySession.get(session.id);
    return {
      sessionId: session.id,
      actualRpe: log?.actual_rpe ?? null,
      actualDurationMin: log?.actual_duration_min ?? null,
      ...session,
    };
  });

  return result;
}
