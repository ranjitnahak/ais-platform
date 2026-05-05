import { useEffect } from 'react'
import { registerPageContext, unregisterPageContext } from '../lib/assistantContext.js'
import { registerAction, unregisterAction } from '../lib/assistantActions.js'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'
import { duplicateProgrammeSessionDeep } from '../lib/duplicateProgrammeSession.js'
import { deepCopyWeek } from '../lib/programmeWeeklyCopy.js'
import { bulkDeleteSessionsOrdered, bulkPublishSessions } from '../lib/sessionBulkOps.js'
import { weekDays } from '../lib/weekDates.js'

/** Parse model output like "Week 2", "2", 2 → positive week_number, else null */
function coerceWeekNumber(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw)
    return n > 0 ? n : null
  }
  const s = String(raw).trim()
  const m = s.match(/\d+/)
  if (m) {
    const n = Number(m[0])
    return n > 0 ? n : null
  }
  return null
}

/**
 * Resolve programme_week UUID from ids, week numbers, or relative offset.
 * Target-only: week_number / destination_week_number / target_week_offset (+N from selected week).
 * Source defaults to fallbackWeekId (visible tab) when nothing matches.
 */
function resolveProgrammeWeekId(role, payload, weeks, fallbackWeekId, selectedWeek) {
  const idKey = role === 'source' ? 'source_week_id' : 'target_week_id'
  const numKey = role === 'source' ? 'source_week_number' : 'target_week_number'

  const directId = payload[idKey]
  if (directId && String(directId).trim()) return String(directId).trim()

  if (role === 'target' && payload.target_week_offset != null && selectedWeek?.week_number != null) {
    const off = Number(payload.target_week_offset)
    if (Number.isFinite(off)) {
      const n = selectedWeek.week_number + off
      const row = weeks.find((w) => w.week_number === n)
      if (row?.id) return row.id
    }
  }

  let rawNum =
    payload[numKey] ??
    (role === 'source'
      ? payload.from_week_number ??
        payload.from_week ??
        payload.copy_from_week_number ??
        payload.source_week
      : payload.to_week_number ??
        payload.to_week ??
        payload.destination_week_number ??
        payload.dest_week_number)

  if (role === 'target') {
    rawNum =
      rawNum ??
      payload.week_number ??
      payload.destination_week ??
      payload.copy_to_week_number ??
      payload.target
  }

  const n = coerceWeekNumber(rawNum)
  if (n != null) {
    const row = weeks.find((w) => w.week_number === n)
    return row?.id ?? null
  }

  return fallbackWeekId ?? null
}

/** Map user/model weekday text → index 0=Mon … 6=Sun matching weekDays(). */
function weekdayLabelToGridIndex(label) {
  const t = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
  if (!t) return -1
  if (t.startsWith('mon')) return 0
  if (t.startsWith('tue')) return 1
  if (t.startsWith('wed')) return 2
  if (t.startsWith('thu')) return 3
  if (t.startsWith('fri')) return 4
  if (t.startsWith('sat')) return 5
  if (t.startsWith('sun')) return 6
  return -1
}

const CANON_WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** Normalize Mon/MON/Tuesday → canonical weekday slug for comparisons */
function canonicalWeekdayLabel(label) {
  const idx = weekdayLabelToGridIndex(label)
  if (idx >= 0) return CANON_WEEKDAYS[idx]
  const t = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
  for (const w of CANON_WEEKDAYS) {
    if (w === t || w.startsWith(t.slice(0, 3)) || t.startsWith(w.slice(0, 3))) return w
  }
  return ''
}

function categoryMatchesFilter(filterRaw, sessCategory) {
  const f = String(filterRaw ?? '').trim().toLowerCase()
  const c = String(sessCategory ?? '').trim().toLowerCase()
  if (!f) return true
  return c === f || c.includes(f) || f.includes(c)
}

