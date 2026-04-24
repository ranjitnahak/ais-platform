/** Pure helpers for Session Builder prescription pills — no I/O. */

export const PILL_VARIANT = {
  base: 'base',
  intensity: 'intensity',
  effort: 'effort',
  time: 'time',
  detail: 'detail',
}

function primaryIsLoad(t) {
  return t === 'absolute' || t === 'pct_1rm'
}

function primaryIsTime(t) {
  return t === 'time' || t === 'distance'
}

function effortEnumFromMenuKey(key) {
  if (key === 'rpe') return 'rpe'
  if (key === 'rir') return 'rir'
  if (key === 'velocity') return 'velocity'
  return null
}

/** Pill keys rendered as columns in SetsRepsTable (not as chips below the table). */
export const TABLE_INTENSITY_PILL_KEYS = new Set([
  'weight',
  'pct1rm',
  'time',
  'distance',
  'secondary_weight',
  'secondary_pct1rm',
  'rpe',
  'rir',
  'velocity',
  'tertiary_weight',
  'tertiary_pct1rm',
  'tertiary_rpe',
  'tertiary_rir',
  'tertiary_velocity',
  'tertiary_time',
  'tertiary_distance',
  'rest',
])

/**
 * Dynamic columns for the sets/reps grid: primary, secondary, tertiary (when set), plus rest when `rest_seconds` is set.
 * Each column maps to one `buildSavePatch` / `removeDimension` pill key.
 */
export function deriveTableIntensityColumns(ex) {
  if (!ex) return []
  const cols = []
  const pt = ex.prescription_type ?? 'max'
  const st = ex.secondary_prescription_type
  const tt = ex.tertiary_prescription_type

  if (pt === 'absolute') {
    cols.push({ pillKey: 'weight', headerLabel: 'Weight (kg)', step: 0.5 })
  } else if (pt === 'pct_1rm') {
    cols.push({ pillKey: 'pct1rm', headerLabel: '% 1RM', step: 0.5 })
  } else if (pt === 'time') {
    cols.push({ pillKey: 'time', headerLabel: 'Time (s)', step: 1 })
  } else if (pt === 'distance') {
    cols.push({ pillKey: 'distance', headerLabel: 'Distance (m)', step: 1 })
  }

  if (st === 'absolute') {
    cols.push({ pillKey: 'secondary_weight', headerLabel: 'Weight (kg)', step: 0.5 })
  } else if (st === 'pct_1rm') {
    cols.push({ pillKey: 'secondary_pct1rm', headerLabel: '% 1RM', step: 0.5 })
  } else if (st === 'rpe') {
    cols.push({ pillKey: 'rpe', headerLabel: 'RPE', step: 1, min: 1, max: 10 })
  } else if (st === 'rir') {
    cols.push({ pillKey: 'rir', headerLabel: 'RIR', step: 1 })
  } else if (st === 'velocity') {
    cols.push({ pillKey: 'velocity', headerLabel: 'Velocity (m/s)', step: 0.01 })
  }

  if (tt === 'absolute') {
    cols.push({ pillKey: 'tertiary_weight', headerLabel: 'Weight (kg)', step: 0.5 })
  } else if (tt === 'pct_1rm') {
    cols.push({ pillKey: 'tertiary_pct1rm', headerLabel: '% 1RM', step: 0.5 })
  } else if (tt === 'rpe') {
    cols.push({ pillKey: 'tertiary_rpe', headerLabel: 'RPE', step: 1, min: 1, max: 10 })
  } else if (tt === 'rir') {
    cols.push({ pillKey: 'tertiary_rir', headerLabel: 'RIR', step: 1 })
  } else if (tt === 'velocity') {
    cols.push({ pillKey: 'tertiary_velocity', headerLabel: 'Velocity (m/s)', step: 0.01 })
  } else if (tt === 'time') {
    cols.push({ pillKey: 'tertiary_time', headerLabel: 'Time (s)', step: 1 })
  } else if (tt === 'distance') {
    cols.push({ pillKey: 'tertiary_distance', headerLabel: 'Distance (m)', step: 1 })
  }

  if (ex.rest_seconds != null) {
    cols.push({ pillKey: 'rest', headerLabel: 'Rest (s)', step: 1 })
  }

  return cols
}

/** Prescription slots used for the 3-marker cap (rest is a separate column and must not count here). */
export function prescriptionTableColumnCount(ex) {
  if (!ex) return 0
  return deriveTableIntensityColumns(ex).filter((c) => c.pillKey !== 'rest').length
}

