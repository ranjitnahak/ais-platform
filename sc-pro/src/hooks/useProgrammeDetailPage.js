import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { can, getCurrentUser } from '../lib/auth.js'
import { weekDays, isoLocal } from '../lib/weekDates.js'
import { athleteDisplayName } from '../lib/programmeUi.js'
import { duplicateProgrammeSessionDeep } from '../lib/duplicateProgrammeSession.js'
import { fetchSessionForClipboard, pasteClipboardSession } from '../lib/sessionClipboardPaste.js'
import { getProgrammeSessionIds } from './useProgrammeAssignment.js'

function linkDateIsoFromRow(row) {
  const s = row?.sessions
  if (!s?.session_date) return null
  const sd = s.session_date
  return typeof sd === 'string' ? sd.slice(0, 10) : isoLocal(new Date(sd))
}

/** Rebuild links with sessions on `dayIso` in `orderedSessionIds` order; reassign global `sort_order` 0..n-1. */
function applySameDaySessionReorder(prevLinks, dayIso, orderedSessionIds) {
  const dayIds = prevLinks
    .filter((r) => linkDateIsoFromRow(r) === dayIso)
    .map((r) => r.session_id ?? r.sessions?.id)
    .filter(Boolean)
  if (dayIds.length !== orderedSessionIds.length) return prevLinks
  if (dayIds.length === 0) return prevLinks
  const prevSet = new Set(dayIds)
  for (const id of orderedSessionIds) {
    if (!prevSet.has(id)) return prevLinks
  }
  if (dayIds.every((id, i) => id === orderedSessionIds[i])) return prevLinks

  const newDayOrder = orderedSessionIds
    .map((id) => prevLinks.find((r) => (r.session_id ?? r.sessions?.id) === id && linkDateIsoFromRow(r) === dayIso))
    .filter(Boolean)
  if (newDayOrder.length !== orderedSessionIds.length) return prevLinks

  let k = 0
  const out = prevLinks.map((r) => {
    if (linkDateIsoFromRow(r) !== dayIso) return r
    const nx = newDayOrder[k++]
    return nx ? { ...nx } : r
  })
  return out.map((r, i) => ({ ...r, sort_order: i }))
}

