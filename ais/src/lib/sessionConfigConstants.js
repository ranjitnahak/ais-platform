export const DEFAULT_SESSION_CONFIG_ORG_ID = 'a1000000-0000-0000-0000-000000000001';

export const SESSION_TYPE_SELECT =
  'id, org_id, key, label, sort_order, is_active, default_venue';

export const SESSION_VENUE_SELECT = 'id, org_id, label, sort_order, is_active';

export function slugifySessionTypeKey(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'session_type';
}

/** Format a raw session_type key when no config row exists (e.g. legacy "mat"). */
export function formatSessionTypeKeyFallback(key) {
  if (!key) return 'Session';
  return String(key)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
