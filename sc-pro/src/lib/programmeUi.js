/** UI maps — colours only via CSS variables / rgba aligned to Kinetic Precision spec */

export const PHASE_ACCENT_VAR = {
  accumulation: '--color-phase-accumulation',
  intensification: '--color-phase-intensification',
  realisation: '--color-phase-realisation',
  transition: '--color-phase-transition',
  general: '--color-phase-general',
}

/** Soft-fill badge: 15% tint of semantic colour */
export const PHASE_BADGE = {
  accumulation: {
    background: 'rgba(249, 115, 22, 0.15)',
    color: 'var(--color-phase-accumulation)',
  },
  intensification: {
    background: 'rgba(139, 92, 246, 0.15)',
    color: 'var(--color-phase-intensification)',
  },
  realisation: {
    background: 'rgba(6, 182, 212, 0.15)',
    color: 'var(--color-phase-realisation)',
  },
  transition: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--color-phase-transition)',
  },
  general: {
    background: 'rgba(107, 114, 128, 0.15)',
    color: 'var(--color-phase-general)',
  },
}

export const DIFF_BADGE = {
  low: { background: 'rgba(52, 199, 89, 0.15)', color: 'var(--color-diff-low)' },
  moderate: { background: 'rgba(255, 159, 10, 0.15)', color: 'var(--color-diff-moderate)' },
  high: { background: 'rgba(249, 115, 22, 0.15)', color: 'var(--color-diff-high)' },
  very_high: { background: 'rgba(255, 59, 48, 0.15)', color: 'var(--color-diff-very-high)' },
}

export const PHASE_TYPES = [
  'accumulation',
  'intensification',
  'realisation',
  'transition',
  'general',
]
export const TRAINING_AGES = ['beginner', 'intermediate', 'advanced', 'elite']
export const DIFFICULTIES = ['low', 'moderate', 'high', 'very_high']

export function formatRelativeActivity(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

export function athleteDisplayName(a) {
  if (!a) return ''
  return a.full_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Athlete'
}
