/** Blood group stored as short text; empty string → null on save. */
export const BLOOD_GROUP_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

/** DB check constraints expect lowercase gender. */
export function normalizeGenderForDb(g) {
  if (g == null || String(g).trim() === '') return null;
  return String(g).trim().toLowerCase();
}

/** DB stores positions with underscores (e.g. all_rounder). */
export function normalizePositionForDb(p) {
  if (p == null || String(p).trim() === '') return null;
  return String(p).trim().toLowerCase().replace(/-/g, '_');
}
