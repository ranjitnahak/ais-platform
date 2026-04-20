# AIS — Settings Architecture & Backlog
**Version:** 1.0
**Created:** April 2026
**Author:** Ranjit Nahak, Strength & Conditioning Coach
**V-Stage:** Schema in V1.5 · UI in V2

> This document logs all decisions, design intent, and backlog items related to the AIS Settings system.
> Add to this document whenever a preference or configurable behaviour is identified during development.
> Do not build the Settings UI ahead of V2 — log items here instead.

---

## 1. Architecture Decision — Two-Level Settings Model

**Decision date:** April 2026
**Status:** Decided — pending implementation

### The Three Real Scopes

| Scope | Who controls | Where stored | When built |
|---|---|---|---|
| **Org-level** | Admin only | `organisations.theme_config` (already in schema) | V2 Admin Config UI |
| **User-global** | Each user | `user_preferences` table (`scope = 'global'`) | V2 |
| **User-local (per page)** | Each user | `user_preferences` table (`scope = 'featureName'`) | V2 |

User-global and user-local are **not separate tables** — they share one `user_preferences` table, separated by the `scope` column.

### Database Schema

```sql
CREATE TABLE user_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  org_id      uuid NOT NULL REFERENCES organisations(id),
  scope       text NOT NULL,   -- 'global' | 'periodisation' | 'reports' | 'assessments'
  key         text NOT NULL,   -- e.g. 'theme', 'canvasOpacity', 'defaultTeamFilter'
  value       jsonb NOT NULL,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, scope, key)
);
```

### UI Pattern

- **Page-level (local) settings:** Gear icon in top-right of each page toolbar. Opens a slide-in panel or popover. Saves immediately on change — no Save button. Shows only preferences scoped to that page.
- **Global settings page:** Accessible from sidebar. Two sections: "Appearance & Account" (global scope) + "Feature Defaults" (all local scopes grouped by feature). One place for power users to configure everything.
- The global settings page is an **aggregated view** of all scopes — not a separate data store.

---

## 2. Settings Backlog — Org Level

> Stored in `organisations.theme_config`. Managed by Admin only.

| # | Setting | Description | Status |
|---|---|---|---|
| O-01 | Primary accent color | Override platform orange `#F97316` with org brand color | Backlog |
| O-02 | Org logo | Already implemented via `logo_url` + `secondary_logo_url` | Done |
| O-03 | Default sport | Pre-fills sport field when creating new teams | Backlog |

---

## 3. Settings Backlog — User Global

> `scope = 'global'` in `user_preferences`.

| # | Setting | Key | Values | Status |
|---|---|---|---|---|
| G-01 | Theme | `theme` | `dark` / `light` / `system` | Backlog |
| G-02 | Default team filter | `defaultTeamId` | team uuid | Backlog |

---

## 4. Settings Backlog — User Local (Per Feature)

> `scope = 'featureName'` in `user_preferences`.

### 4.1 Periodisation (`scope = 'periodisation'`)

| # | Setting | Key | Values | Identified in |
|---|---|---|---|---|
| P-01 | Individual athlete override layer opacity | `canvasOpacity` | `0.0` – `1.0` | April 2026 thread |
| P-02 | Default zoom level on open | `defaultZoom` | `'4year'` / `'annual'` / `'monthly'` / `'weekly'` | Backlog |
| P-03 | Load wave chart collapsed/expanded | `loadWaveExpanded` | `true` / `false` | Backlog |
| P-04 | AR weeks highlight on/off | `highlightARWeeks` | `true` / `false` | Backlog |

### 4.2 Reports (`scope = 'reports'`)

| # | Setting | Key | Values | Identified in |
|---|---|---|---|---|
| R-01 | Default athlete list sort order | `sortOrder` | `'name'` / `'team'` / `'classification'` | Backlog |
| R-02 | Pre-selected team filter | `defaultTeamFilter` | team uuid | Backlog |

### 4.3 Assessments (`scope = 'assessments'`)

