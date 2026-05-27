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

export const PERMISSION_RESOURCES = [
  'assessments',
  'periodisation',
  'reports',
  'wellness',
  'rpe_logging',
  'staff_notes',
  'athleteRoster',
  'adminConfig',
];

export const PERMISSION_ACTIONS = [
  ['can_view', 'view', 'View'],
  ['can_create', 'create', 'Create'],
  ['can_edit', 'edit', 'Edit'],
  ['can_delete', 'delete', 'Delete'],
];
