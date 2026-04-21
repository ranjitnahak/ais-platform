# AIS — Architecture Guidelines
**Version:** 1.0  
**Established:** April 2026  
**Author:** Ranjit Nahak, Strength & Conditioning Coach  
**Status:** Active — Governing Document  

> **This document is the constitution of AIS development.**  
> Every thread, every feature, every line of code is subject to these rules.  
> The Context document (`AIS_Architecture_Context.md`) tells you *what* is built.  
> This document tells you *how* everything must be built.

---

## How to Use This Document

**At the start of every development thread:**
1. Read Section 9 — the Pre-Development Checklist
2. Identify which module you are working on (Section 5)
3. Confirm the V-stage of the work (Section 8)
4. Then write code

**When designing a new feature:**
1. Read Sections 3, 4, and 5 first — data hierarchy, RBAC, module boundaries
2. Confirm the feature is in scope for its V-stage before designing

**When something feels uncertain:**
> The guiding question is always: *"Does this work for one org with one team, AND for ten orgs each with twenty teams?"*  
> If the answer is only the former, the design is wrong.

---

## 1. Platform Identity

### What AIS Is
AIS (Athlete Intelligence System) is a **multi-tenant, sport-agnostic Athlete Management System** built for performance sport organisations. It is designed to compete with and surpass Smartabase/Teamworks by combining domain intelligence with modern UX — not by replicating their builder-layer complexity.

AIS is purpose-built for the S&C and sports science domain. The intelligence (scoring engines, ACWR, peaking index, classification logic) is baked into the platform, not configured by users through forms and field builders. New organisations onboard in minutes, not weeks.

### What AIS Is Not
- **Not a generic form builder.** There is no drag-and-drop field configurator. Smart defaults replace builder complexity.
- **Not a per-org fork.** One codebase, one schema, one deployment. Tenant separation is achieved through data isolation and RBAC — not separate instances.
- **Not a calendar app.** The Periodisation canvas is a planning intelligence layer, not a scheduling tool.
- **Not built for a single sport.** Every feature must work sport-agnostically. Kabaddi is the first validation, not the only target.

---

## 2. The Four-Layer User Hierarchy

All access, permissions, and data scoping flow from this hierarchy. It is fixed and must not be collapsed or simplified.

```
PLATFORM (Superuser)
    └── ORGANISATION
            └── GROUPS  (departments, cohorts, squads)
                    └── TEAMS
                            └── USERS (Staff + Athletes)
                                    └── ROLES + PERMISSIONS
```

| Layer | Who | Scope |
|---|---|---|
| **Superuser** | Platform operator (AIS team) | All orgs, all data, billing, global config |
| **Admin** | Org administrator | Full org — manages roles, groups, teams, users |
| **Staff** | Coaches, physios, analysts, nutritionists | Role-scoped, group-scoped — cannot see outside assigned teams |
| **Athlete** | Athletes | Own data only, read-mostly |

**Critical rule:** A staff member's access is always the intersection of their role permissions AND their group/team membership. Role alone is never sufficient — it must be combined with scope.

---

## 3. The Three Non-Negotiable Coding Rules

These rules apply to every query, every component, every feature — without exception. They exist so that when RLS is re-enabled in V2, zero code changes are needed outside `src/lib/auth.js`.

---

### Rule 1 — Always Pass `org_id` in Queries

Every Supabase query must be scoped to the current organisation. No query may fetch rows without an explicit `org_id` filter.

```js
// ❌ WRONG — will silently return all orgs' data
const { data } = await supabase
  .from('periodisation_plans')
  .select('*')

// ✅ RIGHT
const { data } = await supabase
  .from('periodisation_plans')
  .select('*')
  .eq('org_id', user.orgId)
```

---

### Rule 2 — Always Reference `currentUser` — Never Hardcode

One file owns identity: `src/lib/auth.js`. Everything imports from it. No component, service, or query may hardcode an org ID, user ID, or team ID.

```js
// src/lib/auth.js
// Stub for V1 — swap for real Supabase auth in V2
// Only this file changes when auth is implemented.

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

export const can = (resource, action) => {
  const user = getCurrentUser()
  const level = user.permissions[resource]
  const hierarchy = { view: 1, edit: 2, admin: 3 }
  return (hierarchy[level] || 0) >= (hierarchy[action] || 0)
}
```

Usage in any component:

```js
import { getCurrentUser, can } from '@/lib/auth'

const user = getCurrentUser()

// Always scope queries
.eq('org_id', user.orgId)

// Gate UI behind permissions
{can('sessionLibrary', 'admin') && <button>Add to org library</button>}
```

---

### Rule 3 — No "Show Everything" Queries

