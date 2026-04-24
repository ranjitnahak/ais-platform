import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'
import { athleteDisplayName } from '../lib/programmeUi.js'

/**
 * Team for athlete 1RM rosters. When the session belongs to a programme, use the
 * most common non-null team_id across all linked sessions in that programme
 * (same heuristic as the programme "assigned to" pill), and prefer this
 * session's team_id when it ties — so we do not show a whole-org roster if
 * sessions.team_id is stale or points at a legacy catch-all team.
 */
async function resolveProgrammeRosterTeamId(supabase, orgId, session) {
  const direct = session.team_id ?? null
  if (!session.programme_week_id) return direct

  const { data: pw, error: e0 } = await supabase
    .from('programme_weeks')
    .select('programme_id')
    .eq('id', session.programme_week_id)
    .eq('org_id', orgId)
    .maybeSingle()
  if (e0 || !pw?.programme_id) return direct

  const { data: weeks, error: e1 } = await supabase
    .from('programme_weeks')
    .select('id')
    .eq('programme_id', pw.programme_id)
    .eq('org_id', orgId)
  if (e1 || !weeks?.length) return direct

  const weekIds = weeks.map((w) => w.id)
  const { data: psRows, error: e2 } = await supabase
    .from('programme_sessions')
    .select('sessions(team_id)')
    .eq('org_id', orgId)
    .in('programme_week_id', weekIds)
  if (e2 || !psRows?.length) return direct

  const counts = new Map()
  for (const r of psRows) {
    const s = r.sessions
    const row = Array.isArray(s) ? s[0] : s
    const tid = row?.team_id
    if (!tid) continue
    counts.set(tid, (counts.get(tid) || 0) + 1)
  }
  if (counts.size === 0) return direct

  const maxCount = Math.max(...counts.values())
  const tied = [...counts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([tid]) => tid)
  if (direct && tied.includes(direct)) return direct
  return tied[0] ?? direct
}

export function useSessionData(sessionId) {
  const user = getCurrentUser()
  const orgId = user.orgId
  const [session, setSession] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [athletes, setAthletes] = useState([])
  const [oneRmByAthleteExercise, setOneRm] = useState({})
  const [athleteLoadsNoTeam, setAthleteLoadsNoTeam] = useState(false)
  const [athleteLoadsMessage, setAthleteLoadsMessage] = useState('')
  const [rosterTeamId, setRosterTeamId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (opts = {}) => {
    const silent = opts.silent === true
    if (!sessionId) {
      setSession(null)
      setBlocks([])
      setAthletes([])
      setOneRm({})
      setAthleteLoadsNoTeam(false)
      setAthleteLoadsMessage('')
      setRosterTeamId(null)
      setError(null)
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    setError(null)
    try {
      const { data: s, error: e1 } = await supabase.from('sessions').select('*').eq('id', sessionId).eq('org_id', orgId).maybeSingle()
      if (e1) throw e1
      if (!s) throw new Error('Session not found')
      setSession(s)

      const { data: bl, error: e2 } = await supabase
        .from('session_blocks')
        .select('*, session_exercises(*, exercise_library(*))')
        .eq('session_id', sessionId)
        .eq('org_id', orgId)
        .order('sort_order')
      if (e2) throw e2
      setBlocks(bl ?? [])

      const resolvedRosterTeamId = await resolveProgrammeRosterTeamId(supabase, orgId, s)
      setRosterTeamId(resolvedRosterTeamId)
      let athRows = []
      if (!resolvedRosterTeamId) {
        setAthleteLoadsNoTeam(true)
        setAthleteLoadsMessage('Assign this programme to a team to see athlete loads.')
        setAthletes([])
      } else {
        setAthleteLoadsNoTeam(false)
        setAthleteLoadsMessage('')
        // Roster for loads: programme-canonical team when session is on a programme (see resolveProgrammeRosterTeamId).
        const { data: at, error: e3 } = await supabase
          .from('athlete_teams')
          .select('athlete_id, athletes(id, org_id, full_name, first_name, last_name)')
          .eq('team_id', resolvedRosterTeamId)
        if (e3) throw e3
        for (const r of at ?? []) {
          const a = r.athletes
          if (!a) continue
          const row = Array.isArray(a) ? a[0] : a
          if (row.org_id !== orgId) continue
          athRows.push({
            id: row.id,
            full_name: row.full_name,
            first_name: row.first_name,
            last_name: row.last_name,
          })
        }
        setAthletes(athRows)
      }

      const ids = athRows.map((a) => a.id)
      if (ids.length) {
        const { data: rm, error: e4 } = await supabase
          .from('athlete_1rm')
          .select('athlete_id, exercise_id, tested_1rm, estimated_1rm, working_max, source')
          .eq('org_id', orgId)
          .in('athlete_id', ids)
        if (e4) throw e4
        const map = {}
        for (const row of rm ?? []) {
          const k = `${row.athlete_id}:${row.exercise_id}`
          map[k] = row
        }
        setOneRm(map)
      } else {
        setOneRm({})
      }
    } catch (e) {
      console.error('[SessionBuilder]', e)
      setError(e.message ?? 'Load failed')
      setSession(null)
      setBlocks([])
      setAthletes([])
      setOneRm({})
      setAthleteLoadsNoTeam(false)
      setAthleteLoadsMessage('')
      setRosterTeamId(null)
    } finally {
      setLoading(false)
    }
  }, [sessionId, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const reload = useCallback(() => load({ silent: true }), [load])

  const athleteNames = useMemo(() => athletes.map((a) => ({ id: a.id, name: athleteDisplayName(a) })), [athletes])

  return {
    session,
    blocks,
    setBlocks,
    athletes,
    athleteNames,
    oneRmByAthleteExercise,
    loading,
    error,
    reload,
    athleteLoadsNoTeam,
    athleteLoadsMessage,
    rosterTeamId,
  }
}
