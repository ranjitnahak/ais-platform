import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'

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
  const [authUser, setAuthUser] = useState(null)
  const teamScope = useMemo(() => authUser?.teamIds ?? [], [authUser])
  const [teams, setTeams] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const teamsLoadGen = useRef(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const user = await getCurrentUser()
      if (!cancelled) setAuthUser(user)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!authUser) return
    const gen = ++teamsLoadGen.current
    ;(async () => {
      setLoading(true)
      try {
        let tQuery = supabase.from('teams').select('id, name').eq('org_id', orgId).order('name')
        if (teamScope.length) tQuery = tQuery.in('id', teamScope)
        const [tRes, aRes] = await Promise.all([
          tQuery,
          supabase
            .from('athletes')
            .select('id, full_name, first_name, last_name')
            .eq('org_id', orgId)
            .order('full_name'),
        ])
        if (tRes.error) throw tRes.error
        if (aRes.error) throw aRes.error
        if (teamsLoadGen.current === gen) {
          setTeams(tRes.data ?? [])
          setAthletes(aRes.data ?? [])
        }
      } catch (err) {
        console.error('[AssignProgramme]', err)
        if (teamsLoadGen.current === gen) {
          setTeams([])
          setAthletes([])
        }
      } finally {
        if (teamsLoadGen.current === gen) setLoading(false)
      }
    })()
  }, [programmeId, orgId, teamScope, authUser])

  const syncTeamAssignments = useCallback(
    async (teamIds) => {
      const ids = [...new Set(teamIds.filter(Boolean))]
      try {
        const { error: del } = await supabase.from('programme_teams').delete().eq('programme_id', programmeId).eq('org_id', orgId)
        if (del) throw del
        if (ids.length) {
          const rows = ids.map((team_id) => ({ programme_id: programmeId, team_id, org_id: orgId }))
          const { error: ins } = await supabase.from('programme_teams').insert(rows)
          if (ins) throw ins
        }
        const { error: e3 } = await supabase.from('programmes').update({ athlete_id: null }).eq('id', programmeId).eq('org_id', orgId)
        if (e3) throw e3
        const sessionIds = await getProgrammeSessionIds(programmeId, orgId)
        if (sessionIds.length && ids.length === 1) {
          const { error: e2 } = await supabase.from('sessions').update({ team_id: ids[0] }).in('id', sessionIds).eq('org_id', orgId)
          if (e2) throw e2
        }
      } catch (err) {
        console.error('[AssignProgramme]', err)
        throw err
      }
    },
    [programmeId, orgId],
  )

  const syncAthleteAssignments = useCallback(
    async (athleteIds) => {
      const ids = [...new Set(athleteIds.filter(Boolean))]
      try {
        const { error: del } = await supabase.from('programme_athletes').delete().eq('programme_id', programmeId).eq('org_id', orgId)
        if (del) throw del
        if (ids.length) {
          const rows = ids.map((athlete_id) => ({ programme_id: programmeId, athlete_id, org_id: orgId }))
          const { error: ins } = await supabase.from('programme_athletes').insert(rows)
          if (ins) throw ins
        }
        const { error: e1 } = await supabase.from('programmes').update({ athlete_id: null }).eq('id', programmeId).eq('org_id', orgId)
        if (e1) throw e1
        if (ids.length === 1) {
          const currentUser = await getCurrentUser()
          const { data: atRows, error: e0 } = await supabase.from('athlete_teams').select('team_id').eq('org_id', currentUser.orgId).eq('athlete_id', ids[0]).limit(20)
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
          if (teamId) {
            const sessionIds = await getProgrammeSessionIds(programmeId, orgId)
            if (sessionIds.length) {
              const { error: e2 } = await supabase.from('sessions').update({ team_id: teamId }).in('id', sessionIds).eq('org_id', orgId)
              if (e2) throw e2
            }
          }
        }
      } catch (err) {
        console.error('[AssignProgramme]', err)
        throw err
      }
    },
    [programmeId, orgId],
  )

  return { teams, athletes, loading, syncTeamAssignments, syncAthleteAssignments }
}
