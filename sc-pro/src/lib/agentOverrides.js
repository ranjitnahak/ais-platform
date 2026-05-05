/** Apply parsed coach overrides (from parseCoachOverride) to a single week plan JSON. */

function normCat(c) {
  return String(c || '').toLowerCase()
}

export function applyParsedOverrideToWeek(weekPlan, parsed, weekNumber) {
  if (!weekPlan || !parsed) return weekPlan
  const next = JSON.parse(JSON.stringify(weekPlan))
  const t = String(parsed.type || '').toLowerCase()
  const tgt = String(parsed.target || '').toLowerCase().trim()
  const pv = parsed.parsed_value

  if (t === 'skip' && tgt.includes('condition')) {
    next.sessions = (next.sessions ?? []).filter((s) => normCat(s.category) !== 'conditioning')
    next.__skipCategories = new Set(['conditioning'])
    return next
  }

  if (t === 'volume') {
    const factor = pv != null && Number.isFinite(Number(pv)) ? Number(pv) : 0.7
    for (const s of next.sessions ?? []) {
      for (const b of s.blocks ?? []) {
        for (const ex of b.exercises ?? []) {
          const sets = Number(ex.sets) || 3
          ex.sets = Math.max(1, Math.ceil(sets * factor))
        }
      }
    }
    return next
  }

  if (t === 'intensity' && tgt) {
    for (const s of next.sessions ?? []) {
      for (const b of s.blocks ?? []) {
        for (const ex of b.exercises ?? []) {
          const n = String(ex.name || '').toLowerCase()
          if (!n.includes(tgt) && !tgt.includes(n.slice(0, 5))) continue
          if (ex.prescription_type === 'pct_1rm' && ex.prescription_value != null) {
            ex.prescription_value = Math.round(Number(ex.prescription_value) * 1.1 * 10) / 10
          } else if (ex.prescription_type === 'rpe' && ex.prescription_value != null) {
            ex.prescription_value = Math.min(10, Number(ex.prescription_value) + 1)
          } else if (ex.rpe != null) {
            ex.rpe = Math.min(10, Number(ex.rpe) + 1)
          }
        }
      }
    }
    return next
  }

  return next
}
