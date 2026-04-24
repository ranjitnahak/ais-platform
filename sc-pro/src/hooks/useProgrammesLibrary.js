import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'

export const PAGE_SIZE = 5

function useTeamUsageMap(programmeIds, refreshKey) {
  const [map, setMap] = useState({})
  useEffect(() => {
    if (!programmeIds.length) {
      setMap({})
      return
    }
    const user = getCurrentUser()
    let cancelled = false
    ;(async () => {
      try {
        const { data: weeks, error: wErr } = await supabase
          .from('programme_weeks')
          .select('id, programme_id')
          .eq('org_id', user.orgId)
          .in('programme_id', programmeIds)
        if (wErr) throw wErr
        if (!weeks?.length) {
          if (!cancelled) setMap(Object.fromEntries(programmeIds.map((id) => [id, 0])))
          return
        }
        const weekToProgramme = Object.fromEntries(weeks.map((w) => [w.id, w.programme_id]))
        const weekIds = weeks.map((w) => w.id)
        const { data: psRows, error: pErr } = await supabase
          .from('programme_sessions')
          .select('programme_week_id, sessions(team_id)')
          .eq('org_id', user.orgId)
          .in('programme_week_id', weekIds)
        if (pErr) throw pErr
        const next = Object.fromEntries(programmeIds.map((id) => [id, new Set()]))
        for (const row of psRows ?? []) {
          const pid = weekToProgramme[row.programme_week_id]
          if (!pid || !next[pid]) continue
          const tid = row.sessions?.team_id
          if (tid && user.teamIds.includes(tid)) next[pid].add(tid)
        }
        if (!cancelled) {
          setMap(
            Object.fromEntries(programmeIds.map((id) => [id, next[id] ? next[id].size : 0])),
          )
        }
      } catch (e) {
        console.error('[Programmes] team usage', e)
        if (!cancelled) setMap(Object.fromEntries(programmeIds.map((id) => [id, 0])))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [programmeIds.join(','), refreshKey])
  return map
}

export function useProgrammesLibrary() {
  const user = getCurrentUser()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('All')
  const [phase, setPhase] = useState('All')
  const [age, setAge] = useState('All')
  const [createdBy, setCreatedBy] = useState('Any Coach')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [menuRow, setMenuRow] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [onlyTemplates, setOnlyTemplates] = useState(false)

  const programmeIds = useMemo(() => rows.map((r) => r.id), [rows])
  const teamUsage = useTeamUsageMap(programmeIds, refreshKey)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('programmes')
        .select('*')
        .eq('org_id', user.orgId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setRows(data ?? [])
    } catch (e) {
      console.error('[Programmes]', e)
      setError(e.message ?? 'Failed to load programmes')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user.orgId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (onlyTemplates && !r.is_template) return false
      if (search && !(`${r.name} ${r.sport ?? ''} ${r.description ?? ''}`).toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      if (sport !== 'All' && (r.sport || '') !== sport) return false
      if (phase !== 'All' && r.phase_type !== phase) return false
      if (age !== 'All' && r.training_age !== age) return false
      if (createdBy !== 'Any Coach') {
        /* V1: no created_by name join */
      }
      return true
    })
  }, [rows, search, sport, phase, age, createdBy, onlyTemplates])

  const templateCount = useMemo(() => rows.filter((r) => r.is_template).length, [rows])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const slice = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)
  const sportOptions = useMemo(() => {
    const s = new Set(rows.map((r) => r.sport).filter(Boolean))
    return ['All', ...Array.from(s)]
  }, [rows])

  async function handleCreate(payload) {
    const weeksCount = Math.min(52, Math.max(1, Number(payload.weeks) || 4))
    try {
      const { data: prog, error: pErr } = await supabase
        .from('programmes')
        .insert({
          org_id: user.orgId,
          name: payload.name,
          sport: payload.sport || null,
          phase_type: payload.phase_type,
          training_age: payload.training_age,
          difficulty: payload.difficulty,
          description: payload.description || null,
          is_template: false,
          // V1 stub: omit creator until auth supplies a real public.users id (FK-safe).
          created_by: null,
        })
        .select()
        .single()
      if (pErr) throw pErr
      const weekRows = Array.from({ length: weeksCount }, (_, i) => ({
        programme_id: prog.id,
        org_id: user.orgId,
        week_number: i + 1,
        label: `Week ${i + 1}`,
      }))
      const { error: wErr } = await supabase.from('programme_weeks').insert(weekRows)
      if (wErr) throw wErr
      setModal(null)
      setRefreshKey((k) => k + 1)
      navigate(`/programmes/${prog.id}`)
    } catch (e) {
      console.error('[Programmes] create', e)
      setError(e.message ?? 'Create failed')
    }
  }

  async function duplicateProgramme(source) {
    try {
      const { data: copy, error } = await supabase
        .from('programmes')
        .insert({
          org_id: user.orgId,
          name: `${source.name} (copy)`,
          sport: source.sport,
          phase_type: source.phase_type,
          training_age: source.training_age,
          difficulty: source.difficulty,
          description: source.description,
          is_template: false,
          created_by: null,
        })
        .select()
        .single()
      if (error) throw error
      const { data: weeks, error: w0 } = await supabase
        .from('programme_weeks')
        .select('*')
        .eq('programme_id', source.id)
        .eq('org_id', user.orgId)
        .order('week_number')
      if (w0) throw w0
      if (weeks?.length) {
        const ins = weeks.map((w) => ({
          programme_id: copy.id,
          org_id: user.orgId,
          week_number: w.week_number,
          label: w.label,
          notes: w.notes,
        }))
        const { error: w1 } = await supabase.from('programme_weeks').insert(ins)
        if (w1) throw w1
      }
      setMenuRow(null)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      console.error('[Programmes] duplicate', e)
      setError(e.message ?? 'Duplicate failed')
    }
  }

  async function deleteProgramme(id) {
    try {
      const { error } = await supabase.from('programmes').delete().eq('id', id).eq('org_id', user.orgId)
      if (error) throw error
      setMenuRow(null)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      console.error('[Programmes] delete', e)
      setError(e.message ?? 'Delete failed')
    }
  }

  async function saveAsTemplate(source) {
    try {
      const { error } = await supabase
        .from('programmes')
        .update({ is_template: true })
        .eq('id', source.id)
        .eq('org_id', user.orgId)
      if (error) throw error
      setMenuRow(null)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      console.error('[Programmes] template', e)
      setError(e.message ?? 'Update failed')
    }
  }

  return {
    loading,
    error,
    search,
    setSearch,
    sport,
    setSport,
    phase,
    setPhase,
    age,
    setAge,
    createdBy,
    setCreatedBy,
    page,
    setPage,
    modal,
    setModal,
    menuRow,
    setMenuRow,
    onlyTemplates,
    setOnlyTemplates,
    templateCount,
    filtered,
    totalPages,
    pageSafe,
    slice,
    sportOptions,
    teamUsage,
    handleCreate,
    duplicateProgramme,
    deleteProgramme,
    saveAsTemplate,
    navigate,
  }
}
