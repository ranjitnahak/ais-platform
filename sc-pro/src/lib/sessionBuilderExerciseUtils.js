export function sortedExercises(b) {
  return [...(b.session_exercises || [])].sort((a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0))
}

export function supersetRowMeta(sorted, idx) {
  const ex = sorted[idx]
  const prev = idx > 0 ? sorted[idx - 1] : null
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null
  const g = ex.superset_group
  const prevSame = prev != null && g != null && prev.superset_group === g
  const nextSame = next != null && g != null && next.superset_group === g
  return {
    showRail: g != null && (prevSame || nextSame),
  }
}

/** At least two exercises share the same non-null superset_group (linked superset). */
export function blockHasLinkedSupersets(block) {
  const exs = block?.session_exercises
  if (!exs?.length) return false
  const counts = new Map()
  for (const ex of exs) {
    const g = ex.superset_group
    if (g == null || g === '') continue
    const key = String(g)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  for (const n of counts.values()) {
    if (n >= 2) return true
  }
  return false
}