function intensityRawForPillKey(ex, pillKey) {
  if (!ex) return null
  switch (pillKey) {
    case 'weight':
    case 'pct1rm':
    case 'time':
    case 'distance':
      return ex.prescription_value
    case 'secondary_weight':
    case 'secondary_pct1rm':
    case 'rpe':
    case 'rir':
    case 'velocity':
      return ex.secondary_prescription_value
    case 'tertiary_weight':
    case 'tertiary_pct1rm':
    case 'tertiary_rpe':
    case 'tertiary_rir':
    case 'tertiary_velocity':
    case 'tertiary_time':
    case 'tertiary_distance':
      return ex.tertiary_prescription_value
    case 'rest':
      return ex.rest_seconds
    default:
      return null
  }
}

export function formatIntensityCellValue(ex, pillKey) {
  const v = intensityRawForPillKey(ex, pillKey)
  if (v == null || v === '') return ''
  return String(v)
}

/** Sets / reps + intensity columns are edited in SetsRepsTable; detail fields stay as pills. */
export function derivePills(ex) {
  if (!ex) return []

  const pills = []
  const pt = ex.prescription_type || 'max'
  const pv = ex.prescription_value
  if (pt === 'absolute') {
    pills.push({
      key: 'weight',
      label: pv != null && pv !== '' ? `${pv} kg` : '— kg',
      variant: PILL_VARIANT.intensity,
      removable: true,
      raw: pv,
    })
  } else if (pt === 'pct_1rm') {
    pills.push({
      key: 'pct1rm',
      label: pv != null && pv !== '' ? `${pv}% 1RM` : '— % 1RM',
      variant: PILL_VARIANT.intensity,
      removable: true,
      raw: pv,
    })
  } else if (pt === 'time') {
    pills.push({
      key: 'time',
      label: pv != null && pv !== '' ? `${pv}s` : '— s',
      variant: PILL_VARIANT.time,
      removable: true,
      raw: pv,
    })
  } else if (pt === 'distance') {
    pills.push({
      key: 'distance',
      label: pv != null && pv !== '' ? `${pv} m` : '— m',
      variant: PILL_VARIANT.time,
      removable: true,
      raw: pv,
    })
  }

  const st = ex.secondary_prescription_type
  const sv = ex.secondary_prescription_value
  if (st === 'absolute') {
    pills.push({
      key: 'secondary_weight',
      label: sv != null && sv !== '' ? `${sv} kg` : '— kg',
      variant: PILL_VARIANT.intensity,
      removable: true,
      raw: sv,
    })
  } else if (st === 'pct_1rm') {
    pills.push({
      key: 'secondary_pct1rm',
      label: sv != null && sv !== '' ? `${sv}% 1RM` : '— % 1RM',
      variant: PILL_VARIANT.intensity,
      removable: true,
      raw: sv,
    })
  } else if (st === 'rpe') {
    pills.push({
      key: 'rpe',
      label: sv != null && sv !== '' ? `${sv} RPE` : '— RPE',
      variant: PILL_VARIANT.effort,
      removable: true,
      raw: sv,
    })
  } else if (st === 'rir') {
    pills.push({
      key: 'rir',
      label: sv != null && sv !== '' ? `${sv} RIR` : '— RIR',
      variant: PILL_VARIANT.effort,
      removable: true,
      raw: sv,
    })
  } else if (st === 'velocity') {
    pills.push({
      key: 'velocity',
      label: sv != null && sv !== '' ? `${sv} m/s` : '— m/s',
      variant: PILL_VARIANT.effort,
      removable: true,
      raw: sv,
    })
  }

  const tt = ex.tertiary_prescription_type
  const tv = ex.tertiary_prescription_value
  if (tt === 'absolute') {
    pills.push({
      key: 'tertiary_weight',
      label: tv != null && tv !== '' ? `${tv} kg` : '— kg',
      variant: PILL_VARIANT.intensity,
      removable: true,
      raw: tv,
    })
  } else if (tt === 'pct_1rm') {
    pills.push({
      key: 'tertiary_pct1rm',
      label: tv != null && tv !== '' ? `${tv}% 1RM` : '— % 1RM',
      variant: PILL_VARIANT.intensity,
      removable: true,
      raw: tv,
    })
  } else if (tt === 'rpe') {
    pills.push({
      key: 'tertiary_rpe',
      label: tv != null && tv !== '' ? `${tv} RPE` : '— RPE',
      variant: PILL_VARIANT.effort,
      removable: true,
      raw: tv,
    })
  } else if (tt === 'rir') {
    pills.push({
      key: 'tertiary_rir',
      label: tv != null && tv !== '' ? `${tv} RIR` : '— RIR',
      variant: PILL_VARIANT.effort,
      removable: true,
      raw: tv,
    })
  } else if (tt === 'velocity') {
    pills.push({
      key: 'tertiary_velocity',
      label: tv != null && tv !== '' ? `${tv} m/s` : '— m/s',
      variant: PILL_VARIANT.effort,
      removable: true,
      raw: tv,
    })
  }

  return pills.filter((p) => !TABLE_INTENSITY_PILL_KEYS.has(p.key))
}

