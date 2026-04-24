import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export async function getProgrammeSessionIds(programmeId, orgId) {
  const { data: weeks, error: e1 } = await supabase
    .from('programme_weeks')
    .select('id')
    .eq('programme_id', programmeId)
    .eq('org_id', orgId)
  if (e1) throw e1
  if (!weeks?.length) return []
  const weekIds = weeks.map((w) => w.id)
  const { data: ps, error: e2 } = await supabase
    .from('programme_sessions')
    .select('session_id')
    .eq('org_id', orgId)
    .in('programme_week_id', weekIds)
  if (e2) throw e2
  return [...new Set((ps ?? []).map((r) => r.session_id).filter(Boolean))]
}

export function useProgrammeAssignment(programmeId, orgId) {
  const [teams, setTeams] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const [tRes, aRes] = await Promise.all([
          supabase.from('teams').select('id, name').eq('org_id', orgId).order('name'),
          supabase
            .from('athletes')
            .select('id, full_name, first_name, last_name')
            .eq('org_id', orgId)
            .order('full_name'),
        ])
        if (tRes.error) throw tRes.error
        if (aRes.error) throw aRes.error
        if (!cancel) {
          setTeams(tRes.data ?? [])
          setAthletes(aRes.data ?? [])
        }
      } catch (err) {
        console.error('[AssignProgramme]', err)
        if (!cancel) {
          setTeams([])
          setAthletes([])
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [programmeId, orgId])

  const assignToTeam = useCallback(
    async (teamId) => {
      try {
        const ids = await getProgrammeSessionIds(programmeId, orgId)
        if (ids.length) {
          const { error: e2 } = await supabase.from('sessions').update({ team_id: teamId }).in('id', ids).eq('org_id', orgId)
          if (e2) throw e2
        }
        const { error: e3 } = await supabase.from('programmes').update({ athlete_id: null }).eq('id', programmeId).eq('org_id', orgId)
        if (e3) throw e3
      } catch (err) {
        console.error('[AssignProgramme]', err)
        throw err
      }
    },
    [programmeId, orgId],
  )

  const assignToAthlete = useCallback(
    async (athleteId) => {
      try {
        const { data: atRows, error: e0 } = await supabase.from('athlete_teams').select('team_id').eq('athlete_id', athleteId).limit(20)
        if (e0) throw e0
        let teamId = null
        for (const r of atRows ?? []) {
          if (!r.team_id) continue
          const { data: tm, error: eT } = await supabase.from('teams').select('id').eq('id', r.team_id).eq('org_id', orgId).maybeSingle()
          if (!eT && tm?.id) {
            teamId = r.team_id
            break
          }
        }
        if (!teamId) throw new Error('Athlete has no team in this organisation')
        const { error: e1 } = await supabase.from('programmes').update({ athlete_id: athleteId }).eq('id', programmeId).eq('org_id', orgId)
        if (e1) throw e1
        const ids = await getProgrammeSessionIds(programmeId, orgId)
        if (ids.length) {
          const { error: e2 } = await supabase.from('sessions').update({ team_id: teamId }).in('id', ids).eq('org_id', orgId)
          if (e2) throw e2
        }
      } catch (err) {
        console.error('[AssignProgramme]', err)
        throw err
      }
    },
    [programmeId, orgId],
  )

  return { teams, athletes, loading, assignToTeam, assignToAthlete }
}
