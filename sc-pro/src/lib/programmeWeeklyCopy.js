import { weekDays, isoLocal } from './weekDates.js'

export async function deepCopyWeek({ supabase, user, programme, sourceWeekId, targetWeekId, weeks }) {
  const src = weeks.find((w) => w.id === sourceWeekId)
  const tgt = weeks.find((w) => w.id === targetWeekId)
  if (!src || !tgt) throw new Error('Invalid week')
  if (sourceWeekId === targetWeekId) throw new Error('Source and target week must differ')

  const { count: targetCount, error: cErr } = await supabase
    .from('programme_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('programme_week_id', targetWeekId)
    .eq('org_id', user.orgId)
  if (cErr) throw cErr
  if ((targetCount ?? 0) > 0) {
    throw new Error('Target week already has sessions. Use an empty week or remove sessions first.')
  }

  const delta =
    (new Date(weekDays(programme, tgt.week_number)[0].iso + 'T12:00:00') -
      new Date(weekDays(programme, src.week_number)[0].iso + 'T12:00:00')) /
    86400000

  const { data: psRows, error } = await supabase
    .from('programme_sessions')
    .select('session_id, sort_order, sessions(*)')
    .eq('programme_week_id', sourceWeekId)
    .eq('org_id', user.orgId)
    .order('sort_order', { ascending: true })
  if (error) throw error

  const ordered = [...(psRows ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const seenSessionIds = new Set()
  const teamId = user.teamIds[0]
  let sort = 0
  for (const row of ordered) {
    const s = row.sessions
    if (!s) continue
    if (!user.teamIds?.includes(s.team_id)) continue
    const linkSid = row.session_id ?? s.id
    if (!linkSid || seenSessionIds.has(linkSid)) continue
    seenSessionIds.add(linkSid)
    const oldSid = s.id
    const oldDate = typeof s.session_date === 'string' ? s.session_date.slice(0, 10) : isoLocal(new Date(s.session_date))
    const nd = addDaysIso(oldDate, delta)
    const { data: newS, error: insE } = await supabase
      .from('sessions')
      .insert({
        org_id: user.orgId,
        team_id: s.team_id || teamId,
        session_date: nd,
        start_time: s.start_time,
        name: s.name,
        coach_instructions: s.coach_instructions,
        duration_planned: s.planned_duration_min ?? s.duration_planned ?? null,
        category: s.category,
        session_type: s.session_type,
        programme_week_id: targetWeekId,
      })
      .select()
      .single()
    if (insE) throw insE
    sort += 1
    const { error: psE } = await supabase.from('programme_sessions').insert({
      org_id: user.orgId,
      programme_week_id: targetWeekId,
      session_id: newS.id,
      sort_order: sort,
    })
    if (psE) throw psE
    const { data: blocks, error: bErr } = await supabase
      .from('session_blocks')
      .select('*')
      .eq('session_id', oldSid)
      .eq('org_id', user.orgId)
      .order('sort_order')
    if (bErr) throw bErr
    for (const b of blocks ?? []) {
      const { data: nb, error: nbErr } = await supabase
        .from('session_blocks')
        .insert({
          session_id: newS.id,
          org_id: user.orgId,
          label: b.label,
          block_type: b.block_type,
          format: b.format,
          sort_order: b.sort_order,
          notes: b.notes,
        })
        .select()
        .single()
      if (nbErr) throw nbErr
      const { data: exList, error: exErr } = await supabase
        .from('session_exercises')
        .select('*')
        .eq('block_id', b.id)
        .eq('org_id', user.orgId)
        .order('sort_order')
      if (exErr) throw exErr
      if (exList?.length) {
        const rows = exList.map((e) => ({
          block_id: nb.id,
          org_id: user.orgId,
          exercise_id: e.exercise_id,
          sort_order: e.sort_order,
          sets: e.sets,
          prescription_type: e.prescription_type,
          prescription_value: e.prescription_value,
          secondary_prescription_type: e.secondary_prescription_type,
          secondary_prescription_value: e.secondary_prescription_value,
          tertiary_prescription_type: e.tertiary_prescription_type,
          tertiary_prescription_value: e.tertiary_prescription_value,
          reps: e.reps,
          reps_range_high: e.reps_range_high,
          tempo: e.tempo,
          rest_seconds: e.rest_seconds,
          is_optional: e.is_optional,
          coach_note: e.coach_note,
        }))
        const { error: inEx } = await supabase.from('session_exercises').insert(rows)
        if (inEx) throw inEx
      }
    }
  }
}

function addDaysIso(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}