export const ADD_MENU = [
  { group: 'Load', key: 'weight', label: 'Weight (kg)' },
  { group: 'Load', key: 'pct1rm', label: '% 1RM' },
  { group: 'Effort', key: 'rpe', label: 'RPE (1–10)' },
  { group: 'Effort', key: 'rir', label: 'RIR' },
  { group: 'Effort', key: 'velocity', label: 'Velocity (m/s)' },
  { group: 'Time', key: 'time', label: 'Time (sec)' },
  { group: 'Time', key: 'distance', label: 'Distance (m)' },
  { group: 'Recovery', key: 'rest', label: 'Rest (sec)' },
]

/** Menu keys that add a column in the sets table (max three across primary + secondary + tertiary). */
export const INTENSITY_ADD_MENU_KEYS = new Set(['weight', 'pct1rm', 'rpe', 'rir', 'velocity', 'time', 'distance'])

/** When three intensity columns already exist, only non-column “Detail” adds stay available. */
export function filterAddMenuRespectingIntensityCap(avail, intensityColumnCount) {
  if (!avail?.length) return []
  if (intensityColumnCount < 3) return avail
  return avail.filter((m) => !INTENSITY_ADD_MENU_KEYS.has(m.key))
}

export function activePillKeys(ex) {
  return new Set(derivePills(ex).map((p) => p.key))
}

export function availableAddOptions(ex) {
  if (!ex) return ADD_MENU
  const pt = ex.prescription_type ?? 'max'
  const st = ex.secondary_prescription_type
  const tt = ex.tertiary_prescription_type

  return ADD_MENU.filter((m) => {
    if (m.key === 'weight') {
      if (pt === 'absolute') return false
      if (pt === 'pct_1rm' && st === 'absolute') return false
      if (pt === 'pct_1rm' && tt === 'absolute') return false
      return true
    }
    if (m.key === 'pct1rm') {
      if (pt === 'pct_1rm') return false
      if (st === 'pct_1rm') return false
      if (tt === 'pct_1rm') return false
      return true
    }
    if (m.key === 'rpe') return st !== 'rpe' && tt !== 'rpe'
    if (m.key === 'rir') return st !== 'rir' && tt !== 'rir'
    if (m.key === 'velocity') return st !== 'velocity' && tt !== 'velocity'
    if (m.key === 'time') return pt !== 'time' && st !== 'time' && tt !== 'time'
    if (m.key === 'distance') return pt !== 'distance' && st !== 'distance' && tt !== 'distance'
    if (m.key === 'rest') return ex.rest_seconds == null
    return true
  })
}

export function buildAddPatch(key) {
  switch (key) {
    case 'weight':
      return { prescription_type: 'absolute', prescription_value: null }
    case 'pct1rm':
      return { prescription_type: 'pct_1rm', prescription_value: null }
    case 'time':
      return { prescription_type: 'time', prescription_value: null }
    case 'distance':
      return { prescription_type: 'distance', prescription_value: null }
    case 'rpe':
      return { secondary_prescription_type: 'rpe', secondary_prescription_value: null }
    case 'rir':
      return { secondary_prescription_type: 'rir', secondary_prescription_value: null }
    case 'velocity':
      return { secondary_prescription_type: 'velocity', secondary_prescription_value: null }
    case 'rest':
      return { rest_seconds: 0 }
    default:
      return {}
  }
}

