// src/lib/auth.js
// Auth stub — replace with real Supabase auth in V2.
// Every component imports from here. When real auth lands,
// only this file changes — all components stay untouched.

export const getCurrentUser = () => ({
  id: 'u1000000-0000-0000-0000-000000000001',
  orgId: 'a1000000-0000-0000-0000-000000000001',
  role: 'staff', // superuser | admin | staff | athlete
  permissions: {
    periodisation: 'edit',   // view | edit | admin
    assessments: 'edit',
    reports: 'view',
    sessionLibrary: 'admin',
  },
  teamIds: [
    'b2000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000002',
  ],
})

// Check if current user can perform an action on a resource
// Usage: can('periodisation', 'edit') → true/false
export const can = (resource, action) => {
  const user = getCurrentUser()
  const level = user.permissions[resource]
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
  return (
    can('periodisation', 'edit') &&
    user.teamIds.includes(plan.team_id)
  )
}

// Can this user add items to the org session library?
// Only admins can — staff can use 'one-off' items but not save to library
export const canEditSessionLibrary = () => {
  return can('sessionLibrary', 'admin')
}