/** Resolve YYYY-MM-DD from payload.date / session_date, or day name relative to programme week grid. */
function resolveSessionDateForWeek(payload, programmeRow, selectedWeekRow) {
  const raw = payload.date ?? payload.session_date
  if (raw != null && String(raw).trim() !== '') {
    const d = String(raw).trim().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  }
  const wn = selectedWeekRow?.week_number
  if (wn == null || !programmeRow) return ''
  const grid = weekDays(programmeRow, wn)
  const label = payload.day ?? payload.weekday ?? payload.day_of_week ?? payload.dow ?? ''
  const want = String(label).trim().toLowerCase()
  if (!want) return ''

  const idx = weekdayLabelToGridIndex(label)
  if (idx >= 0 && grid[idx]) return grid[idx].iso

  for (const cell of grid) {
    try {
      const full = new Date(`${cell.iso}T12:00:00`)
        .toLocaleDateString('en-GB', { weekday: 'long' })
        .toLowerCase()
      if (full === want || cell.dow.toLowerCase() === want) return cell.iso
    } catch {
      /* ignore */
    }
  }
  return ''
}

const ACTIONS = [
  'create_session',
  'copy_session',
  'delete_session',
  'update_session_duration',
  'delete_week_sessions',
  'copy_week',
  'assign_athlete_to_programme',
  'publish_week_sessions',
]

/**
 * Registers programme detail page context + write executors for the assistant.
 * Cleans up on unmount or when programme/week is unavailable.
 */
