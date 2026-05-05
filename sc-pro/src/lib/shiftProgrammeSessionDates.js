import { addCalendarDaysToIso, isoLocal } from './weekDates.js'

const CHUNK = 24

/**
 * Add `deltaDays` to every session_date for sessions linked to this programme (all weeks).
 * Used when the programme week anchor moves so blocks stay on the same weekday within each programme week.
 */
export async function shiftProgrammeSessionsByDelta({ supabase, orgId, programmeId, deltaDays }) {
  if (!deltaDays) return
  const { data: wks, error: e0 } = await supabase
    .from('programme_weeks')
    .select('id')
    .eq('programme_id', programmeId)
    .eq('org_id', orgId)
  if (e0) throw e0
  const weekIds = (wks ?? []).map((w) => w.id)
  if (!weekIds.length) return

  const { data: ps, error: e1 } = await supabase
    .from('programme_sessions')
    .select('session_id')
    .in('programme_week_id', weekIds)
    .eq('org_id', orgId)
  if (e1) throw e1
  const sessionIds = [...new Set((ps ?? []).map((r) => r.session_id).filter(Boolean))]
  if (!sessionIds.length) return

  const { data: sess, error: e2 } = await supabase
    .from('sessions')
    .select('id, session_date')
    .in('id', sessionIds)
    .eq('org_id', orgId)
  if (e2) throw e2

  for (let i = 0; i < (sess ?? []).length; i += CHUNK) {
    const batch = sess.slice(i, i + CHUNK)
    await Promise.all(
      batch.map(async (s) => {
        const cur =
          typeof s.session_date === 'string'
            ? s.session_date.slice(0, 10)
            : s.session_date != null
              ? isoLocal(new Date(s.session_date))
              : null
        if (!cur) return
        const next = addCalendarDaysToIso(cur, deltaDays)
        const { error } = await supabase.from('sessions').update({ session_date: next }).eq('id', s.id).eq('org_id', orgId)
        if (error) throw error
      }),
    )
  }
}
