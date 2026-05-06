export function toVarFlags(rowsByWeek) {
  const f = {
    sets: false,
    reps: false,
    p1rm: false,
    rpe: false,
    rir: false,
    rest: false,
    time: false,
    absolute: false,
    max: false,
    velocity: false,
    distance: false,
  }
  for (const w of rowsByWeek.values()) {
    for (const b of w.blocks) {
      for (const ex of b.exercises) {
        if (ex.sets != null) f.sets = true
        if (ex.reps != null) f.reps = true
        if (ex.rest_seconds != null) f.rest = true
        const types = [
          [ex.prescription_type, ex.prescription_value],
          [ex.secondary_prescription_type, ex.secondary_prescription_value],
          [ex.tertiary_prescription_type, ex.tertiary_prescription_value],
        ]
        for (const [t, v] of types) {
          if (!t || v == null) continue
          if (t === 'pct_1rm') f.p1rm = true
          else if (t === 'rpe') f.rpe = true
          else if (t === 'rir') f.rir = true
          else if (t === 'time') f.time = true
          else if (t === 'absolute') f.absolute = true
          else if (t === 'max') f.max = true
          else if (t === 'velocity') f.velocity = true
          else if (t === 'distance') f.distance = true
        }
      }
    }
  }
  const out = []
  if (f.sets) out.push('sets')
  if (f.reps) out.push('Reps')
  if (f.p1rm) out.push('%1RM')
  if (f.rpe) out.push('RPE')
  if (f.rir) out.push('RIR')
  if (f.time) out.push('Time')
  if (f.absolute) out.push('Absolute')
  if (f.velocity) out.push('Vel')
  if (f.distance) out.push('Dist')
  if (f.max) out.push('Max')
  if (f.rest) out.push('Rest')
  return out
}

export function slotLabel(blockLabel, idx) {
  return `${String(blockLabel || '?')}${idx + 1}`
}

/** PostgREST may return `sessions` as an object or a single-element array. */
export function embeddedSession(sessionsField) {
  if (sessionsField == null) return null
  return Array.isArray(sessionsField) ? sessionsField[0] ?? null : sessionsField
}

export function progressionSessionLabel(session) {
  const s = embeddedSession(session) ?? session
  const name = String(s?.name ?? '').trim()
  if (!name || !s?.session_date) return ''
  const dayName = new Date(`${s.session_date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
  return `${dayName} — ${name}`
}

export function weekdayLongEnGBFromSessionDate(sessionDate) {
  if (sessionDate == null || sessionDate === '') return null
  const iso = typeof sessionDate === 'string' ? sessionDate.slice(0, 10) : String(sessionDate).slice(0, 10)
  if (!iso) return null
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
}

/** Split "Tuesday — Strength" from the progression session picker. */
export function parseProgressionPickerLabel(label) {
  const t = String(label ?? '').trim()
  const sep = ' — '
  const i = t.indexOf(sep)
  if (i === -1) return { dayLabel: null, tail: t }
  return { dayLabel: t.slice(0, i).trim(), tail: t.slice(i + sep.length).trim() }
}

/**
 * Match the same session the day grid would show, then fall back by weekday + name/category
 * so manually added weeks still line up when the session title differs slightly.
 */
export function pickProgrammeSessionForProgressionColumn(psRows, { activeSessionName, selectedName, teamIds }) {
  const ids = teamIds ?? []
  const allRows = (psRows ?? []).filter((r) => {
    const s = embeddedSession(r.sessions)
    return Boolean(s)
  })
  const teamRows = allRows.filter((r) => {
    const s = embeddedSession(r.sessions)
    return s && ids.includes(s.team_id)
  })
  // If team metadata is missing/misaligned on some linked rows, do not blank the column.
  const rows = teamRows.length ? teamRows : allRows
  const labelFor = (r) => progressionSessionLabel(r.sessions)
  let t = rows.find((r) => labelFor(r) === activeSessionName)
  if (t) return t
  const sn = String(selectedName ?? '').trim()
  if (sn) {
    t = rows.find((r) => String(embeddedSession(r.sessions)?.name ?? '').trim() === sn)
    if (t) return t
  }
  const { dayLabel, tail } = parseProgressionPickerLabel(activeSessionName)
  if (!dayLabel) return null
  const trackLc = tail.trim().toLowerCase()
  t = rows.find((r) => {
    const s = embeddedSession(r.sessions)
    if (!s || weekdayLongEnGBFromSessionDate(s.session_date) !== dayLabel) return false
    const n = String(s.name ?? '').trim().toLowerCase()
    const c = String(s.category ?? '').toLowerCase().replace(/_/g, ' ')
    return n === trackLc || c === trackLc
  })
  if (t) return t
  const dayRows = rows.filter((r) => {
    const s = embeddedSession(r.sessions)
    return s && weekdayLongEnGBFromSessionDate(s.session_date) === dayLabel
  })
  return dayRows.length === 1 ? dayRows[0] : null
}