Every query touching teams or plans must filter by the user's assigned `teamIds`. Org-level scope alone is not sufficient for team-scoped resources.

```js
// ❌ WRONG — shows all teams in the org
const { data: plans } = await supabase
  .from('periodisation_plans')
  .select('*')
  .eq('org_id', user.orgId)

// ✅ RIGHT — scoped to user's teams
const { data: plans } = await supabase
  .from('periodisation_plans')
  .select('*')
  .eq('org_id', user.orgId)
  .in('team_id', user.teamIds)
```

---

## 4. Data Architecture Principles

### 4.1 Every New Table Requires `org_id`

No exceptions. Every table that holds org-specific data must have `org_id uuid NOT NULL` as a column. This is the foundation of multi-tenant data isolation and makes RLS trivial to re-enable.

```sql
-- ✅ Correct table structure
CREATE TABLE periodisation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id),  -- ← mandatory
  team_id uuid REFERENCES teams(id),
  ...
);
```

### 4.2 Store Raw Values — Derive Visualisations

The database stores numbers. Charts, classifications, load waves, and radar plots are computed at read time from those numbers. Never store a calculated display value as the source of truth.

- Store: `sprint_total_time = 3.84` (seconds)
- Derive: classification badge, percentile rank, radar axis score
- Never store: `sprint_classification = 'Excellent'` as the primary record

### 4.3 `scoring.js` Is Frozen

`src/lib/scoring.js` is the canonical scoring engine. It must not be modified to fix display bugs or adjust logic for a specific feature. All changes to classification behaviour belong in the consuming component (e.g. `AthleteReport.jsx`).

### 4.4 Best-Trial Logic Is Fixed

- Broad Jump / Sit & Reach / Chest Pass: highest value across trials
- Sprint: lowest **total time** trial — all four splits are pulled from that single trial, not independently optimised
- Yo-Yo IR1: single value (no multi-trial)

### 4.5 Gender Scoring Is Non-Negotiable

- Men: absolute benchmarks (4 tiers)
- Women: intra-squad percentile rank only — never compared against men's benchmarks
- This logic must be preserved across every feature that classifies athlete performance

### 4.6 SQL-First Data Correction

When correcting data, follow this sequence: diagnose with SELECT → DELETE incorrect rows → INSERT verified values. Never UPDATE in place for assessment data — it obscures the correction trail.

Note: `assessment_results` uses `test_id`, not `test_definition_id`.

---

## 5. Module Boundaries

AIS is a **modular monolith** — one deployment, cleanly separated modules. Each module owns its data layer. Modules may read from adjacent modules but must not write into them directly.

| Module | Owns | May Read From | Must Not Write To |
|---|---|---|---|
| **Assessments** | `test_definitions`, `benchmarks`, `assessment_sessions`, `assessment_results` | `athletes`, `teams`, `camps` | `periodisation_plans` |
| **Periodisation** | `periodisation_plans`, `plan_rows`, `plan_cells`, `plan_templates` | `athletes`, `teams`, `assessment_sessions`, `camps` | `assessment_results` |
| **Session Planner** | `sessions`, `session_content`, `session_library` | `periodisation_plans`, `athletes`, `teams` | `plan_cells` directly — must go through plan link |
| **Reports** | Reads only — generates output from existing data | All modules | Nothing — read-only module |
| **Athlete Roster** | `athletes`, `athlete_teams` | `teams`, `organisations` | `assessment_results` directly |
| **Admin Config** | `organisations`, `roles`, `role_permissions`, `groups`, `group_members` | All | Direct data tables (must use admin APIs) |

**Cross-module communication rule:** When Module A needs to trigger a change in Module B, it does so through a shared event or a defined link table — not by writing directly to Module B's tables.

---

## 6. RBAC Model

### 6.1 Schema (To Be Implemented Before Periodisation)

```sql
-- Named roles within an org (S&C Coach, Physio, Analyst, Admin)
roles (id, org_id, name, description)

-- What each role can do per feature
role_permissions (role_id, resource, action)
-- action enum: 'view' | 'edit' | 'admin'

-- Which role a user holds, scoped to which group
user_roles (user_id, role_id, group_id)

-- Groups as access scope containers
groups (id, org_id, name, description)
group_members (group_id, user_id, access_level)
```

### 6.2 Permission Hierarchy

```
admin  > edit > view
  3        2      1
```

`can('periodisation', 'edit')` returns true if the user has `edit` or `admin` on that resource.

### 6.3 Resource Names (Canonical List)

These are the exact strings used in `role_permissions.resource`. Do not invent alternatives.

```
assessments
periodisation
reports
sessionLibrary
athleteRoster
adminConfig
wellness
```

### 6.4 UI Gating Pattern

