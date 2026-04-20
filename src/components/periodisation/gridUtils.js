import { ROW_GROUPS } from '../../lib/periodisationUtils';

/** Human-readable title when `display_label` is unset (handles snake_case keys). */
export function formatRowGroupForDisplay(rowGroup) {
  if (!rowGroup) return '';
  const g = String(rowGroup);
  if (ROW_GROUPS.includes(g)) return g;
  return g
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function getGroupHeaderDisplay(groupCanonical, groupRows) {
  const dl = groupRows.map((r) => r.display_label).find((x) => x != null && String(x).trim() !== '');
  if (dl) return String(dl).trim();
  return formatRowGroupForDisplay(groupCanonical);
}
