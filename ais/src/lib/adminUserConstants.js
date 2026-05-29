/** Staff invite role labels → postgres user_role enum (invite-user Edge Function). */
export const STAFF_ROLE_ENUM = {
  'S&C Coach': 'sc_coach',
  Physiotherapist: 'physio',
  'Head Coach': 'head_coach',
  Analyst: 'analyst',
  Nutritionist: 'nutritionist',
  Manager: 'manager',
  Admin: 'admin',
};

/** Enum / slug → display label for admin UI. */
export const USER_ROLE_DISPLAY = {
  ...Object.fromEntries(Object.entries(STAFF_ROLE_ENUM).map(([label, value]) => [value, label])),
  superuser: 'Superuser',
  athlete: 'Athlete',
};

/** Format staff role enum or athlete position for display (e.g. nutritionist → Nutritionist). */
export function formatRoleOrPosition(value) {
  if (!value) return '—';
  const key = String(value).trim().toLowerCase();
  if (USER_ROLE_DISPLAY[key]) return USER_ROLE_DISPLAY[key];
  const words = key.split(/[_\s]+/);
  if (words.length > 1) {
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Map staff UI label → roles.name in DB for user_roles insert. */
export const STAFF_ROLE_DB_NAME = {
  'S&C Coach': 'S&C Coach',
  Physiotherapist: 'Physio',
  'Head Coach': 'Head Coach',
  Analyst: 'Analyst',
  Nutritionist: 'Nutritionist',
  Manager: 'Manager',
  Admin: 'Admin',
};

export const PERMISSION_CATEGORIES = [
  { label: 'Dashboard', resources: ['wellness', 'rpe_logging', 'injury_surveillance'] },
  { label: 'Log', resources: ['assessments', 'staff_notes'] },
  { label: 'Reports', resources: ['reports', 'unified_reports'] },
  { label: 'Planning', resources: ['periodisation', 'sessionLibrary', 'sc_pro'] },
  { label: 'Roster', resources: ['athleteRoster', 'athlete_portal'] },
  { label: 'Admin', resources: ['adminConfig'] },
];

export const PERMISSION_RESOURCES = PERMISSION_CATEGORIES.flatMap((category) => category.resources);

export const PERMISSION_ACTIONS = [
  ['can_view', 'view', 'View'],
  ['can_create', 'create', 'Create'],
  ['can_edit', 'edit', 'Edit'],
  ['can_delete', 'delete', 'Delete'],
];
