/** Local calendar date (YYYY-MM-DD) — avoids UTC midnight skew on athlete devices. */
export function localTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function mapSessionAthleteLogRows(rows) {
  return (rows ?? []).map((row) => {
    const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
    return {
      sessionId: row.session_id,
      actualRpe: row.actual_rpe,
      ...session,
    };
  });
}

export async function fetchAthleteTodaySessions(supabase, { athleteId, orgId, today }) {
  const { data, error } = await supabase
    .from('session_athlete_logs')
    .select(`
      session_id,
      actual_rpe,
      sessions!inner(
        id, session_date, start_time, session_type, venue, rpe_planned, duration_planned, team_id
      )
    `)
    .eq('athlete_id', athleteId)
    .eq('org_id', orgId)
    .eq('sessions.session_date', today)
    .order('start_time', { foreignTable: 'sessions', ascending: true });

  if (error) throw error;
  return mapSessionAthleteLogRows(data);
}