| # | Setting | Key | Values | Identified in |
|---|---|---|---|---|
| A-01 | Default session filter | `defaultSessionId` | session uuid | Backlog |
| A-02 | Column visibility | `visibleColumns` | array of column keys | Backlog |

---

## 5. Implementation Notes

- `scoring.js` is frozen — no settings should attempt to modify scoring logic. Settings are display and UX preferences only.
- All settings queries must follow the Three Rules: `org_id` always passed, `currentUser` from `src/lib/auth.js`, no show-everything queries.
- A `src/lib/preferences.js` stub should be created alongside the `user_preferences` table in V1.5 schema migration — parallel to `src/lib/auth.js`. Components import from it so V2 UI is a drop-in.
- Settings must never store derived/calculated values — only raw preference values (opacity float, theme string, etc.).

### Suggested `src/lib/preferences.js` Stub (V1.5)

```js
// src/lib/preferences.js
// Stub for V1/V1.5 — returns hardcoded defaults
// Swap internals for real Supabase reads in V2
// Only this file changes when settings UI is implemented.

const DEFAULTS = {
  global: {
    theme: 'dark',
    defaultTeamId: null,
  },
  periodisation: {
    canvasOpacity: 0.4,
    defaultZoom: 'annual',
    loadWaveExpanded: true,
    highlightARWeeks: true,
  },
  reports: {
    sortOrder: 'name',
    defaultTeamFilter: null,
  },
  assessments: {
    defaultSessionId: null,
    visibleColumns: ['name', 'gender', 'age', 'classification'],
  },
}

export const getPreference = (scope, key) => {
  return DEFAULTS[scope]?.[key] ?? null
}

export const getAllPreferences = (scope) => {
  return DEFAULTS[scope] ?? {}
}
```

Athlete-Facing View — Content Visibility Rules

**Decision date:** April 2026
**Status:** Decided — pending V2 implementation
**V-Stage:** V2 (Athlete Portal + PDF export)

### Principle
Coaching workflow states, load monitoring data, and internal planning
indicators must never be visible to athletes — in-app or in PDF exports.
The athlete view is always clean, confident, and action-oriented.

### Elements hidden from athletes

| Element | Reason |
|---|---|
| "No individual plan" badge | Internal coaching workflow state |
| "Individual plan active" badge | Internal coaching workflow state |
| ACWR values | Load monitoring tool — can cause anxiety or gaming |
| Peaking index | Tactical — coach's internal periodisation language |
| Week notes | May contain selection, tactical, or medical commentary |
| Ghost/team plan layer | Coaching reference layer, not athlete-facing |
| Draft/unconfirmed cells | Only confirmed planned data shown to athletes |

### Implementation pattern

Gate each sensitive element with a permission check:
  can('periodisation', 'viewCoachingData')

Staff role → permission granted → sees everything
Athlete role → permission denied → element hidden

### PDF export

Two export modes, controlled by a recipientRole parameter:
- Coach export: full data including ghost layer, ACWR, peaking
  index, week notes, planning badges
- Athlete export: confirmed plan data only, clean layout,
  no system states, no internal indicators

The PDF export function receives recipientRole ('coach' | 'athlete')
and filters content accordingly before rendering.

### Scope
- In-app athlete portal (V2): athlete role never sees coach mode canvas
- PDF export (V1.5/V2): recipientRole parameter on export function
- auth.js: add 'viewCoachingData' permission to Staff role,
  omit from Athlete role

---

## 6. How to Use This Document

- **During development:** When you identify a preference that should be user-configurable, add a row to the appropriate section above. Note the feature/thread where it was identified.
- **Do not build** the Settings UI until V2 is entered. Use the `preferences.js` stub and hardcoded defaults in V1.5.
- **At V2 kickoff:** This document becomes the implementation brief for the Settings module.

---

*AIS — Athlete Intelligence System · Settings Backlog v1.0 · Ranjit Nahak · April 2026*
