// src/lib/auth.js
// Auth stub — replace with real Supabase auth in V2.
// Every component imports from here. When real auth lands,
// only this file changes — all components stay untouched.

// Stable references so hooks can safely list teamIds in useCallback/useEffect deps
// (a fresh [] from getCurrentUser() each render caused infinite refresh loops).
const STUB_TEAM_IDS = Object.freeze([
  'b2000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000002',
])

const STUB_USER = Object.freeze({
  // Valid Postgres uuid (hex digits only). Values like u1000… are rejected (22P02) if sent to uuid columns.
  id: 'e1000000-0000-0000-0000-000000000001',
  orgId: 'a1000000-0000-0000-0000-000000000001',
  role: 'staff',
  permissions: Object.freeze({
    periodisation: 'edit',
    assessments: 'edit',
    reports: 'view',
    sessionLibrary: 'admin',
    adminConfig: 'admin',
    programme: 'edit',
    viewCoachingData: true,
  }),
  teamIds: STUB_TEAM_IDS,
})

export const getCurrentUser = () => STUB_USER

// Check if current user can perform an action on a resource
// Usage: can('periodisation', 'edit') → true/false
// Boolean permissions: can('viewCoachingData', 'view') → value of permissions.viewCoachingData
// SC Pro §11.3: can('programme', 'viewCoachingData') → permissions.viewCoachingData (not hierarchy)
export const can = (resource, action) => {
  const user = getCurrentUser()
  const level = user.permissions[resource]
  if (typeof level === 'boolean') return level
  if (action === 'viewCoachingData') {
    return user.permissions.viewCoachingData === true
  }
  const hierarchy = { view: 1, edit: 2, admin: 3 }
  return (hierarchy[level] || 0) >= (hierarchy[action] || 0)
}

// Returns the team IDs this user can see — use in all team queries
export const getAccessibleTeams = () => {
  return getCurrentUser().teamIds
}

// Can this user edit a specific periodisation plan?
// Checks both permission level AND team membership
export const canEditPlan = (plan) => {
  const user = getCurrentUser()
  return can('periodisation', 'edit') && user.teamIds.includes(plan.team_id)
}

// Can this user add items to the org session library?
// Only admins can — staff can use 'one-off' items but not save to library
export const canEditSessionLibrary = () => {
  return can('sessionLibrary', 'admin')
}
