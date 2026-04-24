import { pasteClipboardSession } from './sessionClipboardPaste.js'

const BULK_SESSION_SELECT = `
  *,
  session_blocks (
    *,
    session_exercises (
      *,
      exercise_library ( name )
    )
  )
`

function rowToClipboardPayload(row) {
  const { session_blocks, ...session } = row
  const blocks = (session_blocks ?? []).map((b) => {
    const { session_exercises, ...brest } = b
    const exercises = (session_exercises ?? []).map((ex) => {
      const { exercise_library: _el, ...erest } = ex
      return erest
    })
    return { ...brest, session_exercises: exercises }
  })
  return { session, blocks }
}

export async function fetchSessionsForBulkCopy(supabase, orgId, sessionIdsOrdered) {
  if (!sessionIdsOrdered.length) return []
  const { data, error } = await supabase
    .from('sessions')
    .select(BULK_SESSION_SELECT)
    .in('id', sessionIdsOrdered)
    .eq('org_id', orgId)
  if (error) throw error
  const byId = new Map((data ?? []).map((r) => [r.id, rowToClipboardPayload(r)]))
  return sessionIdsOrdered.map((id) => byId.get(id)).filter(Boolean)
}

export async function bulkPublishSessions(supabase, orgId, sessionIds) {
  if (!sessionIds.length) return
  const { error } = await supabase
    .from('sessions')
    .update({ is_published: true, publish_at: new Date().toISOString() })
    .in('id', sessionIds)
    .eq('org_id', orgId)
  if (error) throw error
}

export async function bulkDeleteSessionsOrdered(supabase, orgId, sessionIds) {
  if (!sessionIds.length) return
  const { data: blocks, error: eb } = await supabase
    .from('session_blocks')
    .select('id')
    .in('session_id', sessionIds)
    .eq('org_id', orgId)
  if (eb) throw eb
  const blockIds = (blocks ?? []).map((b) => b.id)
  if (blockIds.length) {
    const { error: ee } = await supabase.from('session_exercises').delete().in('block_id', blockIds).eq('org_id', orgId)
    if (ee) throw ee
  }
  const { error: ebl } = await supabase.from('session_blocks').delete().in('session_id', sessionIds).eq('org_id', orgId)
  if (ebl) throw ebl
  const { error: eps } = await supabase.from('programme_sessions').delete().in('session_id', sessionIds).eq('org_id', orgId)
  if (eps) throw eps
  const { error: es } = await supabase.from('sessions').delete().in('id', sessionIds).eq('org_id', orgId)
  if (es) throw es
}

export async function nextProgrammeSessionSortOrder(supabase, orgId, programmeWeekId) {
  const { data: lastPs, error } = await supabase
    .from('programme_sessions')
    .select('sort_order')
    .eq('programme_week_id', programmeWeekId)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (lastPs?.sort_order ?? 0) + 1
}

export async function pasteClipboardToWeekDay(supabase, ctx) {
  const next = await nextProgrammeSessionSortOrder(supabase, ctx.orgId, ctx.programmeWeekId)
  return pasteClipboardSession(supabase, {
    orgId: ctx.orgId,
    clipboard: ctx.clipboard,
    targetDateIso: ctx.targetDateIso,
    programmeWeekId: ctx.programmeWeekId,
    nextSortOrder: next,
  })
}
