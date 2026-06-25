/** Shared zone badge tokens for dashboard metric pills (RPE, Wellness, etc.). */

export const ZONE_BADGE = {
  safe: 'bg-[color-mix(in_srgb,var(--color-excellent)_20%,transparent)] text-[var(--color-excellent)]',
  caution: 'bg-[color-mix(in_srgb,var(--color-primary-container)_20%,transparent)] text-[var(--color-primary-container)]',
  danger: 'bg-[color-mix(in_srgb,var(--color-error-container)_25%,transparent)] text-[var(--color-error)]',
};

export function zoneBadgeClass(zone) {
  return ZONE_BADGE[zone] ?? '';
}

/** Maps wellness 1–5 scores to safe / caution / danger zones. */
export function getWellnessZone(value, { inverse = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (inverse) {
    if (n <= 2) return 'safe';
    if (n === 3) return 'caution';
    return 'danger';
  }
  if (n <= 2) return 'danger';
  if (n === 3) return 'caution';
  return 'safe';
}
