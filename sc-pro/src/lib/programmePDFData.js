import { supabase } from './supabaseClient.js'

export function libRow(ex) {
  const el = ex.exercise_library
  return Array.isArray(el) ? el[0] : el
}

export function pick1rm(row) {
  if (!row) return null
  const v = row.tested_1rm ?? row.working_max ?? row.estimated_1rm
  return v != null ? Number(v) : null
}

/** Matches Session Builder / prescription summary when DB `sets` is null. */
export function displaySets(ex) {
  const n = ex?.sets
  if (n != null && n !== '' && !Number.isNaN(Number(n))) {
    return Math.max(1, Math.min(30, Math.round(Number(n))))
  }
  return 3
}

export function formatLoad(ex, oneRmKg) {
  const t = ex.prescription_type || 'max'
  const v = ex.prescription_value
  if (t === 'pct_1rm' && v != null && v !== '') {
    const pct = Number(v)
    if (oneRmKg != null && !Number.isNaN(pct)) return `${Math.round((pct / 100) * oneRmKg)} kg · ${pct}%`
    return `${pct}%`
  }
  if (t === 'absolute' && v != null && v !== '') return `${v} kg`
  if (t === 'rpe' && v != null && v !== '') return `RPE ${v}`
  if (t === 'max') return 'MAX'
  if (t === 'rir' && v != null && v !== '') return `RIR ${v}`
  if (t === 'velocity' && v != null && v !== '') return `${v} m/s`
  if (t === 'time' && v != null && v !== '') return `${v}s`
  if (t === 'distance' && v != null && v !== '') return `${v} m`
  return '—'
}

export async function fetchOrgLogos(orgId) {
  try {
    const { data, error } = await supabase.from('organisations').select('*').eq('id', orgId).maybeSingle()
    if (error) throw error
    return { logo_url: data?.logo_url ?? null, secondary_logo_url: data?.secondary_logo_url ?? null }
  } catch (err) {
    console.error('[buildProgrammePDF] org logos', err)
    return { logo_url: null, secondary_logo_url: null }
  }
}

export async function fetchTeamLogo(athlete, orgId) {
  try {
    const tid = athlete?.teams?.[0]?.id
    if (!tid) return { name: null, logo_url: null }
    const { data, error } = await supabase.from('teams').select('name, logo_url').eq('id', tid).eq('org_id', orgId).maybeSingle()
    if (error) throw error
    return { name: data?.name ?? athlete.teams[0].name, logo_url: data?.logo_url ?? null }
  } catch (err) {
    console.error('[buildProgrammePDF] team', err)
    return { name: athlete?.teams?.[0]?.name ?? null, logo_url: null }
  }
}

/** Prefer a team linked to this programme that the athlete is on (e.g. Haryana Steelers), else first athlete team. */
export async function fetchTeamLogoForProgramme(athlete, programmeId, orgId) {
  const teamIdSet = new Set((athlete.teams || []).map((t) => t.id).filter(Boolean))
  if (!programmeId || !teamIdSet.size) return fetchTeamLogo(athlete, orgId)
  try {
    const { data, error } = await supabase
      .from('programme_teams')
      .select('team_id, teams(name, logo_url)')
      .eq('programme_id', programmeId)
      .eq('org_id', orgId)
      .in('team_id', [...teamIdSet])
    if (error) throw error
    for (const row of data || []) {
      if (!row.team_id || !teamIdSet.has(row.team_id)) continue
      const t = row.teams
      const tm = Array.isArray(t) ? t[0] : t
      if (tm?.name || tm?.logo_url) {
        return { name: tm.name ?? null, logo_url: tm.logo_url ?? null }
      }
      const { data: t2, error: e2 } = await supabase
        .from('teams')
        .select('name, logo_url')
        .eq('id', row.team_id)
        .eq('org_id', orgId)
        .maybeSingle()
      if (!e2 && (t2?.name || t2?.logo_url)) return { name: t2.name ?? null, logo_url: t2.logo_url ?? null }
    }
  } catch (err) {
    console.error('[buildProgrammePDF] programme team logo', err)
  }
  return fetchTeamLogo(athlete, orgId)
}

