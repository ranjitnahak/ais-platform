/** Prescription one-line summary for session preview (SC Pro prescription fields). */

const SUMMARY_SETS_MIN = 1
const SUMMARY_SETS_MAX = 30
const SUMMARY_SETS_DEFAULT = 3

function primarySummarySuffix(t, v) {
  if (t === 'max' || v == null || v === '') return ''
  if (t === 'pct_1rm') return `${v}%`
  if (t === 'absolute') return `${v} kg`
  if (t === 'rpe') return `${v} RPE`
  if (t === 'rir') return `${v} RIR`
  if (t === 'velocity') return `${v} m/s`
  if (t === 'time') return `${v}s`
  if (t === 'distance') return `${v} m`
  return String(v)
}

function secondaryLoadFragment(st, sv) {
  if (st === 'absolute' && sv != null && sv !== '') return `${sv} kg`
  if (st === 'pct_1rm' && sv != null && sv !== '') return `${sv}%`
  if (st === 'time' && sv != null && sv !== '') return `${sv}s`
  if (st === 'distance' && sv != null && sv !== '') return `${sv} m`
  return null
}

function tertiaryLoadFragment(tt, tv) {
  if (tt === 'absolute' && tv != null && tv !== '') return `${tv} kg`
  if (tt === 'pct_1rm' && tv != null && tv !== '') return `${tv}%`
  if (tt === 'time' && tv != null && tv !== '') return `${tv}s`
  if (tt === 'distance' && tv != null && tv !== '') return `${tv} m`
  return null
}

function isLoadPrimaryType(t) {
  return t === 'absolute' || t === 'pct_1rm' || t === 'time' || t === 'distance'
}

export function formatPrescriptionSummary(ex) {
  const setsNum = Math.max(SUMMARY_SETS_MIN, Math.min(SUMMARY_SETS_MAX, ex.sets ?? SUMMARY_SETS_DEFAULT))
  const sets = String(setsNum)
  const reps = ex.reps != null ? String(ex.reps) : '—'
  let line = `${sets} × ${reps}`
  const t = ex.prescription_type || 'max'
  const v = ex.prescription_value
  const prim = primarySummarySuffix(t, v)
  if (prim) line += ` @ ${prim}`

  const st = ex.secondary_prescription_type
  const sv = ex.secondary_prescription_value
  const secLoad = secondaryLoadFragment(st, sv)
  if (secLoad) line += prim ? ` X ${secLoad}` : ` @ ${secLoad}`
  else if (st === 'rpe' && sv != null && sv !== '') line += ` @ ${sv} RPE`
  else if (st === 'rir' && sv != null && sv !== '') line += ` @ ${sv} RIR`
  else if (st === 'velocity' && sv != null && sv !== '') line += ` @ ${sv} m/s`

  const tt = ex.tertiary_prescription_type
  const tv = ex.tertiary_prescription_value
  const terLoad = tertiaryLoadFragment(tt, tv)
  const priorLoadForTertiary = Boolean(secLoad) || (Boolean(prim) && isLoadPrimaryType(t))
  if (terLoad) line += priorLoadForTertiary ? ` X ${terLoad}` : ` @ ${terLoad}`
  else if (tt === 'rpe' && tv != null && tv !== '') line += ` @ ${tv} RPE`
  else if (tt === 'rir' && tv != null && tv !== '') line += ` @ ${tv} RIR`
  else if (tt === 'velocity' && tv != null && tv !== '') line += ` @ ${tv} m/s`

  return line
}

/** Flatten blocks → exercises for SessionBuilder left-panel session list lines. */
export function flattenSessionExercises(session) {
  if (!session?.session_blocks) return []
  const blocks = [...session.session_blocks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const out = []
  for (const b of blocks) {
    const blockLabel = b.label || '—'
    const exs = [...(b.session_exercises || [])].sort((a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0))
    for (const ex of exs) {
      const lib = ex.exercise_library
      const o = Array.isArray(lib) ? lib[0] : lib
      out.push({
        id: ex.id,
        blockLabel,
        name: o?.name || 'Exercise',
        summary: formatPrescriptionSummary(ex),
        prescriptionType: ex.prescription_type,
      })
    }
  }
  return out
}