export function useProgrammeDetailPage(programmeId) {
  const [searchParams] = useSearchParams()
  const weekParam = searchParams.get('week')
  const user = getCurrentUser()
  const [programme, setProgramme] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [weekId, setWeekId] = useState(null)
  const [links, setLinks] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [createOpen, setCreateOpen] = useState(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [emptyWeekTargets, setEmptyWeekTargets] = useState([])
  const [weekIdsWithSessions, setWeekIdsWithSessions] = useState([])
  /** { type: 'team' | 'athlete', name: string } | null — programme assignment display */
  const [assignPill, setAssignPill] = useState(null)
  /** Full session + blocks + exercises for weekly grid copy/paste */
  const [copiedSession, setCopiedSession] = useState(null)
  const [clipboardToast, setClipboardToast] = useState(null)
  const toastTimer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAssignPill(null)
    try {
      const { data: p, error: e1 } = await supabase
        .from('programmes')
        .select('*')
        .eq('id', programmeId)
        .eq('org_id', user.orgId)
        .maybeSingle()
      if (e1) throw e1
      if (!p) throw new Error('Programme not found')
      setProgramme(p)
      const { data: w, error: e2 } = await supabase
        .from('programme_weeks')
        .select('*')
        .eq('programme_id', programmeId)
        .eq('org_id', user.orgId)
        .order('week_number')
      if (e2) throw e2
      setWeeks(w ?? [])
      const weekIdList = (w ?? []).map((x) => x.id)
      let dotIds = []
      if (weekIdList.length) {
        const { data: psAll, error: ePs } = await supabase
          .from('programme_sessions')
          .select('programme_week_id')
          .eq('org_id', user.orgId)
          .in('programme_week_id', weekIdList)
        if (ePs) {
          console.error('[ProgrammeDetail] programme_sessions week list', ePs)
        } else {
          dotIds = [...new Set((psAll ?? []).map((r) => r.programme_week_id).filter(Boolean))]
        }
      }
      setWeekIdsWithSessions(dotIds)
      setWeekId((cur) => {
        if (cur && (w ?? []).some((x) => x.id === cur)) return cur
        return w?.[0]?.id ?? null
      })

      let pill = null
      try {
        if (p.athlete_id) {
          const { data: ath, error: ea } = await supabase
            .from('athletes')
            .select('full_name, first_name, last_name')
            .eq('id', p.athlete_id)
            .eq('org_id', user.orgId)
            .maybeSingle()
          if (!ea && ath) pill = { type: 'athlete', name: athleteDisplayName(ath) }
        } else {
          const ids = await getProgrammeSessionIds(programmeId, user.orgId)
          if (ids.length) {
            const { data: sessRows, error: es } = await supabase
              .from('sessions')
              .select('team_id')
              .eq('org_id', user.orgId)
              .in('id', ids)
              .not('team_id', 'is', null)
              .limit(1)
            if (!es && sessRows?.[0]?.team_id) {
              const tid = sessRows[0].team_id
              const { data: team, error: et } = await supabase.from('teams').select('name').eq('id', tid).eq('org_id', user.orgId).maybeSingle()
              if (!et && team?.name) pill = { type: 'team', name: team.name }
            }
          }
        }
      } catch (e) {
        console.error('[ProgrammeDetail] assign pill', e)
      }
      setAssignPill(pill)
    } catch (e) {
      console.error('[ProgrammeDetail]', e)
      setError(e.message ?? 'Failed to load')
      setAssignPill(null)
    } finally {
      setLoading(false)
    }
  }, [programmeId, user.orgId])

  useEffect(() => {
    void load()
  }, [load])

  /** Deep-link / return-from-session: ?week=<programme_week id> */
  useEffect(() => {
    if (!weeks.length || !weekParam) return
    if (!weeks.some((w) => w.id === weekParam)) return
    setWeekId(weekParam)
  }, [weeks, weekParam])

  const refreshWeek = useCallback(async () => {
    if (!weekId) {
      setLinks([])
      setCounts({})
      return
    }
    try {
      const { data: ps, error } = await supabase
        .from('programme_sessions')
        .select('id, sort_order, session_id, sessions(*)')
        .eq('programme_week_id', weekId)
        .eq('org_id', user.orgId)
        .order('sort_order')
      if (error) throw error
      setWeekIdsWithSessions((prev) => {
        const next = new Set(prev)
        if ((ps ?? []).length > 0) next.add(weekId)
        else next.delete(weekId)
        return Array.from(next)
      })
      const rows = (ps ?? []).filter((r) => r.sessions && user.teamIds.includes(r.sessions.team_id))
      setLinks(rows)
      const sids = rows.map((r) => r.session_id).filter(Boolean)
      if (!sids.length) {
        setCounts({})
        return
      }
      const { data: blocks, error: eb } = await supabase
        .from('session_blocks')
        .select('id, session_id')
        .in('session_id', sids)
        .eq('org_id', user.orgId)
      if (eb) throw eb
      const blockIds = (blocks ?? []).map((b) => b.id)
      const blockToSession = Object.fromEntries((blocks ?? []).map((b) => [b.id, b.session_id]))
      let exRows = []
      if (blockIds.length) {
        const { data: ex, error: ee } = await supabase
          .from('session_exercises')
          .select('id, block_id')
          .in('block_id', blockIds)
          .eq('org_id', user.orgId)
        if (ee) throw ee
        exRows = ex ?? []
      }
      const cnt = {}
      for (const e of exRows) {
        const sid = blockToSession[e.block_id]
        if (sid) cnt[sid] = (cnt[sid] || 0) + 1
      }
      setCounts(cnt)
    } catch (e) {
      console.error('[ProgrammeDetail] week', e)
      setCounts({})
    }
  }, [weekId, user.orgId, user.teamIds])

  useEffect(() => {
    void refreshWeek()
  }, [refreshWeek])

  useEffect(() => {
    if (!toast) return
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [toast])

  useEffect(() => {
    if (!copiedSession) return
    const down = (e) => {
      if (e.target.closest?.('[data-clipboard-paste-slot]')) return
      if (e.target.closest?.('[data-clipboard-toast]')) return
      if (e.target.closest?.('[data-session-card-menu]')) return
      /* Week tabs sit outside the grid; allow switching week while paste buffer is active */
      if (e.target.closest?.('[data-programme-week-nav]')) return
      setCopiedSession(null)
      setClipboardToast(null)
    }
    document.addEventListener('mousedown', down, true)
    return () => document.removeEventListener('mousedown', down, true)
  }, [copiedSession])

  useEffect(() => {
    if (!copyOpen || !weekId) return
    let cancelled = false
    ;(async () => {
      const targets = []
      for (const w of weeks) {
        if (w.id === weekId) continue
        const { count, error } = await supabase
          .from('programme_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('programme_week_id', w.id)
          .eq('org_id', user.orgId)
        if (error) {
          console.error('[ProgrammeDetail] count weeks', error)
          continue
        }
        if ((count ?? 0) === 0) targets.push(w)
      }
      if (!cancelled) setEmptyWeekTargets(targets)
    })()
    return () => {
      cancelled = true
    }
  }, [copyOpen, weekId, weeks, user.orgId])

  const selectedWeek = useMemo(() => weeks.find((w) => w.id === weekId), [weeks, weekId])
  const dayCols = useMemo(
    () => (programme && selectedWeek ? weekDays(programme, selectedWeek.week_number) : []),
    [programme, selectedWeek],
  )

  const sessionsByDay = useMemo(() => {
    const m = {}
    for (const d of dayCols) m[d.iso] = []
    for (const row of links) {
      const s = row.sessions
      if (!s?.session_date) continue
      const key = typeof s.session_date === 'string' ? s.session_date.slice(0, 10) : isoLocal(new Date(s.session_date))
      if (!m[key]) m[key] = []
      m[key].push({ row, session: s })
    }
    return m
  }, [links, dayCols])

  async function saveTemplate() {
    try {
      const { error } = await supabase.from('programmes').update({ is_template: true }).eq('id', programmeId).eq('org_id', user.orgId)
      if (error) throw error
      setToast('Saved as template')
      void load()
    } catch (e) {
      console.error('[ProgrammeDetail]', e)
      setToast(e.message ?? 'Failed')
    }
  }

  const moveSessionToDay = useCallback(
    (sessionId, targetIso) => {
      if (!can('programme', 'edit')) return
      const allowed = new Set((dayCols ?? []).map((d) => d.iso))
      if (!targetIso || !allowed.has(targetIso)) return

      let revertSnapshot = null
      let didOptimistic = false
      flushSync(() => {
        setLinks((prev) => {
          const row = prev.find((r) => (r.session_id ?? r.sessions?.id) === sessionId)
          if (!row?.sessions) return prev
          const sd = row.sessions.session_date
          const cur = typeof sd === 'string' ? sd.slice(0, 10) : sd != null ? isoLocal(new Date(sd)) : null
          if (!cur || cur === targetIso) return prev
          revertSnapshot = prev
          didOptimistic = true
          return prev.map((r) => {
            const sid = r.session_id ?? r.sessions?.id
            if (sid !== sessionId || !r.sessions) return r
            return { ...r, sessions: { ...r.sessions, session_date: targetIso } }
          })
        })
      })
      if (!didOptimistic) return

      void (async () => {
        try {
          const { error } = await supabase.from('sessions').update({ session_date: targetIso }).eq('id', sessionId).eq('org_id', user.orgId)
          if (error) throw error
          setToast('Session moved')
          await refreshWeek()
        } catch (e) {
          console.error('[ProgrammeDetail] move session', e)
          setToast(e.message ?? 'Move failed')
          if (revertSnapshot) {
            flushSync(() => setLinks(revertSnapshot))
          } else {
            await refreshWeek()
          }
        }
      })()
    },
    [dayCols, user.orgId, refreshWeek],
  )

  const reorderSessionsForDay = useCallback(
    (dayIso, orderedSessionIds) => {
      if (!can('programme', 'edit')) return
      const allowed = new Set((dayCols ?? []).map((d) => d.iso))
      if (!dayIso || !allowed.has(dayIso) || !orderedSessionIds?.length) return

      let revertSnapshot = null
      let didOptimistic = false
      let patchRows = null
      flushSync(() => {
        setLinks((prev) => {
          const next = applySameDaySessionReorder(prev, dayIso, orderedSessionIds)
          if (next === prev) return prev
          revertSnapshot = prev
          didOptimistic = true
          patchRows = next.map((r, i) => ({ id: r.id, sort_order: i }))
          return next
        })
      })
      if (!didOptimistic || !patchRows?.length) return

      void (async () => {
        try {
          const results = await Promise.all(
            patchRows.map((row) =>
              supabase.from('programme_sessions').update({ sort_order: row.sort_order }).eq('id', row.id).eq('org_id', user.orgId),
            ),
          )
          for (const { error } of results) {
            if (error) throw error
          }
          setToast('Sessions reordered')
          await refreshWeek()
        } catch (e) {
          console.error('[ProgrammeDetail] reorder sessions', e)
          setToast(e.message ?? 'Reorder failed')
          if (revertSnapshot) {
            flushSync(() => setLinks(revertSnapshot))
          } else {
            await refreshWeek()
          }
        }
      })()
    },
    [dayCols, user.orgId, refreshWeek],
  )

  const toggleSessionPublish = useCallback(
    (sessionId) => {
      if (!can('programme', 'edit')) return
      void (async () => {
        try {
          const row = links.find((r) => (r.session_id ?? r.sessions?.id) === sessionId)
          const cur = row?.sessions?.is_published === true
          const next = !cur
          const { error } = await supabase
            .from('sessions')
            .update({
              is_published: next,
              publish_at: next ? new Date().toISOString() : null,
            })
            .eq('id', sessionId)
            .eq('org_id', user.orgId)
          if (error) throw error
          setToast(next ? 'Published' : 'Unpublished')
          setLinks((prev) =>
            prev.map((r) => {
              const sid = r.session_id ?? r.sessions?.id
              if (sid !== sessionId || !r.sessions) return r
              return {
                ...r,
                sessions: {
                  ...r.sessions,
                  is_published: next,
                  publish_at: next ? new Date().toISOString() : null,
                },
              }
            }),
          )
        } catch (e) {
          console.error('[ProgrammeWeekSession]', e)
          setToast(e.message ?? 'Update failed')
          await refreshWeek()
        }
      })()
    },
    [links, user.orgId, refreshWeek, setToast],
  )

  const saveSessionToLibraryStub = useCallback(() => {
    setToast('Save to Library coming soon')
  }, [setToast])

  const repeatSessionToDate = useCallback(
    (sessionId, newIso) => {
      if (!can('programme', 'edit')) return
      const allowed = new Set((dayCols ?? []).map((d) => d.iso))
      if (!newIso || !allowed.has(newIso)) {
        setToast('Choose a day in this programme week')
        return
      }
      void (async () => {
        try {
          const maxSort = Math.max(0, ...links.map((l) => l.sort_order ?? 0))
          await duplicateProgrammeSessionDeep(supabase, {
            orgId: user.orgId,
            sourceSessionId: sessionId,
            targetWeekId: weekId,
            newSessionDate: newIso,
            nextSortOrder: maxSort + 1,
          })
          setToast('Session repeated')
          await refreshWeek()
        } catch (e) {
          console.error('[ProgrammeWeekSession]', e)
          setToast(e.message ?? 'Repeat failed')
        }
      })()
    },
    [links, dayCols, user.orgId, weekId, refreshWeek, setToast],
  )

  const dismissSessionClipboard = useCallback(() => {
    setCopiedSession(null)
    setClipboardToast(null)
  }, [])

  const copySessionToClipboard = useCallback(
    (sessionId) => {
      if (!can('programme', 'edit')) return
      void (async () => {
        try {
          const payload = await fetchSessionForClipboard(supabase, user.orgId, sessionId)
          setCopiedSession(payload)
          setToast(null)
          setClipboardToast('Session copied — click any empty slot to paste')
        } catch (e) {
          console.error('[CopyPaste]', e)
          setToast(e.message ?? 'Copy failed')
        }
      })()
    },
    [user.orgId, setToast],
  )

  const pasteCopiedSessionToDate = useCallback(
    (targetDateIso) => {
      if (!can('programme', 'edit')) return
      const allowed = new Set((dayCols ?? []).map((d) => d.iso))
      if (!targetDateIso || !allowed.has(targetDateIso)) return
      const clip = copiedSession
      if (!clip?.session || !weekId) return
      void (async () => {
        try {
          const { data: lastPs, error: sortErr } = await supabase
            .from('programme_sessions')
            .select('sort_order')
            .eq('programme_week_id', weekId)
            .eq('org_id', user.orgId)
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (sortErr) throw sortErr
          const maxSort = lastPs?.sort_order ?? 0
          await pasteClipboardSession(supabase, {
            orgId: user.orgId,
            clipboard: clip,
            targetDateIso,
            programmeWeekId: weekId,
            nextSortOrder: maxSort + 1,
          })
          setCopiedSession(null)
          setClipboardToast(null)
          setToast('Session pasted')
          await refreshWeek()
        } catch (e) {
          console.error('[CopyPaste]', e)
          setToast('Paste failed — try again')
        }
      })()
    },
    [copiedSession, dayCols, user.orgId, weekId, refreshWeek, setToast],
  )

  const deleteSession = useCallback(
    (sessionId) => {
      if (!can('programme', 'edit')) return
      void (async () => {
        let revertSnapshot = null
        flushSync(() => {
          setLinks((prev) => {
            revertSnapshot = prev
            return prev.filter((r) => (r.session_id ?? r.sessions?.id) !== sessionId)
          })
        })
        try {
          const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('org_id', user.orgId)
          if (error) throw error
          setToast('Session deleted')
          await refreshWeek()
        } catch (e) {
          console.error('[ProgrammeWeekSession]', e)
          setToast(e.message ?? 'Delete failed')
          if (revertSnapshot) {
            flushSync(() => setLinks(revertSnapshot))
          } else {
            await refreshWeek()
          }
        }
      })()
    },
    [user.orgId, refreshWeek, setToast],
  )

  async function createSession(payload) {
    const teamId = user.teamIds[0]
    try {
      const { data: sess, error } = await supabase
        .from('sessions')
        .insert({
          org_id: user.orgId,
          team_id: teamId,
          session_date: payload.session_date,
          start_time: payload.start_time || '09:00:00',
          name: payload.name,
          venue: payload.venue || null,
          coach_instructions: payload.coach_instructions || null,
          // Platform Core table uses AIS column name (see add_session_library_and_session_columns.sql).
          duration_planned: payload.planned_duration_min ?? null,
          category: payload.category,
          session_type: payload.category === 'strength' ? 'strength' : 'conditioning',
          programme_week_id: weekId,
        })
        .select()
        .single()
      if (error) throw error
      const maxSort = Math.max(0, ...links.map((l) => l.sort_order ?? 0))
      const { error: e2 } = await supabase.from('programme_sessions').insert({
        org_id: user.orgId,
        programme_week_id: weekId,
        session_id: sess.id,
        sort_order: maxSort + 1,
      })
      if (e2) throw e2
      setCreateOpen(null)
      setToast('Session created')
      await refreshWeek()
    } catch (e) {
      console.error('[ProgrammeDetail]', e)
      setToast(e.message ?? 'Create failed')
    }
  }

  return {
    user,
    programme,
    weeks,
    weekId,
    setWeekId,
    links,
    counts,
    loading,
    error,
    toast,
    setToast,
    createOpen,
    setCreateOpen,
    copyOpen,
    setCopyOpen,
    emptyWeekTargets,
    weekIdsWithSessions,
    selectedWeek,
    dayCols,
    sessionsByDay,
    saveTemplate,
    createSession,
    refreshWeek,
    load,
    assignPill,
    moveSessionToDay,
    reorderSessionsForDay,
    toggleSessionPublish,
    saveSessionToLibraryStub,
    repeatSessionToDate,
    copiedSession,
    clipboardToast,
    copySessionToClipboard,
    pasteCopiedSessionToDate,
    dismissSessionClipboard,
    deleteSession,
  }
}