Every staff-facing action must be gated. Athlete-facing views are always read-only by default.

```js
// Show edit controls only if permitted
{can('periodisation', 'edit') && <PhaseEditor />}

// Admin-only controls
{can('sessionLibrary', 'admin') && <AddToLibraryButton />}
```

---

## 7. Tech Stack Constraints

These choices are fixed for V1 and V1.5. Deviations require an explicit architectural decision recorded in the Context document.

| Layer | Technology | Constraint |
|---|---|---|
| Frontend | React + Vite | No other framework. Component library: none mandated — use Tailwind + custom. |
| Backend / DB | Supabase PostgreSQL | No direct SQL mutations in components — always via Supabase client. |
| Auth | `src/lib/auth.js` stub → Supabase Auth (V2) | All identity flows through this file only. |
| PDF | jsPDF + html2canvas | No alternatives in V1. |
| Charts | Chart.js | Radar charts and load wave chart. No Recharts or D3 unless Chart.js is provably insufficient. |
| Hosting | Vercel | No change until V3 scaling needs arise. |
| Dev environment | Cursor IDE + Claude Code | Prompts must be tightly scoped — name the exact file to modify. |

### CSS Variables — Mandatory From Day One

All colors must reference CSS variables, never hardcoded hex values in component code. This makes the theme system a drop-in at V2.

```css
/* ✅ Correct */
color: var(--color-primary);
background: var(--color-surface);

/* ❌ Wrong */
color: #F97316;
background: #1C1C1E;
```

**Current design tokens:**
- Primary accent: `#F97316` (orange) → `--color-primary`
- Surface/background: `#1C1C1E` (charcoal) → `--color-surface`
- Classification: Red / Orange / Blue / Green → `--color-below-avg` / `--color-avg` / `--color-above-avg` / `--color-excellent`

---

## 8. Version Scope Gates

Features must not be built ahead of their V-stage. This prevents scope creep and keeps the current version shippable.

### V1 — Active
Scope: Single org (IIS), Kabaddi camp validation, assessment reporting

| In scope | Out of scope |
|---|---|
| Athlete roster + photos | Multi-org UI |
| Assessment entry + scoring | Auth / login system |
| PDF individual reports | RLS enforcement |
| Squad dashboard | Wellness / RPE tracking |
| Fixes: median percentile, radar, mailto | Periodisation canvas |

### V1.5 — Next (Periodisation)
Scope: Periodisation canvas, session planner, RBAC schema foundation

| In scope | Out of scope |
|---|---|
| RBAC schema tables (no UI yet) | Full admin config UI |
| Annual periodisation canvas | Athlete portal |
| Phase bands, row groups, cell types | Re-test tracking |
| Weekly drill-down | Wearable integrations |
| Session drawer + content library | Billing |
| Load wave chart | Mobile app |
| Session Planner (standalone) | |
| Bidirectional session ↔ plan link | |

### V2
Scope: Auth, RLS, athlete portal, wellness, theme system, admin config UI

### V3
Scope: Multi-org superuser, billing, mobile app, public API, wearables

**Rule:** If a feature is V2 or V3, it must not be partially implemented in V1 "to save time later." Partial implementations create technical debt and schema conflicts. The stub pattern (`src/lib/auth.js`) is the correct way to build V1 code that is V2-ready.

---

## 9. Pre-Development Checklist

Run through this before writing any code for a new feature or fix. A single "No" requires a design correction before proceeding.

```
DATA & QUERIES
□ Does every new Supabase query include .eq('org_id', user.orgId)?
□ Does every team-scoped query include .in('team_id', user.teamIds)?
□ Am I importing identity from src/lib/auth.js — with zero hardcoded IDs?
□ Does every new table have org_id as a non-nullable column?
□ Am I storing raw values and deriving visualisations — not storing derived state?

PERMISSIONS
□ Does this feature respect the four-layer user hierarchy?
□ Are UI controls gated behind can() checks?
□ Does athlete-facing code default to read-only?

SCORING & CLASSIFICATION
□ Does this change touch scoring.js? (It must not — scoring.js is frozen)
□ Is women's scoring using intra-squad percentile only?
□ Is sprint best-trial using all 4 splits from the single best total-time trial?

ARCHITECTURE
□ Does this feature belong to a single module? Is it writing only to that module's tables?
□ Are all colors referenced via CSS variables — not hardcoded hex?
□ Have I confirmed the V-stage of this feature?

MULTI-TENANCY
□ Does this work correctly if there are 10 orgs each with 20 teams?
□ Is there any path for an org to read another org's data?

REPORTS & PDF
□ Does this change break any existing PDF report output?
□ Does this change affect assessment data display — if so, has the median percentile logic been preserved?
```

---

