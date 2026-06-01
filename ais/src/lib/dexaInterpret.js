/** DEXA display helpers for Reports. */

export function formatScanDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ageFromDob(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function gramsToKg(grams) {
  if (grams == null || grams === '') return null;
  const g = Number(grams);
  if (!Number.isFinite(g)) return null;
  return Math.round((g / 1000) * 10) / 10;
}

export function formatMetric(value, decimals = 1) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

/**
 * T-Score clinical bands for display.
 * @returns {{ label: string, colorVar: string }}
 */
export function interpretTScore(tScore) {
  const n = Number(tScore);
  if (!Number.isFinite(n)) {
    return { label: '—', colorVar: 'var(--color-on-surface-variant)' };
  }
  if (n >= -1.0) {
    return { label: 'Normal', colorVar: 'var(--color-excellent)' };
  }
  if (n > -2.5) {
    return { label: 'Osteopenia', colorVar: 'var(--color-avg)' };
  }
  return { label: 'Osteoporosis', colorVar: 'var(--color-below-avg)' };
}
