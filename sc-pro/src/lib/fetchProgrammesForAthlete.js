import { supabase } from './supabaseClient.js'
import { getCurrentUser } from './auth.js'

/**
 * All programme rows assigned to an athlete (direct, programme_athletes, programme_teams,
 * legacy programmes.athlete_id). Same union as ProgrammeExportModal.
 */
export async function fetchProgrammesForAthlete(athlete, orgId) {
  const user = await getCurrentUser()
  const idSet = new Set()
  for (const p of athlete.programmes || []) {
    if (p?.id) idSet.add(p.id)
  }
  try {
    const { data: pa, error: e1 } = await supabase
      .from('programme_athletes')
      .select('programme_id')
      .eq('athlete_id', athlete.id)
      .eq('org_id', orgId)
    if (e1) throw e1
    for (const r of pa || []) if (r.programme_id) idSet.add(r.programme_id)
  } catch (err) {
    console.error('[fetchProgrammesForAthlete] programme_athletes', err)
  }
  const teamIds = (athlete.teams || []).map((t) => t.id).filter(Boolean)
  if (teamIds.length) {
    try {
      const { data: pt, error: e2 } = await supabase
        .from('programme_teams')
        .select('programme_id')
        .eq('org_id', orgId)
        .in('team_id', teamIds)
      if (e2) throw e2
      for (const r of pt || []) if (r.programme_id) idSet.add(r.programme_id)
    } catch (err) {
      console.error('[fetchProgrammesForAthlete] programme_teams', err)
    }
  }
  try {
    const { data: leg, error: e3 } = await supabase.from('programmes').select('id').eq('athlete_id', athlete.id).eq('org_id', orgId).in('team_id', user.teamIds)
    if (e3) throw e3
    for (const r of leg || []) if (r.id) idSet.add(r.id)
  } catch (err) {
    console.error('[fetchProgrammesForAthlete] legacy programmes', err)
  }
  const ids = [...idSet]
  if (!ids.length) return []
  const { data: rows, error } = await supabase
    .from('programmes')
    .select('*')
    .eq('org_id', orgId)
    .in('team_id', user.teamIds)
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error) throw error
  return rows || []
}
