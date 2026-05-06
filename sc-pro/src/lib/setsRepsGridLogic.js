/** Sets/reps grid: optional columns, localStorage, cascade, save patch (sc-pro Session Builder). */
import { buildSavePatch, deriveTableIntensityColumns, formatIntensityCellValue } from './prescriptionPillLogic.js'

export const OPTIONAL_GRID_KEYS = ['load', 'pct1rm', 'rest', 'tempo', 'time', 'distance', 'rpe', 'rir', 'velocity']
export const MAX_OPT_COLS = 3
export const LS_PREFIX = 'scpro.setGrid.v2:'

export const OPT_META = {
  load: { label: 'Load', kind: 'number', pillMenuKey: 'weight', step: 0.5 },
  pct1rm: { label: '% 1RM', kind: 'number', pillMenuKey: 'pct1rm', step: 0.5 },
  rest: { label: 'Rest (s)', kind: 'number', pillMenuKey: 'rest', step: 1 },
  tempo: { label: 'Tempo', kind: 'text', pillMenuKey: null },
  time: { label: 'Duration / Time', kind: 'number', pillMenuKey: 'time', step: 1 },
  distance: { label: 'Distance (m)', kind: 'number', pillMenuKey: 'distance', step: 1 },
  rpe: { label: 'RPE', kind: 'number', pillMenuKey: 'rpe', min: 1, max: 10, step: 1 },
  rir: { label: 'RIR', kind: 'number', pillMenuKey: 'rir', min: 0, max: 5, step: 1 },
  velocity: { label: 'm/s', kind: 'number', pillMenuKey: 'velocity', step: 0.01 },
}

const EFFORT_KINDS = ['rpe', 'rir', 'velocity']

export function mkEmptyRow(repsSeed) {
  return { reps: repsSeed != null ? String(repsSeed) : '' }
}

