import { toSessionUpsertRow } from '../hooks/useSessions';
import { addDays } from './periodisationUtils';
import { copySessionAthleteLogs } from './sessionAthleteLogSync';

/**
 * Duplicate all sessions in the current week to the following week (+7 days).
 * Merges into the target week without removing existing sessions.
 */
export async function copyWeekSessionsToNext({ supabase, orgId, teamId, planId, sessions }) {
  if (!sessions?.length) return { count: 0 };

  const rows = sessions.map((session) => {
    const base = toSessionUpsertRow(session);
    const dateIso =
      typeof base.session_date === 'string'
        ? base.session_date.slice(0, 10)
        : base.session_date;

    delete base.id;
    delete base.rpe_actual;
    delete base.duration_actual;
    delete base.publish_at;
    delete base.created_by;
    delete base.programme_week_id;
    delete base.plan_cell_id;

    return {
      ...base,
      org_id: orgId,
      team_id: teamId,
      plan_id: planId,
      session_date: addDays(dateIso, 7),
      is_published: false,
    };
  });

  const { data, error } = await supabase.from('sessions').insert(rows).select('id');
  if (error) throw error;

  const created = data ?? [];
  await Promise.all(
    created.map((row, index) =>
      copySessionAthleteLogs(supabase, {
        fromSessionId: sessions[index]?.id ?? null,
        toSessionId: row.id,
        orgId,
        teamId,
      }),
    ),
  );

  return { count: created.length };
}