export function useAssistantProgrammeDetail({ programme, weeks, weekId, links, counts, assignTargets }) {
  useEffect(() => {
    const user = getCurrentUser()
    if (!programme?.id || !weekId) {
      unregisterPageContext('programme_detail')
      return
    }

    const selectedWeek = weeks.find((w) => w.id === weekId)
    const teamId = user.teamIds?.[0]
    if (!teamId) {
      unregisterPageContext('programme_detail')
      return
    }

    registerPageContext('programme_detail', () => {
      const sessions = (links ?? [])
        .map((r) => {
          const s = r.sessions
          const sess = Array.isArray(s) ? s[0] : s
          if (!sess?.id) return null
          const sd = sess.session_date
          const dateStr = typeof sd === 'string' ? sd.slice(0, 10) : sd ? new Date(sd).toISOString().slice(0, 10) : ''
          let day = '—'
          try {
            if (dateStr) day = new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
          } catch {
            /* ignore */
          }
          const sid = sess.id
          return {
            id: sid,
            name: sess.name,
            date: dateStr,
            day,
            category: sess.category,
            exercise_count: counts?.[sid] ?? 0,
            duration: sess.planned_duration_min ?? sess.duration_planned ?? null,
          }
        })
        .filter(Boolean)

      const assignedAthletes = (assignTargets?.athletes ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        team: a.team ?? null,
      }))

      return {
        orgId: user.orgId,
        programme: {
          id: programme.id,
          name: programme.name,
          sport: programme.sport,
          phase_type: programme.phase_type,
          total_weeks: weeks?.length ?? 0,
        },
        currentWeek: {
          number: selectedWeek?.week_number ?? null,
          id: weekId,
          sessions,
        },
        programmeWeeks: (weeks ?? []).map((w) => ({
          id: w.id,
          week_number: w.week_number,
        })),
        assignedAthletes,
        availableActions: ACTIONS,
      }
    })

    registerAction('create_session', async (payload) => {
      const insertOne = async (row) => {
        const name = String(row.name || 'New session').trim()
        const session_date = resolveSessionDateForWeek(row, programme, selectedWeek)
        const category = row.category || 'strength'
        const duration = Number(row.duration_min ?? 60) || 60
        if (!session_date) {
          throw new Error(
            'Provide date or session_date (YYYY-MM-DD), or day / weekday (e.g. Monday, MON, Wednesday) for the visible programme week.',
          )
        }
        const { data: sess, error } = await supabase
          .from('sessions')
          .insert({
            org_id: user.orgId,
            team_id: teamId,
            session_date,
            start_time: row.start_time || '09:00:00',
            name,
            venue: row.venue ?? null,
            coach_instructions: row.coach_instructions ?? null,
            duration_planned: duration,
            category,
            session_type: category === 'strength' ? 'strength' : 'conditioning',
            programme_week_id: weekId,
            is_published: false,
            publish_at: null,
            // V1: null — getCurrentUser().id is a stub and may not exist in public.users (FK)
            created_by: null,
          })
          .select()
          .single()
        if (error) throw error
        const { data: psRows, error: psErr } = await supabase
          .from('programme_sessions')
          .select('sort_order')
          .eq('programme_week_id', weekId)
          .eq('org_id', user.orgId)
          .order('sort_order', { ascending: false })
          .limit(1)
        if (psErr) throw psErr
        const maxSort = psRows?.[0]?.sort_order ?? 0
        const { error: e2 } = await supabase.from('programme_sessions').insert({
          org_id: user.orgId,
          programme_week_id: weekId,
          session_id: sess.id,
          sort_order: maxSort + 1,
        })
        if (e2) throw e2
        return sess
      }

      const batch = payload.sessions
      if (Array.isArray(batch) && batch.length > 0) {
        const out = []
        for (const item of batch) {
          const merged = { ...payload, ...item }
          delete merged.sessions
          out.push(await insertOne(merged))
        }
        return out
      }

      const single = { ...payload }
      delete single.sessions
      return insertOne(single)
    })

    registerAction('copy_session', async (payload) => {
      const sourceId = payload.source_session_id
      const target_date = String(payload.target_date || '').slice(0, 10)
      if (!sourceId || !target_date) throw new Error('source_session_id and target_date are required')
      const { data: psList, error: psErr } = await supabase
        .from('programme_sessions')
        .select('sort_order')
        .eq('programme_week_id', weekId)
        .eq('org_id', user.orgId)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (psErr) throw psErr
      const nextSort = (psList?.[0]?.sort_order ?? 0) + 1
      const newId = await duplicateProgrammeSessionDeep(supabase, {
        orgId: user.orgId,
        sourceSessionId: sourceId,
        targetWeekId: weekId,
        newSessionDate: target_date,
        nextSortOrder: nextSort,
      })
      const newName = payload.new_name
      if (newName && newId) {
        const { error: uErr } = await supabase
          .from('sessions')
          .update({ name: String(newName) })
          .eq('id', newId)
          .eq('org_id', user.orgId)
        if (uErr) throw uErr
      }
      return { id: newId }
    })

    registerAction('delete_session', async (payload) => {
      const id = payload.session_id
      if (!id) throw new Error('session_id is required')
      const { error } = await supabase.from('sessions').delete().eq('id', id).eq('org_id', user.orgId)
      if (error) throw error
    })

    registerAction('update_session_duration', async (payload) => {
      const weekRows = (links ?? [])
        .map((r) => {
          const s = r.sessions
          const sess = Array.isArray(s) ? s[0] : s
          if (!sess?.id) return null
          const sd = sess.session_date
          const dateStr = typeof sd === 'string' ? sd.slice(0, 10) : sd ? new Date(sd).toISOString().slice(0, 10) : ''
          let day = ''
          try {
            if (dateStr) day = new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
          } catch {
            /* ignore */
          }
          return {
            id: sess.id,
            day,
            category: sess.category ?? '',
            name: sess.name ?? '',
          }
        })
        .filter(Boolean)

      const allowedIds = new Set(weekRows.map((x) => x.id))

      if (Array.isArray(payload.session_updates) && payload.session_updates.length > 0) {
        for (const u of payload.session_updates) {
          const sid = u.session_id
          const dm = Number(u.duration_min ?? u.duration ?? u.minutes)
          if (!sid || !Number.isFinite(dm) || dm <= 0) {
            throw new Error('session_updates rows need session_id and duration_min')
          }
          if (!allowedIds.has(sid)) throw new Error(`session ${sid} is not in the visible programme week`)
          const { error } = await supabase
            .from('sessions')
            .update({ duration_planned: dm })
            .eq('id', sid)
            .eq('org_id', user.orgId)
          if (error) throw error
        }
        return { updated: payload.session_updates.length }
      }

      const durationMin = Number(payload.duration_min ?? payload.duration ?? payload.minutes)
      if (!Number.isFinite(durationMin) || durationMin <= 0) {
        throw new Error('duration_min (minutes) is required unless using session_updates')
      }

      let ids = []
      if (payload.session_id) {
        ids = [payload.session_id]
      } else if (Array.isArray(payload.session_ids) && payload.session_ids.length) {
        ids = [...payload.session_ids]
      } else {
        const cat = payload.category ?? payload.session_category
        const daysRaw = payload.days ?? payload.weekdays ?? payload.days_of_week
        const dayList = Array.isArray(daysRaw) ? daysRaw : daysRaw != null && String(daysRaw).trim() ? [daysRaw] : []
        let pool = weekRows
        if (cat != null && String(cat).trim() !== '') {
          pool = pool.filter((row) => categoryMatchesFilter(cat, row.category))
        }
        if (dayList.length) {
          const want = dayList.map((d) => canonicalWeekdayLabel(d)).filter(Boolean)
          pool = pool.filter((row) => {
            const rd = canonicalWeekdayLabel(row.day)
            return want.some((w) => w === rd)
          })
        }
        ids = pool.map((r) => r.id)
      }

      ids = [...new Set(ids)].filter((id) => allowedIds.has(id))
      if (!ids.length) {
        throw new Error(
          'No matching sessions in this week. Use session_id from currentWeek.sessions, or category + days (e.g. category "strength", days ["Tuesday","Thursday","Saturday"]).',
        )
      }

      const { error } = await supabase
        .from('sessions')
        .update({ duration_planned: durationMin })
        .in('id', ids)
        .eq('org_id', user.orgId)
      if (error) throw error
      return { updated: ids.length, session_ids: ids }
    })

    registerAction('copy_week', async (payload) => {
      const tgt = resolveProgrammeWeekId('target', payload, weeks, null, selectedWeek)
      const src = resolveProgrammeWeekId('source', payload, weeks, weekId, selectedWeek)
      if (!tgt) {
        throw new Error(
          'target_week_id or target_week_number is required (e.g. copy current week to week 2 → target_week_number: 2)',
        )
      }
      if (!src) {
        throw new Error(
          'source_week_id or source_week_number is required, or navigate to the source week — defaults to the visible week when omitted.',
        )
      }
      await deepCopyWeek({
        supabase,
        user,
        programme,
        sourceWeekId: src,
        targetWeekId: tgt,
        weeks,
      })
    })

    registerAction('assign_athlete_to_programme', async (payload) => {
      const athleteId = payload.athlete_id
      if (!athleteId) throw new Error('athlete_id is required')
      const { error } = await supabase.from('programme_athletes').insert({
        org_id: user.orgId,
        programme_id: programme.id,
        athlete_id: athleteId,
      })
      if (error) {
        const msg = String(error.message || '')
        if (!msg.toLowerCase().includes('duplicate') && !msg.includes('23505')) throw error
      }
    })

    registerAction('publish_week_sessions', async () => {
      const sessionIds = (links ?? [])
        .map((r) => {
          const s = r.sessions
          const sess = Array.isArray(s) ? s[0] : s
          return sess?.id
        })
        .filter(Boolean)
      if (!sessionIds.length) throw new Error('No sessions in this programme week to publish.')
      await bulkPublishSessions(supabase, user.orgId, sessionIds)
    })

    registerAction('delete_week_sessions', async () => {
      const sessionIds = (links ?? [])
        .map((r) => {
          const s = r.sessions
          const sess = Array.isArray(s) ? s[0] : s
          return sess?.id
        })
        .filter(Boolean)
      if (!sessionIds.length) throw new Error('No sessions in this programme week to delete.')
      await bulkDeleteSessionsOrdered(supabase, user.orgId, sessionIds)
    })

    return () => {
      unregisterPageContext('programme_detail')
      for (const a of ACTIONS) unregisterAction(a)
    }
  }, [programme, weeks, weekId, links, counts, assignTargets])
}
