# The Three Rules — Made Concrete

## Rule 1: Always pass `org_id` in queries

Every Supabase query in the periodisation feature follows this pattern:

```js
// WRONG — will break when RLS is on
const { data } = await supabase
  .from('periodisation_plans')
  .select('*')

// RIGHT — org_id always explicit
const { data } = await supabase
  .from('periodisation_plans')
  .select('*')
  .eq('org_id', currentUser.orgId)
```

---

## Rule 2: Always reference a `currentUser` stub — never hardcode

We create one file — `src/lib/auth.js` — that everything imports from:

```js
// src/lib/auth.js
// Stub for now — swap for real Supabase auth in V2

export const getCurrentUser = () => ({
  id: 'u1000000-0000-0000-0000-000000000001',
  orgId: 'a1000000-0000-0000-0000-000000000001',
  role: 'staff',                    // superuser | admin | staff | athlete
  permissions: {
    periodisation: 'edit',          // view | edit | admin
    assessments: 'edit',
    reports: 'view',
    sessionLibrary: 'edit',
  },
  teamIds: [
    'b2000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000002',
  ],
})

// Helper — use this for permission checks in components
export const can = (resource, action) => {
  const user = getCurrentUser()
  const level = user.permissions[resource]
  const hierarchy = { view: 1, edit: 2, admin: 3 }
  return (hierarchy[level] || 0) >= (hierarchy[action] || 0)
}
```

Then in any component:

```js
import { getCurrentUser, can } from '@/lib/auth'

// Usage
const user = getCurrentUser()

// Query always scoped
.eq('org_id', user.orgId)

// Permission check before showing UI
{can('sessionLibrary', 'admin') && <button>Add to org library</button>}
```

> When V2 auth arrives, only `src/lib/auth.js` changes. Every component stays untouched.

---

## Rule 3: No "show everything" queries

Every query that touches teams or plans must filter by `teamIds` from `currentUser`:

```js
// WRONG
const { data: plans } = await supabase
  .from('periodisation_plans')
  .select('*')
  .eq('org_id', user.orgId)

// RIGHT — scoped to teams the user belongs to
const { data: plans } = await supabase
  .from('periodisation_plans')
  .select('*')
  .eq('org_id', user.orgId)
  .in('team_id', user.teamIds)
```