/** Map add-menu key → pill key to focus after insert. */
export function pillKeyAfterAdd(menuKey, patch) {
  if (!patch || typeof patch !== 'object') return menuKey
  if (menuKey === 'weight' && patch.secondary_prescription_type === 'absolute') return 'secondary_weight'
  if (menuKey === 'weight' && patch.tertiary_prescription_type === 'absolute') return 'tertiary_weight'
  if (menuKey === 'pct1rm' && patch.secondary_prescription_type === 'pct_1rm') return 'secondary_pct1rm'
  if (menuKey === 'pct1rm' && patch.tertiary_prescription_type === 'pct_1rm') return 'tertiary_pct1rm'
  if (menuKey === 'rpe' && patch.tertiary_prescription_type === 'rpe') return 'tertiary_rpe'
  if (menuKey === 'rir' && patch.tertiary_prescription_type === 'rir') return 'tertiary_rir'
  if (menuKey === 'velocity' && patch.tertiary_prescription_type === 'velocity') return 'tertiary_velocity'
  if (menuKey === 'rir' && patch.tertiary_prescription_type === 'rir') return 'tertiary_rir'
  return menuKey
}

/** When adding load-type, clear conflicting primary if switching from another load/time primary. */
export function mergeAddPatch(ex, key) {
  const base = buildAddPatch(key)
  const pt = ex.prescription_type ?? 'max'
  const st = ex.secondary_prescription_type
  const tt = ex.tertiary_prescription_type

  if (key === 'weight') {
    if (primaryIsTime(pt)) {
      return {
        prescription_type: 'absolute',
        prescription_value: null,
        secondary_prescription_type: null,
        secondary_prescription_value: null,
        tertiary_prescription_type: null,
        tertiary_prescription_value: null,
      }
    }
    if (pt === 'pct_1rm') {
      if (st === 'absolute' || tt === 'absolute') return {}
      if (st == null) {
        return { secondary_prescription_type: 'absolute', secondary_prescription_value: null }
      }
      if (tt == null) {
        return { tertiary_prescription_type: 'absolute', tertiary_prescription_value: null }
      }
      return {}
    }
    if (pt === 'max') {
      return {
        prescription_type: 'absolute',
        prescription_value: null,
        secondary_prescription_type: null,
        secondary_prescription_value: null,
        tertiary_prescription_type: null,
        tertiary_prescription_value: null,
      }
    }
    return base
  }

  if (key === 'pct1rm') {
    if (primaryIsTime(pt)) {
      return {
        prescription_type: 'pct_1rm',
        prescription_value: null,
        secondary_prescription_type: null,
        secondary_prescription_value: null,
        tertiary_prescription_type: null,
        tertiary_prescription_value: null,
      }
    }
    if (pt === 'absolute') {
      if (st === 'pct_1rm' || tt === 'pct_1rm') return {}
      if (st == null) {
        return { secondary_prescription_type: 'pct_1rm', secondary_prescription_value: null }
      }
      if (tt == null) {
        return { tertiary_prescription_type: 'pct_1rm', tertiary_prescription_value: null }
      }
      return {}
    }
    if (pt === 'max') {
      return {
        prescription_type: 'pct_1rm',
        prescription_value: null,
        secondary_prescription_type: null,
        secondary_prescription_value: null,
        tertiary_prescription_type: null,
        tertiary_prescription_value: null,
      }
    }
    return base
  }

  if (['time', 'distance'].includes(key)) {
    if (pt === 'time' && key === 'time') return {}
    if (pt === 'distance' && key === 'distance') return {}
    if (primaryIsLoad(pt) || pt === 'max' || primaryIsTime(pt)) {
      return {
        prescription_type: key === 'time' ? 'time' : 'distance',
        prescription_value: null,
        secondary_prescription_type: null,
        secondary_prescription_value: null,
        tertiary_prescription_type: null,
        tertiary_prescription_value: null,
      }
    }
  }

  if (['rpe', 'rir', 'velocity'].includes(key)) {
    const t = effortEnumFromMenuKey(key)
    if (!st) {
      return { secondary_prescription_type: t, secondary_prescription_value: null }
    }
    if (!tt) {
      return { tertiary_prescription_type: t, tertiary_prescription_value: null }
    }
    return { tertiary_prescription_type: t, tertiary_prescription_value: null }
  }
  return base
}