export function normPrescriptionScalar(v) {
  if (v == null || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : String(v)
}

/** Invalidate local grid cache when DB-backed prescription data changes (incl. cross-tab sync). */
export function sessionExerciseFingerprint(ex) {
  if (!ex?.id) return ''
  return [
    ex.reps ?? '',
    ex.sets ?? '',
    ex.prescription_type ?? '',
    normPrescriptionScalar(ex.prescription_value),
    ex.secondary_prescription_type ?? '',
    normPrescriptionScalar(ex.secondary_prescription_value),
    ex.tertiary_prescription_type ?? '',
    normPrescriptionScalar(ex.tertiary_prescription_value),
    ex.rest_seconds ?? '',
    ex.tempo ?? '',
    ex.updated_at ?? '',
  ].join('|')
}

export function cascadeRows(prev, setIndex, field, value) {
  const u = [...prev]
  u[setIndex] = { ...u[setIndex], [field]: value }
  for (let i = setIndex + 1; i < u.length; i++) u[i] = { ...u[i], [field]: value }
  return u
}

export function parseReps(s) {
  const t = String(s).trim()
  if (t === '') return null
  const n = Math.round(Number(t))
  return Number.isFinite(n) ? n : null
}

export function pillKeyForLoad(ex) {
  return (ex?.prescription_type ?? 'max') === 'pct_1rm' ? 'pct1rm' : 'weight'
}

/** Which DB pill key to remove for an effort column at this grid index. */
export function effortPillKeyForGrid(activeCols, gridKey) {
  if (!EFFORT_KINDS.includes(gridKey)) return null
  let slot = 0
  for (const k of activeCols) {
    if (k === gridKey) return slot === 0 ? gridKey : `tertiary_${gridKey}`
    if (EFFORT_KINDS.includes(k)) slot++
  }
  return gridKey
}

export function patchFromRow0(r0, activeCols, nSets, ex) {
  const patch = { sets: nSets, reps: parseReps(r0.reps) }
  let effSlot = 0
  for (const k of activeCols) {
    const meta = OPT_META[k]
    if (!meta) continue
    const raw = r0[k]
    const empty = raw === '' || raw == null
    if (k === 'tempo') {
      patch.tempo = empty ? null : String(raw)
      continue
    }
    if (k === 'load') {
      Object.assign(patch, buildSavePatch(pillKeyForLoad(ex), empty ? null : raw))
      continue
    }
    if (k === 'pct1rm') {
      Object.assign(patch, buildSavePatch('pct1rm', empty ? null : raw))
      continue
    }
    if (k === 'time') {
      Object.assign(patch, buildSavePatch('time', empty ? null : raw))
      continue
    }
    if (k === 'distance') {
      Object.assign(patch, buildSavePatch('distance', empty ? null : raw))
      continue
    }
    if (k === 'rest') {
      Object.assign(patch, buildSavePatch('rest', empty ? null : raw))
      continue
    }
    if (EFFORT_KINDS.includes(k)) {
      const pk = effSlot === 0 ? k : `tertiary_${k}`
      effSlot++
      Object.assign(patch, buildSavePatch(pk, empty ? null : raw))
    }
  }
  return patch
}

export function gridFieldFromPillKey(pk) {
  if (pk === 'weight') return 'load'
  if (pk === 'pct1rm') return 'pct1rm'
  if (pk === 'time') return 'time'
  if (pk === 'distance') return 'distance'
  if (pk === 'rest') return 'rest'
  if (pk === 'rpe' || pk === 'tertiary_rpe') return 'rpe'
  if (pk === 'rir' || pk === 'tertiary_rir') return 'rir'
  if (pk === 'velocity' || pk === 'tertiary_velocity') return 'velocity'
  return null
}

/** Maps deriveTableIntensityColumns pill keys to SetsReps optional column keys (one grid slot per key). */
export function pillKeyToOptionalGridKey(pillKey) {
  switch (pillKey) {
    case 'weight':
    case 'secondary_weight':
    case 'tertiary_weight':
      return 'load'
    case 'pct1rm':
    case 'secondary_pct1rm':
    case 'tertiary_pct1rm':
      return 'pct1rm'
    case 'time':
    case 'tertiary_time':
      return 'time'
    case 'distance':
    case 'tertiary_distance':
      return 'distance'
    case 'rpe':
    case 'tertiary_rpe':
      return 'rpe'
    case 'rir':
    case 'tertiary_rir':
      return 'rir'
    case 'velocity':
    case 'tertiary_velocity':
      return 'velocity'
    case 'rest':
      return 'rest'
    default:
      return null
  }
}

/**
 * Build grid rows/columns from DB-backed exercise fields when there is no localStorage bundle.
 * Required so copied sessions (new exercise ids) show the same prescription as the row summary.
 */
export function hydrateGridFromExercise(ex, nSets) {
  const n = Math.max(1, Math.min(30, Number(nSets) || 3))
  const row0 = mkEmptyRow(ex?.reps)
  const activeColumns = []
  const seen = new Set()
  for (const { pillKey } of deriveTableIntensityColumns(ex)) {
    if (activeColumns.length >= MAX_OPT_COLS) break
    const gk = pillKeyToOptionalGridKey(pillKey)
    if (!gk || seen.has(gk)) continue
    seen.add(gk)
    activeColumns.push(gk)
    row0[gk] = formatIntensityCellValue(ex, pillKey)
  }
  const tempoStr = ex?.tempo != null ? String(ex.tempo).trim() : ''
  if (tempoStr && activeColumns.length < MAX_OPT_COLS && !seen.has('tempo')) {
    activeColumns.push('tempo')
    row0.tempo = tempoStr
  }
  const rows = Array.from({ length: n }, () => ({ ...row0 }))
  return { activeColumns, rows }
}

/** Legacy: Session Builder grid no longer reads/writes LS bundles (hydrate from DB only). Kept for tooling / migration. */
export function loadBundle(id, n) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p?.rows || !Array.isArray(p.rows) || p.rows.length !== n) return null
    const cols = Array.isArray(p.activeColumns)
      ? p.activeColumns.filter((k) => OPTIONAL_GRID_KEYS.includes(k) && OPT_META[k]).slice(0, MAX_OPT_COLS)
      : []
    return { rows: p.rows, activeColumns: cols }
  } catch {
    return null
  }
}

export function saveBundle(id, rows, activeColumns) {
  try {
    localStorage.setItem(LS_PREFIX + id, JSON.stringify({ rows, activeColumns }))
  } catch {
    /* quota */
  }
}

export function clearExerciseBundle(id) {
  try {
    localStorage.removeItem(LS_PREFIX + id)
  } catch {
    /* quota */
  }
}

export function resizeRows(prev, n, seedRow) {
  if (prev.length === n) return prev
  if (prev.length < n) {
    const last = prev.length ? prev[prev.length - 1] : seedRow
    const add = []
    for (let i = prev.length; i < n; i++) add.push({ ...last })
    return [...prev, ...add]
  }
  return prev.slice(0, n)
}
