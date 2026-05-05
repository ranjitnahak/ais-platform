import { weekDays } from './weekDates.js'

const CANON = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** Map label → 0..6 (Mon..Sun) */
export function dayLabelToIndex(label) {
  const t = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
  if (!t) return -1
  for (let i = 0; i < CANON.length; i++) {
    if (CANON[i] === t || CANON[i].startsWith(t) || t.startsWith(CANON[i].slice(0, 3))) return i
  }
  return -1
}

/**
 * @param {object} programme — programmes row (for week grid)
 * @param {number} weekNumber
 * @param {string | null} dayOfWeek — monday|tuesday|… or shorthand
 * @returns {string} YYYY-MM-DD or ''
 */
export function resolveAgentSessionDate(programme, weekNumber, dayOfWeek) {
  if (!programme || weekNumber == null) return ''
  const idx = dayLabelToIndex(dayOfWeek)
  if (idx < 0) return ''
  const grid = weekDays(programme, weekNumber)
  return grid[idx]?.iso ?? ''
}