export function buildRemovePatch(ex, pillKey) {
  const tt = ex?.tertiary_prescription_type

  switch (pillKey) {
    case 'weight':
    case 'pct1rm':
    case 'time':
    case 'distance':
      return {
        prescription_type: 'max',
        prescription_value: null,
        secondary_prescription_type: null,
        secondary_prescription_value: null,
        tertiary_prescription_type: null,
        tertiary_prescription_value: null,
      }
    case 'secondary_weight':
    case 'secondary_pct1rm':
    case 'rpe':
    case 'rir':
    case 'velocity':
      return {
        secondary_prescription_type: tt ?? null,
        secondary_prescription_value: tt != null ? ex.tertiary_prescription_value : null,
        tertiary_prescription_type: null,
        tertiary_prescription_value: null,
      }
    case 'tertiary_weight':
    case 'tertiary_pct1rm':
    case 'tertiary_rpe':
    case 'tertiary_rir':
    case 'tertiary_velocity':
    case 'tertiary_time':
    case 'tertiary_distance':
      return { tertiary_prescription_type: null, tertiary_prescription_value: null }
    case 'rest':
      return { rest_seconds: null }
    default:
      return {}
  }
}

export function buildSavePatch(pillKey, value) {
  switch (pillKey) {
    case 'weight':
      return { prescription_type: 'absolute', prescription_value: value === '' || value == null ? null : Number(value) }
    case 'pct1rm':
      return { prescription_type: 'pct_1rm', prescription_value: value === '' || value == null ? null : Number(value) }
    case 'secondary_weight':
      return {
        secondary_prescription_type: 'absolute',
        secondary_prescription_value: value === '' || value == null ? null : Number(value),
      }
    case 'secondary_pct1rm':
      return {
        secondary_prescription_type: 'pct_1rm',
        secondary_prescription_value: value === '' || value == null ? null : Number(value),
      }
    case 'tertiary_weight':
      return {
        tertiary_prescription_type: 'absolute',
        tertiary_prescription_value: value === '' || value == null ? null : Number(value),
      }
    case 'tertiary_pct1rm':
      return {
        tertiary_prescription_type: 'pct_1rm',
        tertiary_prescription_value: value === '' || value == null ? null : Number(value),
      }
    case 'time':
      return { prescription_type: 'time', prescription_value: value === '' || value == null ? null : Number(value) }
    case 'distance':
      return { prescription_type: 'distance', prescription_value: value === '' || value == null ? null : Number(value) }
    case 'tertiary_time':
      return { tertiary_prescription_type: 'time', tertiary_prescription_value: value === '' || value == null ? null : Number(value) }
    case 'tertiary_distance':
      return { tertiary_prescription_type: 'distance', tertiary_prescription_value: value === '' || value == null ? null : Number(value) }
    case 'rpe':
      return {
        secondary_prescription_type: 'rpe',
        secondary_prescription_value: value === '' || value == null ? null : Math.min(10, Math.max(1, Number(value))),
      }
    case 'rir':
      return { secondary_prescription_type: 'rir', secondary_prescription_value: value === '' || value == null ? null : Number(value) }
    case 'velocity':
      return { secondary_prescription_type: 'velocity', secondary_prescription_value: value === '' || value == null ? null : Number(value) }
    case 'tertiary_rpe':
      return {
        tertiary_prescription_type: 'rpe',
        tertiary_prescription_value: value === '' || value == null ? null : Math.min(10, Math.max(1, Number(value))),
      }
    case 'tertiary_rir':
      return { tertiary_prescription_type: 'rir', tertiary_prescription_value: value === '' || value == null ? null : Number(value) }
    case 'tertiary_velocity':
      return { tertiary_prescription_type: 'velocity', tertiary_prescription_value: value === '' || value == null ? null : Number(value) }
    case 'rest':
      return { rest_seconds: value === '' || value == null ? null : Math.round(Number(value)) }
    default:
      return {}
  }
}

export function pillEditKind(_pillKey) {
  return 'number'
}

export function pillInputSuffix(pillKey) {
  if (pillKey === 'weight' || pillKey === 'secondary_weight' || pillKey === 'tertiary_weight') return 'kg'
  if (pillKey === 'pct1rm' || pillKey === 'secondary_pct1rm' || pillKey === 'tertiary_pct1rm') return '%'
  if (pillKey === 'time' || pillKey === 'tertiary_time') return 's'
  if (pillKey === 'distance' || pillKey === 'tertiary_distance') return 'm'
  if (pillKey === 'velocity' || pillKey === 'tertiary_velocity') return 'm/s'
  if (pillKey === 'rest') return 's'
  return ''
}