export async function fetchAthleteMeta(athleteId, orgId) {
  try {
    const { data, error } = await supabase
      .from('athletes')
      .select('sport, date_of_birth, position')
      .eq('id', athleteId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (error) throw error
    return data || {}
  } catch (err) {
    console.error('[buildProgrammePDF] athlete meta', err)
    return {}
  }
}

/** True when the session is published (PDF export includes these only). */
function sessionIsPublishedForExport(s) {
  if (!s || typeof s !== 'object') return false
  const v = s.is_published
  return v === true || v === 'true' || v === 't' || v === 1
}

async function fetchSessionsByIdsBatched(ids, orgId) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!uniq.length) return []
  const chunk = 120
  const rows = []
  for (let i = 0; i < uniq.length; i += chunk) {
    const slice = uniq.slice(i, i + chunk)
    const { data, error } = await supabase.from('sessions').select('*').in('id', slice).eq('org_id', orgId)
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

/**
 * Published sessions for each programme week (junction + optional programme_week_id on sessions).
 * Nested `sessions(*)` can be null under RLS; we hydrate by `session_id` when needed, then filter
 * to published only.
 */
export async function fetchWeeksAndSessions(programmeId, orgId) {
  const { data: weeks, error: wErr } = await supabase
    .from('programme_weeks')
    .select('*')
    .eq('programme_id', programmeId)
    .eq('org_id', orgId)
    .order('week_number', { ascending: true })
  if (wErr) throw wErr
  const out = []
  for (const w of weeks || []) {
    const { data: links, error: lErr } = await supabase
      .from('programme_sessions')
      .select('sort_order, session_id, sessions(*)')
      .eq('programme_week_id', w.id)
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
    if (lErr) throw lErr

    const sortBySessionId = new Map()
    for (const row of links || []) {
      if (row.session_id != null) sortBySessionId.set(row.session_id, row.sort_order ?? 0)
    }

    const byId = new Map()
    const missingIds = []
    for (const row of links || []) {
      if (!row.session_id) continue
      const emb = row.sessions
      const sess = Array.isArray(emb) ? emb[0] : emb
      if (sess?.id) {
        byId.set(sess.id, { ...sess, sort_order: row.sort_order ?? 0 })
      } else {
        missingIds.push(row.session_id)
      }
    }

    const uniqMissing = [...new Set(missingIds)]
    if (uniqMissing.length) {
      const rows = await fetchSessionsByIdsBatched(uniqMissing, orgId)
      for (const s of rows) {
        if (s?.id) byId.set(s.id, { ...s, sort_order: sortBySessionId.get(s.id) ?? 0 })
      }
    }

    const { data: direct, error: dErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('programme_week_id', w.id)
      .eq('org_id', orgId)
    if (dErr) throw dErr
    for (const s of direct || []) {
      if (!s?.id) continue
      if (byId.has(s.id)) {
        const prev = byId.get(s.id)
        byId.set(s.id, { ...prev, ...s, sort_order: prev?.sort_order ?? 0 })
      } else {
        byId.set(s.id, { ...s, sort_order: sortBySessionId.get(s.id) ?? 999 })
      }
    }

    const idList = [...byId.keys()]
    for (let i = 0; i < idList.length; i += 120) {
      const slice = idList.slice(i, i + 120)
      if (!slice.length) continue
      const { data: canonical, error: cErr } = await supabase
        .from('sessions')
        .select('id, is_published')
        .in('id', slice)
        .eq('org_id', orgId)
      if (cErr) throw cErr
      for (const row of canonical || []) {
        if (!row?.id) continue
        const cur = byId.get(row.id)
        if (cur) byId.set(row.id, { ...cur, is_published: row.is_published })
      }
    }

    const sessions = [...byId.values()]
      .filter((s) => s?.id && sessionIsPublishedForExport(s))
      .sort((a, b) => {
        const so = (a.sort_order ?? 0) - (b.sort_order ?? 0)
        if (so !== 0) return so
        const da = (a.session_date || '').localeCompare(b.session_date || '')
        if (da !== 0) return da
        const ta = String(a.start_time || a.session_time || '')
        const tb = String(b.start_time || b.session_time || '')
        return ta.localeCompare(tb)
      })
    out.push({ week: w, sessions })
  }
  return out
}

export async function fetchBlocks(sessionId, orgId) {
  const { data, error } = await supabase
    .from('session_blocks')
    .select('*')
    .eq('session_id', sessionId)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchExercises(blockId, orgId) {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('*, exercise_library(name, video_url)')
    .eq('block_id', blockId)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetch1rmMap(athleteId, orgId, exerciseIds) {
  const uniq = [...new Set(exerciseIds.filter(Boolean))]
  if (!uniq.length) return new Map()
  const { data, error } = await supabase
    .from('athlete_1rm')
    .select('exercise_id, tested_1rm, working_max, estimated_1rm')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .in('exercise_id', uniq)
  if (error) throw error
  const m = new Map()
  for (const r of data || []) m.set(r.exercise_id, pick1rm(r))
  return m
}
