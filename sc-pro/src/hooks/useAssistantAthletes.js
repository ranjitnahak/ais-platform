import { useEffect } from 'react'
import { registerPageContext, unregisterPageContext } from '../lib/assistantContext.js'
import { registerAction, unregisterAction } from '../lib/assistantActions.js'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'
import { buildProgrammePDF } from '../lib/buildProgrammePDF.js'
import { fetchProgrammesForAthlete } from '../lib/fetchProgrammesForAthlete.js'

const ACTIONS = ['assign_programme_to_athlete', 'filter_athletes_by_team', 'export_athlete_programme_pdf']

function matchAthleteFromPayload(athletes, payload) {
  const id = payload.athlete_id
  if (id && String(id).trim()) {
    const found = (athletes ?? []).find((a) => a.id === id)
    if (found) return found
  }
  const raw = payload.athlete_name ?? payload.name ?? ''
  const q = String(raw).trim().toLowerCase()
  if (!q) return null
  const list = athletes ?? []
  const exact = list.find((a) => (a.display_name || '').toLowerCase() === q)
  if (exact) return exact
  const partial = list.filter((a) => (a.display_name || '').toLowerCase().includes(q))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    throw new Error(`Multiple athletes match "${String(raw).trim()}". Use athlete_id from context.`)
  }
  return null
}

function pickProgrammeRow(rows, payload, athlete) {
  const pid = payload.programme_id
  if (pid) {
    const row = rows.find((r) => r.id === pid)
    if (row) return row
    throw new Error('programme_id not found for this athlete')
  }
  const pname = String(payload.programme_name ?? '').trim().toLowerCase()
  if (pname) {
    const row = rows.find((r) => String(r.name || '').toLowerCase().includes(pname))
    if (row) return row
    throw new Error(`No programme matching "${payload.programme_name}" for this athlete`)
  }
  if (rows.length === 1) return rows[0]
  const primaryId = athlete?.programme?.id
  if (primaryId) {
    const row = rows.find((r) => r.id === primaryId)
    if (row) return row
  }
  if (rows.length === 0) throw new Error('No programmes assigned to this athlete')
  throw new Error('Several programmes — add programme_name or programme_id to the payload')
}

export function useAssistantAthletes({ athletes, setTeamFilter }) {
  useEffect(() => {
    const user = getCurrentUser()

    registerPageContext('athletes', () => ({
      orgId: user.orgId,
      athletes: (athletes ?? []).map((a) => ({
        id: a.id,
        name: a.display_name || a.name || a.full_name,
        teams: a.teams,
        programme: a.programme,
        programmes: a.programmes,
        compliance: a.compliance_percent,
      })),
      availableActions: ACTIONS,
    }))

    registerAction('assign_programme_to_athlete', async (payload) => {
      const athleteId = payload.athlete_id
      const programmeId = payload.programme_id
      if (!athleteId || !programmeId) throw new Error('athlete_id and programme_id are required')
      const { error: e1 } = await supabase
        .from('programmes')
        .update({ athlete_id: athleteId })
        .eq('id', programmeId)
        .eq('org_id', user.orgId)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('programme_athletes').insert({
        org_id: user.orgId,
        programme_id: programmeId,
        athlete_id: athleteId,
      })
      if (e2) {
        const msg = String(e2.message || '')
        if (!msg.toLowerCase().includes('duplicate') && !msg.includes('23505')) throw e2
      }
    })

    registerAction('filter_athletes_by_team', async (payload) => {
      const tid = payload.team_id ?? ''
      if (typeof setTeamFilter === 'function') setTeamFilter(tid)
      return { ok: true }
    })

    registerAction('export_athlete_programme_pdf', async (payload) => {
      const athlete = matchAthleteFromPayload(athletes ?? [], payload)
      if (!athlete) {
        throw new Error('athlete_id or athlete_name is required (names must match the Athletes list in context)')
      }
      const list = await fetchProgrammesForAthlete(athlete, user.orgId)
      const programme = pickProgrammeRow(list, payload, athlete)
      await buildProgrammePDF(athlete, programme)
    })

    return () => {
      unregisterPageContext('athletes')
      for (const a of ACTIONS) unregisterAction(a)
    }
  }, [athletes, setTeamFilter])
}
