/** Fetch session + blocks + exercises for clipboard copy (weekly programme paste). */

function sortExercises(block) {
  return [...(block.session_exercises ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

function sortBlocks(blocks) {
  return [...(blocks ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

const BLOCK_SELECT = `
  id, session_id, org_id, label, block_type, format, sort_order, notes,
  session_exercises (
    id, block_id, org_id, exercise_id, sort_order, sets, reps,
    prescription_type, prescription_value,
    secondary_prescription_type, secondary_prescription_value,
    tertiary_prescription_type, tertiary_prescription_value,
    superset_group, reps_range_high, tempo, rest_seconds, is_optional, coach_note
  )
`

export async function fetchSessionForClipboard(supabase, orgId, sessionId) {
  const { data: session, error } = await supabase.from('sessions').select('*').eq('id', sessionId).eq('org_id', orgId).single()
  if (error) throw error
  if (!session) throw new Error('Session not found')

  const { data: blocks, error: eb } = await supabase
    .from('session_blocks')
    .select(BLOCK_SELECT)
    .eq('session_id', sessionId)
    .eq('org_id', orgId)
  if (eb) throw eb

  return { session, blocks: blocks ?? [] }
}

/**
 * Deep-insert session from clipboard payload into `programmeWeekId` at `targetDateIso`.
 * Always inserts as draft (`is_published: false`).
 */
export async function pasteClipboardSession(supabase, { orgId, clipboard, targetDateIso, programmeWeekId, nextSortOrder }) {
  const src = clipboard.session
  const blocks = clipboard.blocks ?? []

  const insertSession = {
    org_id: orgId,
    team_id: src.team_id,
    session_date: targetDateIso,
    start_time: src.start_time ?? '09:00:00',
    name: src.name,
    venue: src.venue ?? null,
    coach_instructions: src.coach_instructions ?? null,
    duration_planned: src.duration_planned ?? src.planned_duration_min ?? null,
    category: src.category ?? null,
    session_type: src.session_type ?? null,
    programme_week_id: programmeWeekId,
    plan_cell_id: src.plan_cell_id ?? null,
    notes: src.notes ?? null,
    is_published: false,
    publish_at: null,
  }

  const { data: newSess, error: e1 } = await supabase.from('sessions').insert(insertSession).select().single()
  if (e1) throw e1

  const { error: ePs } = await supabase.from('programme_sessions').insert({
    org_id: orgId,
    programme_week_id: programmeWeekId,
    session_id: newSess.id,
    sort_order: nextSortOrder,
  })
  if (ePs) throw ePs

  for (const b of sortBlocks(blocks)) {
    const { data: nb, error: eB } = await supabase
      .from('session_blocks')
      .insert({
        org_id: orgId,
        session_id: newSess.id,
        label: b.label,
        block_type: b.block_type,
        format: b.format,
        sort_order: b.sort_order ?? 0,
        notes: b.notes ?? null,
      })
      .select('id')
      .single()
    if (eB) throw eB
    for (const ex of sortExercises(b)) {
      const { error: eE } = await supabase.from('session_exercises').insert({
        org_id: orgId,
        block_id: nb.id,
        exercise_id: ex.exercise_id,
        sort_order: ex.sort_order ?? 0,
        sets: ex.sets ?? null,
        reps: ex.reps ?? null,
        prescription_type: ex.prescription_type ?? 'absolute',
        prescription_value: ex.prescription_value ?? null,
        secondary_prescription_type: ex.secondary_prescription_type ?? null,
        secondary_prescription_value: ex.secondary_prescription_value ?? null,
        tertiary_prescription_type: ex.tertiary_prescription_type ?? null,
        tertiary_prescription_value: ex.tertiary_prescription_value ?? null,
        superset_group: ex.superset_group ?? null,
        reps_range_high: ex.reps_range_high ?? null,
        tempo: ex.tempo ?? null,
        rest_seconds: ex.rest_seconds ?? null,
        is_optional: ex.is_optional ?? false,
        coach_note: ex.coach_note ?? null,
      })
      if (eE) throw eE
    }
  }

  return newSess.id
}
