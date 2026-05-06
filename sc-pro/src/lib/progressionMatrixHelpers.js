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

export function progressionSessionLabel(session) {
  const name = String(session?.name ?? '').trim()
  if (!name || !session?.session_date) return ''
  const dayName = new Date(`${session.session_date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
  return `${dayName} — ${name}`
}