## 10. Architecture Anti-Patterns — Never Do These

These are documented because they have either been considered or represent common failure modes for systems like AIS.

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Hardcoding org ID or user ID in a component | Breaks multi-tenancy, invisible in V1 | Always use `getCurrentUser()` from `src/lib/auth.js` |
| Fetching all rows then filtering in JS | Leaks other tenants' data if RLS fails | Always filter at query level with `.eq('org_id', ...)` |
| Storing classification labels (`'Excellent'`) as source of truth | Classifications change; raw values don't | Store the number; derive the label at render time |
| Building a builder layer for configuring tests or rows | Creates Smartabase complexity, destroys AIS's UX advantage | Use smart defaults; expose only the config that genuinely varies per org |
| Per-org code forks or separate deployments | Maintenance nightmare at scale | One codebase, multi-tenant data isolation |
| Writing to another module's tables directly | Tight coupling, breaks at refactor | Use shared link tables or events for cross-module writes |
| Using `UPDATE` for assessment data corrections | Obscures correction history | DELETE incorrect row → INSERT verified row |
| Modifying `scoring.js` to fix a display issue | Scoring engine is shared; changes have wide blast radius | Fix in the consuming component only |
| Hardcoding a sport-specific concept as a platform default | AIS is sport-agnostic | Make it org-configurable or put it in system defaults |

---

## 11. Update Protocol

This document is a constitution, not a changelog. It should change rarely and deliberately.

**Who can update it:** Ranjit Nahak (platform owner)  
**How to update it:** In a dedicated architecture thread — not as a side effect of a feature thread  
**What triggers an update:**
- A new V-stage is entered (e.g. moving from V1 to V1.5)
- A confirmed architectural decision that adds, removes, or modifies a rule
- A new anti-pattern discovered through development

**What does NOT update this document:**
- Bug fixes
- New features that follow existing rules
- Data corrections
- UI changes that don't touch architecture

**Version format:** Increment the version number in the header. Log the change in the Context document under a new "Architecture Decisions" entry.

---

*This document governs all AIS development. Read it before planning. Follow it during execution. Update it only with deliberate intent.*  
*AIS — Athlete Intelligence System · Architecture Guidelines v1.0 · Ranjit Nahak · April 2026*

## 12. Component Size & Refactoring Rules

### The 400-line rule
No single component file may exceed 400 lines without a documented reason.
When a component crosses 400 lines, it must be flagged for splitting at the
next available refactor window — not necessarily immediately, but before the
next feature is added to that component.

### What triggers a mandatory split
- A component owns more than two of: data fetching, UI state, interaction
  logic, rendering logic, child orchestration
- A component has more than 5 useEffect or useCallback hooks
- A new feature would add more than 50 lines to an already-large component

### How to split safely
1. Extract custom hooks first — all stateful logic (drag, resize, autosave,
   history) moves to `src/hooks/use[Feature].js` before any JSX is touched
2. Extract sub-components second — only after hooks are extracted and stable
3. Never split JSX and its handler in the same commit — extract the handler
   to a hook first, verify it works, then extract the JSX
4. Cursor prompts for splits must name every file being created and every
   prop being threaded — never say "refactor this component"

### Current known debt (April 2026)
- `PeriodisationCanvas.jsx` — 1,800+ lines. Split planned before 4Y zoom
  is added. Target: extract usePeriodisationResize, usePeriodisationDrag,
  PeriodisationToolbar, PeriodisationGrid, CellRenderer into separate files.

  ## 13. Error Handling & Observability Rules

### Every async operation must be wrapped
Every `await` call that touches Supabase must be inside a try/catch.
No exceptions. Silent failures are the hardest bugs to diagnose in production.

Pattern:
  try {
    await upsertCell({ ... });
  } catch (err) {
    console.error('[upsertCell] failed:', err);
    // surface to user — toast, inline message, or status indicator
  }

### User-visible failure signals
When an async operation fails, the user must see something. Acceptable patterns:
- Toast notification (preferred for saves and deletes)
- Inline status indicator changing to an error state
- Console.error with a prefixed label — minimum acceptable for V1

### Autosave failures specifically
If autosave fails, the Save button must reappear so the user can retry manually.
Never silently discard unsaved patches.

### Pre-Development Checklist additions (see Section 9)
Before writing any code involving async operations, confirm:
□ Every await is inside a try/catch
□ Failures surface visibly to the user or at minimum to the console with context
□ Autosave failure restores manual save capability

DUPLICATION CHECK
□ Does a screen or component already exist that shows this data?
□ If yes — extend it, don't recreate it.
□ New pages/tabs must serve a distinct purpose not covered by any existing page.
□ Settings is for configuration. Operational views (rosters, reports) stay in their own pages.