import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useUser } from '../context/UserContext.jsx'
import { getScopedTeamIds } from '../lib/teamScope.js'

const CORE_TEST_HINTS = {
  flexibility: ['flexibility', 'sit & reach', 'sit and reach'],
  speed: ['speed', 'sprint'],
  power: ['power', 'jump', 'chest pass'],
  endurance: ['endurance', 'yo-yo', 'yoyo'],
}

const CLASS_ORDER = {
  excellent: 4,
  elite: 4,
  'above average': 3,
  average: 2,
  'below average': 1,
}

function displayName(a) {
  if (a?.name) return a.name
  if (a?.full_name) return a.full_name
  return [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim() || 'Unnamed athlete'
}

function normalizeClassification(raw) {
  const key = String(raw || '').trim().toLowerCase()
  if (key === 'elite') return 'Excellent'
  if (key === 'excellent') return 'Excellent'
  if (key === 'above average') return 'Above Average'
  if (key === 'average') return 'Average'
  if (key === 'below average') return 'Below Average'
  return null
}

function detectAssessmentGroup(testName) {
  const n = String(testName || '').toLowerCase()
  for (const [group, hints] of Object.entries(CORE_TEST_HINTS)) {
    if (hints.some((h) => n.includes(h))) return group
  }
  return null
}

function pickOverallClassification(byGroup) {
  const labels = Object.values(byGroup).filter(Boolean)
  if (!labels.length) return null
  let total = 0
  let count = 0
  for (const label of labels) {
    const score = CLASS_ORDER[String(label).toLowerCase()]
    if (!score) continue
    total += score
    count += 1
  }
  if (!count) return null
  const avg = total / count
  if (avg >= 3.5) return 'Excellent'
  if (avg >= 2.5) return 'Above Average'
  if (avg >= 1.5) return 'Average'
  return 'Below Average'
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function weekHistoryFromSessions(sessionDates, completedSessionIds, now) {
  const bins = [0, 1, 2, 3].map((i) => {
    const end = addDays(now, -(i * 7))
    const start = addDays(end, -6)
    return { start, end, total: 0, done: 0 }
  })
  for (const s of sessionDates) {
    if (!s?.id || !s?.session_date) continue
    const d = new Date(`${s.session_date}T00:00:00`)
    for (const bin of bins) {
      if (d >= bin.start && d <= bin.end) {
        bin.total += 1
        if (completedSessionIds.has(s.id)) bin.done += 1
        break
      }
    }
  }
  return bins
    .reverse()
    .map((b) => (b.total ? Math.round((b.done / b.total) * 100) : 0))
}

export function useAthletes() {
  const { user, activeTeamId, availableTeams } = useUser()
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const teams = availableTeams
  const scopedTeamIds = getScopedTeamIds(user?.teamIds, activeTeamId)

  const fetchAthletes = useCallback(async () => {
    if (!user?.orgId || !scopedTeamIds.length) {
      setAthletes([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('id, name')
        .eq('org_id', user.orgId)
        .in('id', scopedTeamIds)
        .order('name', { ascending: true })
      if (teamsErr) throw teamsErr
      const teamMap = new Map((teamsData ?? []).map((t) => [t.id, t]))

      const { data: athleteRows, error: athleteErr } = await supabase
        .from('athletes')
        .select(
          `
          id, full_name, first_name, last_name, email, photo_url,
          athlete_teams!inner(
            team_id,
            team:teams(id, name)
          )
        `,
        )
        .eq('org_id', user.orgId)
        .in('athlete_teams.team_id', scopedTeamIds)
      if (athleteErr) throw athleteErr

      const baseAthletes = (athleteRows ?? []).map((a) => {
        const teamRows = Array.isArray(a.athlete_teams) ? a.athlete_teams : []
        const athleteTeams = teamRows
          .map((at) => {
            const t = Array.isArray(at.team) ? at.team[0] : at.team
            return t?.id ? { id: t.id, name: t.name } : teamMap.get(at.team_id)
          })
          .filter(Boolean)
        return {
          ...a,
          display_name: displayName(a),
          teams: athleteTeams,
          programme: null,
          last_session_date: null,
          compliance_percent: 0,
          has_session_data: false,
          compliance_history: [0, 0, 0, 0],
          assessment_overall: null,
          assessments_by_group: {},
        }
      })
      const athleteIds = baseAthletes.map((a) => a.id)
      const allTeamIds = [...new Set(baseAthletes.flatMap((a) => a.teams.map((t) => t.id)))]
      const teamScope = allTeamIds.length ? allTeamIds : scopedTeamIds

      /** programme_id -> { id, name } from explicit team / athlete assignment tables */
      const programmesByAthleteId = new Map()
      for (const id of athleteIds) programmesByAthleteId.set(id, new Map())

      try {
        let ptRows = []
        if (teamScope.length) {
          const res = await supabase
            .from('programme_teams')
            .select('programme_id, team_id, programmes(id, name)')
            .eq('org_id', user.orgId)
            .in('team_id', teamScope)
          if (res.error) throw res.error
          ptRows = res.data ?? []
        }
        const teamToProgrammeIds = new Map()
        for (const row of ptRows ?? []) {
          const p = Array.isArray(row.programmes) ? row.programmes[0] : row.programmes
          if (!p?.id || !row.team_id) continue
          const prog = { id: p.id, name: p.name }
          if (!teamToProgrammeIds.has(row.team_id)) teamToProgrammeIds.set(row.team_id, new Map())
          teamToProgrammeIds.get(row.team_id).set(prog.id, prog)
        }
        for (const a of baseAthletes) {
          const m = programmesByAthleteId.get(a.id)
          for (const t of a.teams || []) {
            const pmap = teamToProgrammeIds.get(t.id)
            if (!pmap) continue
            for (const prog of pmap.values()) m.set(prog.id, prog)
          }
        }

        if (athleteIds.length) {
          const { data: paRows, error: paErr } = await supabase
            .from('programme_athletes')
            .select('programme_id, athlete_id, programmes(id, name)')
            .eq('org_id', user.orgId)
            .in('athlete_id', athleteIds)
          if (paErr) throw paErr
          for (const row of paRows ?? []) {
            const p = Array.isArray(row.programmes) ? row.programmes[0] : row.programmes
            if (!p?.id || !row.athlete_id) continue
            const m = programmesByAthleteId.get(row.athlete_id)
            if (m) m.set(p.id, { id: p.id, name: p.name })
          }
        }
      } catch (err) {
        console.error('[useAthletes] programme junction lookup', err)
      }

      let directProgrammeRows = []
      if (athleteIds.length) {
        try {
          const res = await supabase
            .from('programmes')
            .select('id, name, athlete_id')
            .eq('org_id', user.orgId)
            .in('athlete_id', athleteIds)
          if (res.error) throw res.error
          directProgrammeRows = res.data ?? []
        } catch (err) {
          console.error('[useAthletes] legacy athlete_id programme lookup', err)
        }
      }
      const directProgrammeByAthlete = new Map()
      for (const p of directProgrammeRows) {
        if (!p?.athlete_id || directProgrammeByAthlete.has(p.athlete_id)) continue
        directProgrammeByAthlete.set(p.athlete_id, { id: p.id, name: p.name })
      }

      const cutoff28 = addDays(startOfToday(), -27)
      const { data: sessionsData, error: sessionsErr } = await supabase
        .from('sessions')
        .select('id, team_id, session_date, programme_week_id')
        .eq('org_id', user.orgId)
        .in('team_id', teamScope)
        .order('session_date', { ascending: false })
      if (sessionsErr) throw sessionsErr
      const sessions = sessionsData ?? []
      const sessionIds = sessions.map((s) => s.id)

      const completedByAthlete = new Map()
      if (sessionIds.length && athleteIds.length) {
        const { data: logs, error: logsErr } = await supabase
          .from('athlete_exercise_logs')
          .select('athlete_id, session_id')
          .eq('org_id', user.orgId)
          .in('athlete_id', athleteIds)
          .in('session_id', sessionIds)
          .eq('completed', true)
        if (logsErr) throw logsErr
        for (const l of logs ?? []) {
          if (!completedByAthlete.has(l.athlete_id)) completedByAthlete.set(l.athlete_id, new Set())
          completedByAthlete.get(l.athlete_id).add(l.session_id)
        }
      }

      let assessmentRows = []
      try {
        const { data, error: assessmentErr } = await supabase
          .from('assessment_results')
          .select('athlete_id, classification, created_at, test_definitions(name)')
          .eq('org_id', user.orgId)
          .in('athlete_id', athleteIds)
          .order('created_at', { ascending: false })
        if (assessmentErr) throw assessmentErr
        assessmentRows = data ?? []
      } catch (err) {
        console.error('[useAthletes] assessment lookup', err)
      }

      const latestByAthleteGroup = new Map()
      for (const row of assessmentRows) {
        const test = Array.isArray(row.test_definitions) ? row.test_definitions[0] : row.test_definitions
        const group = detectAssessmentGroup(test?.name)
        const label = normalizeClassification(row.classification)
        if (!group || !row.athlete_id || !label) continue
        const key = `${row.athlete_id}:${group}`
        if (!latestByAthleteGroup.has(key)) latestByAthleteGroup.set(key, label)
      }

      const now = startOfToday()
      const merged = baseAthletes.map((a) => {
        const athleteTeamIds = a.teams.map((t) => t.id)
        const athleteSessions = sessions.filter((s) => athleteTeamIds.includes(s.team_id))
        const latestSession = athleteSessions.find((s) => !!s.session_date) ?? null
        const inLast28 = athleteSessions.filter((s) => {
          if (!s.session_date) return false
          return new Date(`${s.session_date}T00:00:00`) >= cutoff28
        })
        const completedIds = completedByAthlete.get(a.id) ?? new Set()
        const totalAssigned = inLast28.length
        const completed = inLast28.filter((s) => completedIds.has(s.id)).length
        const hasSessionData = totalAssigned > 0
        const compliancePct = hasSessionData ? Math.round((completed / totalAssigned) * 100) : 0
        const fromJunction = programmesByAthleteId.get(a.id)
        const list = []
        const seen = new Set()
        if (fromJunction?.size) {
          for (const pr of fromJunction.values()) {
            if (pr?.id && !seen.has(pr.id)) {
              seen.add(pr.id)
              list.push(pr)
            }
          }
        }
        const leg = directProgrammeByAthlete.get(a.id)
        if (leg?.id && !seen.has(leg.id)) {
          seen.add(leg.id)
          list.push(leg)
        }
        list.sort((x, y) => (x.name || '').localeCompare(y.name || '', undefined, { sensitivity: 'base' }))
        const byGroup = {
          flexibility: latestByAthleteGroup.get(`${a.id}:flexibility`) ?? null,
          speed: latestByAthleteGroup.get(`${a.id}:speed`) ?? null,
          power: latestByAthleteGroup.get(`${a.id}:power`) ?? null,
          endurance: latestByAthleteGroup.get(`${a.id}:endurance`) ?? null,
        }
        return {
          ...a,
          programmes: list,
          programme: list[0] ?? null,
          last_session_date: latestSession?.session_date ?? null,
          compliance_percent: compliancePct,
          has_session_data: hasSessionData,
          compliance_history: weekHistoryFromSessions(inLast28, completedIds, now),
          assessment_overall: pickOverallClassification(byGroup),
          assessments_by_group: byGroup,
        }
      })
      setAthletes(merged)
    } catch (err) {
      console.error('[useAthletes]', err)
      setError(err?.message ?? 'Failed to load athletes')
      setAthletes([])
    } finally {
      setLoading(false)
    }
  }, [user?.orgId, user?.teamIds, activeTeamId, scopedTeamIds.join(',')])

  useEffect(() => {
    void fetchAthletes()
  }, [fetchAthletes])

  return { athletes, teams, loading, error, refetch: fetchAthletes }
}
