/**
 * Canonical display + storage helpers for athlete names (first / last / legacy full_name).
 * After DB migration, existing rows may have legacy text only in first_name; full_name is
 * kept in sync on writes for ordering and older code paths.
 */

/** Single string for DB `full_name` and sorting — trimmed parts joined by one space. */
export function canonicalFullName(firstName, lastName) {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f && l) return `${f} ${l}`;
  return f || l || '';
}

/**
 * Display name for UI and reports: prefer first + last; else legacy `full_name`.
 */
export function athleteDisplayName(a) {
  if (!a) return '';
  const combined = canonicalFullName(a.first_name, a.last_name);
  if (combined) return combined;
  return (a.full_name ?? '').trim();
}

/** Two-letter style initials from structured or legacy name. */
export function athleteInitialsFromAthlete(a) {
  const display = athleteDisplayName(a);
  if (!display) return '?';
  const f = (a.first_name ?? '').trim();
  const l = (a.last_name ?? '').trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1) {
    const w = parts[0];
    if (w.length >= 2) return w.slice(0, 2).toUpperCase();
    return `${w[0] || '?'}?`.toUpperCase();
  }
  return '?';
}
