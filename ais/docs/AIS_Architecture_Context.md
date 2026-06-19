# Athlete Intelligence System (AIS) — Architecture & Context Document
**Version:** 3.0
**Last updated:** June 2026
**Author:** Ranjit Nahak, Strength & Conditioning Coach
**Purpose:** Single continuity document for picking up work across threads.
Read this at the start of every session alongside `AIS_Architecture_Guidelines.md`.

---

## Document Map

| File | Purpose | Update frequency |
|---|---|---|
| `AIS_Architecture_Guidelines.md` | **How** to build — Three Rules, RBAC patterns, anti-patterns, coding standards, Pre-Development Checklist | Rarely — architecture decisions only |
| `AIS_Architecture_Context.md` (this file) | **What** is built — current state, schema, active data, feature design, settings backlog, roadmap | Every thread |
| `AIS_Pending_Items.md` | **What** needs doing — bugs, open issues, V-stage tracking | Every thread |
| `SC_Pro_Architecture_v2.0.md` | S&C Pro product requirements — separate product, shared infrastructure. Full schema, feature modules, build status, active implementation plan reference | When S&C Pro requirements evolve |
| `SC_Pro_Auth_RBAC_Project_Plan.md` | Active S&C Pro implementation plan — milestones, Cursor prompts, tests for auth & RBAC build | Per S&C Pro sprint |
| `AIS_SncPro_Split_Plan.md` | Long-term platform infrastructure split roadmap — trigger conditions, 7-step sequence, pre-split checklist | When trigger conditions change |

> `AIS_Settings_Backlog.md` has been retired and merged into Section 9 of this document.
> `Three_rules` standalone file is superseded — Section 3 of `AIS_Architecture_Guidelines.md`
> is the authoritative source.
> `SC_Pro_Architecture_v1.0.docx` is superseded by `SC_Pro_Architecture_v2.0.md`.

---

## 1. Project Overview

AIS (Athlete Intelligence System) is a globally ambitious, sport-agnostic Athlete
Management System designed to compete with and surpass Smartabase and Teamworks.
Built in parallel with active coaching work serving JSW Sports (Haryana Steelers)
and AKFI (Asian Games kabaddi squads).

**Core philosophy:** Smart defaults + guided customisation. No builder layer.
Four interface layers (Superuser / Admin / Staff / Athlete) designed into the
schema from day one.

**Key differentiators:** Faster/cleaner UI, professional PDF output, minimal
clicks for data entry, sport-agnostic intelligence with configurable benchmarks
per org, full data ownership, purpose-built periodisation canvas with no equivalent
in Smartabase/Teamworks.

**Companion product:** S&C Pro — a separate strength and conditioning programming
platform sharing the same Supabase project, auth layer, and Platform Core tables.
See `SC_Pro_Architecture_v2.0.md` for full details.

**Report signatory:** `Ranjit Nahak` · `Strength and Conditioning Coach`
**Design language:** Kinetic Precision dark theme — background `#121317`,
accent `#F97316`, Inter font, tonal layering not shadows.
**Classification colours:** Red / Orange / Blue / Green →
Below Average / Average / Above Average / Excellent.

---

## 2. Tech Stack

| Layer | Technology | Detail |
|---|---|---|
| Frontend | React + Vite | Monorepo — `ais/` and `sc-pro/` under same repo root |
| Backend / DB | Supabase PostgreSQL | `cwyesqbxcczgbkkekhsc.supabase.co` |
| Auth | Supabase Auth | Real auth active — V2 milestone complete |
| RLS | Enabled on all tables | `get_current_org_id()` pattern. `rowsecurity=true` on all 52 tables |
| UI Design | Google Stitch | Mockups exported as `screen.png`, `code.html`, `DESIGN.md` to `ais/docs/stitch/` |
| Dev environment | Cursor IDE + Claude Code | `.cursorrules` at repo root points to all docs |
| PDF generation | jsPDF | Native drawing via `buildPeriodisationPDF.js`. No html2canvas. |
| Charts | Chart.js | Hex constants in dedicated constants file |
| Hosting | Vercel | Root dir: `ais/`. Framework: Vite. Output: `dist`. `vercel.json` rewrites for SPA routing |
| Domain | `app.athleteintelligencesystem.in` | Hostinger registrar. Supabase site URL + redirect URLs updated. |
| Email | Resend | Domain `athleteintelligencesystem.in` verified. Sender: `noreply@athleteintelligencesystem.in` |
| Rich text | Tiptap | — |
| AI features | Anthropic API | Direct browser access. `anthropic-dangerous-direct-browser-access: true`. `VITE_ANTHROPIC_API_KEY` |
| Monorepo root | `/Users/ranjit/Documents/GitHub/Athlete Intelligence System/` | `ais/` and `sc-pro/` as sibling folders |

---

## 3. Organisations & Teams

| Org | ID | Teams |
|---|---|---|
| Athlete Intelligence System (default/dev) | `a1000000-0000-0000-0000-000000000001` | — |
| AKFI | `a2000000-0000-0000-0000-000000000001` | Asian Games Men (`b2000000-...0001`, 27 athletes), Asian Games Women (`b2000000-...0002`, 32 athletes) |
| JSW Sports | `a3000000-0000-0000-0000-000000000001` | Haryana Steelers First Team (`b1000000-...0001`, 18 athletes), Academy (`56df726a-fe78-484e-8228-65c13ff5fc36`, 30 athletes) |

**Ranjit's auth:** UUID + `users.id` = `8d35bdc9-5339-4542-9457-adab00e871d3`. Role: `superuser`.

---

## 4. Database — Full Schema

### 4.1 Platform Core Tables (owned by neither AIS nor S&C Pro)

These tables are activated by either product. A standalone S&C Pro customer and a
standalone AIS customer both use these.

| Table | Purpose | Notes |
|---|---|---|
| `organisations` | Top-level org entity | `logo_url` (IIS) + `secondary_logo_url` (JSW). `theme_config` jsonb for org branding |
| `teams` | Teams within an org | — |
| `users` | Staff + athlete accounts | `auth_id` FK to `auth.users`. `org_id` non-nullable. `role` Postgres enum: `superuser, admin, sc_coach, physio, head_coach, analyst, manager, athlete` |
| `athletes` | Athlete profiles | Photo via `Athletes` storage bucket |
| `athlete_teams` | Many-to-many athletes ↔ teams | No `org_id` — scope via join |
| `groups` / `group_members` | Access scope containers | Between org and team level |
| `roles` | Role definitions per org | 9 roles × 3 orgs seeded |
| `role_permissions` | What each role can do per resource | `can_view`, `can_create`, `can_edit`, `can_delete`. Seeded for all 3 orgs. `sc_pro` resource included. |
| `user_roles` | User ↔ role assignment | Scoped to `org_id`. Some staff have duplicate rows (known, non-blocking) |
| `user_permission_overrides` | Per-user exceptions | On top of role defaults |
| `org_feature_flags` | Feature activation per org | `sc_pro`, `periodisation`, etc. Seeded for all 3 orgs |
| `sessions` | Shared join point | AIS writes shell (date, team, `plan_cell_id`). S&C Pro writes content. `plan_cell_id` nullable |
| `platform_events` | Cross-product event bus | **Not yet built** |
| `audit_log` | Action logging | No `org_id` — scope via join |

### 4.2 AIS-Owned Tables (S&C Pro reads select fields, never writes)

| Table | Purpose | Notes |
|---|---|---|
| `assessment_sessions` | A testing session (camp + date) | — |
| `assessment_results` | Individual athlete results per test | Uses `test_id` not `test_definition_id`. No `org_id` — scope via join |
| `test_definitions` | Test definition (name, unit, direction) | — |
| `benchmarks` | Classification thresholds per test per gender | — |
| `periodisation_plans` | Season plan container | `team_id` or `athlete_id` (null = team plan) |
| `plan_rows` | Rows within a plan | Scope via parent plan |
| `plan_cells` | Cell values within rows | Scope via parent plan |
| `plan_templates` | Reusable plan structures | — |
| `plan_week_notes` | Week-level notes | — |
| `wellness_logs` | Daily wellness questionnaires | JSONB. For wellness data only — not RPE |
| `wellness_form_items` | Wellness form configuration | — |
| `wellness_thresholds` | Alert thresholds per metric | — |
| `session_athlete_logs` | RPE session data | 1,509 rows from Teamworks import. `session_id` nullable. Slugs for `session_type`. `logged_at` at 18:00 IST |
| `dexa_scans` | DEXA scan records | Table exists, UI not built |
| `camps` | Camp records | — |
| `dashboard_layouts` | Widget layout config | No `org_id` — scope via join |
| `staff_observations` | Staff observation notes | — |
| `attendance_records` | Session attendance | — |
| `integration_configs` | Wearable/external integration config | — |
| `integration_athlete_mappings` | External ID ↔ athlete mappings | — |
| `wearable_metrics` | Wearable device data | — |

### 4.3 S&C Pro-Owned Tables (AIS reads select fields, never writes)

`programmes`, `programme_weeks`, `programme_sessions`, `programme_athletes`,
`programme_teams`, `session_blocks`, `session_exercises`, `exercise_library`,
`exercise_categories`, `exercise_tags`, `athlete_1rm`, `athlete_exercise_logs`,
`loading_schemes`, `session_library_items`

See `SC_Pro_Architecture_v2.0.md` Section 3 for full column definitions.

### 4.4 Tables Without `org_id` (require join-based scoping)

`assessment_results`, `athlete_teams`, `audit_log`, `dashboard_layouts`,
`exercise_tags`. `plan_rows` and `plan_cells` scope via parent `periodisation_plans`.

### 4.5 RLS Architecture

RLS is **enabled** on all tables. Pattern:

```sql
-- Core RLS function — resolves org from auth session
get_current_org_id()  →  SELECT org_id FROM users WHERE auth_id = auth.uid()

-- Supporting functions
is_platform_superuser()   →  checks users.role = 'superuser'
is_superuser()            →  alias for above

-- All policies follow:
USING (org_id = get_current_org_id())
-- or for tables without org_id:
USING (id IN (SELECT ... WHERE org_id = get_current_org_id()))
```

**V3 migration note:** At Supabase split time, RLS policies will change from
`get_current_org_id()` (which queries the users table) to JWT claims directly:
`(auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid`. See `AIS_SncPro_Split_Plan.md`.

---

## 5. Assessment Data — AKFI Camp

### 5.1 Active Camp
- Session: "S&C Camp — 28 Mar 2026" (`f1000000-0000-0000-0000-000000000001`)
- 63 total athlete profiles (~14 still without full profiles pending data)

### 5.2 Tests (IDs `c1000000-...0001` through `...0008`)

| Test | Unit | Direction |
|---|---|---|
| Sit & Reach | cm | Higher better |
| Seated Chest Medicine Ball Throw | m | Higher better |
| Standing Broad Jump | m | Higher better (converted from cm in source data) |
| Sprint — Split 1 (0–5m) | seconds | Lower better |
| Sprint — Split 2 (5–10m) | seconds | Lower better |
| Sprint — Split 3 (10–20m) | seconds | Lower better |
| Sprint — Total Time | seconds | Lower better |
| Yo-Yo IR1 | level | Higher better |

### 5.3 Scoring Logic

- **Men:** Absolute benchmarks, 4 tiers
- **Women:** Gender-filtered squad percentile rank only (no absolute benchmarks)
- **Engine:** `src/lib/scoring.js` — `classifyScore({value, gender, direction, benchmarks, squadValues})` → `{classification, percentileRank, method}`
- **`scoring.js` is frozen** — never modify. Changes target `AthleteReport.jsx` only.
- **Best-trial selection:** Highest value for Broad Jump / Sit & Reach / Chest Pass. Lowest total time for Sprint (all 4 splits from that single best-trial row). Single value for Yo-Yo.
- **Overall classification:** Median percentile rank across all tests. 76–100 = Excellent, 51–75 = Above Average, 26–50 = Average, 0–25 = Below Average.

---

## 6. RPE Data — Haryana Steelers

- 1,509 rows imported into `session_athlete_logs` from Teamworks CSV export
- `session_id` made nullable to support external source imports
- Added columns: `source`, `external_uuid`, `session_date`, `session_type`
- `session_type` stored as slugs (e.g. `conditioning` not `Conditioning Session`)
- `logged_at` reflects actual session date at 18:00 IST
- 37 athletes matched. Sachin Dahiya excluded by direction.
- Matching rule: `First Name + Last Name` concatenation — `Full Name` field in Teamworks export contains only surnames.

---

## 7. MVP Screens Built (AIS)

| Screen | Status | Notes |
|---|---|---|
| Athletes roster | ✅ Built | Add athlete modal with photo upload + crop |
| Reports — Individual | ✅ Built | PDF generation, mailto send |
| Reports — Team | ✅ Built | — |
| Reports — Observations | ✅ Built | — |
| Squad Dashboard | ✅ Built | Charts not rendering — known bug |
| Wellness Dashboard | ✅ Built | Card grid + dense table toggle |
| Periodisation Canvas | ✅ Built | Annual view. Weekly view. Known: touch events not wired (TD-01) |
| Log Tab — RPE Entry | ✅ Built | — |
| Log Tab — Wellness Entry | ✅ Built | — |
| Log Tab — Assessment | ✅ Built | — |
| Log Tab — Staff Notes | ✅ Built | — |
| Log Tab — Attendance | ✅ Built | — |
| Admin Panel | ✅ Built | — |
| Settings | ✅ Built (V1) | Full V2 design — see Section 9 |

### 7.1 Dashboard PDF Export (standard pattern)

Every staff-facing operational dashboard **must** expose **Export PDF**.

| Strategy | When to use | Components |
|---|---|---|
| **WYSIWYG** | Standard panel layouts, tables, cards | `DashboardExportButton` + `buildDashboardPDF` (html2canvas clone). Mark controls with `data-pdf-exclude`; optional filter snapshot with `data-pdf-export-only`. |
| **Native jsPDF** | Charts/tables need exact brand colours (no CSS var capture) | `build*PDF.js` orchestrator + pure drawer (e.g. `exportAssessmentPDF.js` → `buildAssessmentPDF.js`). Pass filtered data as arguments — no Supabase inside drawer. |

**UI convention:** Use `DashboardPanelHeader` with `exportSlot` (`ExportPdfButton` or `DashboardExportButton`), or place `ExportPdfButton` in the dashboard filter bar (Assessment pattern). Controls and mode toggles never appear in the exported record.

**Assessment Dashboard modes:** `individual` → athlete PDF; `squad` → team improvement charts; `matrix` → squad matrix table; `coverage` → coverage summary/matrix/athlete table.

---

## 8. Known Open Issues

| # | Issue | Impact | Status |
|---|---|---|---|
| 1 | Send Report mailto not pre-filling athlete email | `athlete.email` not reaching `AthleteReport` — debug with `console.log(athlete)` | Open |
| 2 | Flexibility radar axis collapse for some athletes | `getTierScore` case-insensitive fix applied — needs verification | Open |
| 3 | ~14 athletes without profiles | Narender, Rahul, Parvesh etc. — data pending | Open |
| 4 | Invite user flow not fully end-to-end verified | — | Open |
| 5 | S&C Pro returning `undefined` for `orgId` under real auth | Root cause: dev data under `a1000000`. Fixed once SC-AUTH milestones complete | Active |
| 6 | Assessment data not appearing in reports | Query structure issue | Open |
| 7 | PDF print showing browser URL/timestamp headers | Print CSS fix needed | Open |
| 8 | Squad Dashboard charts not rendering | Chart.js render issue | Open |
| 9 | Naveen Kumar cross-org anomaly | `athlete_teams` row linking AKFI profile to JSW Sports team | Open |
| 10 | S&C Pro dev data under wrong org | 12 programmes + 267 sessions under `a1000000`. Treat as dev data — start fresh under JSW Sports (`a3000000`) | Decision made |
| 11 | Duplicate `user_roles` rows | Several JSW staff have role assigned 2–3 times. Non-blocking. SC-AUTH-05 SQL ready. | Active |

---

## 9. Settings Architecture & Backlog

> This section absorbs the retired `AIS_Settings_Backlog.md`.
> Do not build Settings UI until V2. Log new items here as they are identified.
> At V2 kickoff this section becomes the implementation brief.

### 9.1 Architecture Decision — Three-Scope Settings Model

**Decision date:** April 2026 | **V-Stage:** Schema in V1.5 · UI in V2

| Scope | Who controls | Where stored |
|---|---|---|
| Org-level | Admin only | `organisations.theme_config` (jsonb, already in schema) |
| User-global | Each user | `user_preferences` table (`scope = 'global'`) |
| User-local (per page) | Each user | `user_preferences` table (`scope = 'featureName'`) |

User-global and user-local share one `user_preferences` table, separated by the
`scope` column. They are not separate tables.

### 9.2 `user_preferences` Schema

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

### 9.3 UI Pattern

- **Page-level settings:** Gear icon in top-right of each page toolbar. Slide-in
  panel. Saves immediately on change — no Save button. Shows only preferences
  scoped to that page.
- **Global settings page:** Two sections — "Appearance & Account" (global scope) +
  "Feature Defaults" (all local scopes grouped by feature). Aggregated view of all
  scopes — not a separate data store.

### 9.4 `preferences.js` Stub (V1.5)

Create `src/lib/preferences.js` alongside the `user_preferences` table migration.
Components import from it so V2 UI is a drop-in — only this file changes.

```js
// src/lib/preferences.js — V1.5 stub, returns hardcoded defaults
// Swap internals for real Supabase reads in V2. Only this file changes.

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

export const getPreference  = (scope, key) => DEFAULTS[scope]?.[key] ?? null
export const getAllPreferences = (scope)     => DEFAULTS[scope] ?? {}
```

### 9.5 Backlog — Org Level
> Stored in `organisations.theme_config`. Admin only.

| # | Setting | Description | Status |
|---|---|---|---|
| O-01 | Primary accent colour | Override platform orange with org brand colour | Backlog |
| O-02 | Org logo | Already implemented via `logo_url` + `secondary_logo_url` | ✅ Done |
| O-03 | Default sport | Pre-fills sport field when creating new teams | Backlog |

### 9.6 Backlog — User Global
> `scope = 'global'` in `user_preferences`

| # | Setting | Key | Values | Status |
|---|---|---|---|---|
| G-01 | Theme | `theme` | `dark` / `light` / `system` | Backlog |
| G-02 | Default team filter | `defaultTeamId` | team uuid | Backlog |

### 9.7 Backlog — User Local (Per Feature)
> `scope = 'featureName'` in `user_preferences`

**Periodisation (`scope = 'periodisation'`)**

| # | Setting | Key | Values |
|---|---|---|---|
| P-01 | Individual athlete override layer opacity | `canvasOpacity` | `0.0` – `1.0` |
| P-02 | Default zoom level on open | `defaultZoom` | `'4year'` / `'annual'` / `'monthly'` / `'weekly'` |
| P-03 | Load wave chart collapsed/expanded | `loadWaveExpanded` | `true` / `false` |
| P-04 | AR weeks highlight on/off | `highlightARWeeks` | `true` / `false` |

**Reports (`scope = 'reports'`)**

| # | Setting | Key | Values |
|---|---|---|---|
| R-01 | Default athlete list sort order | `sortOrder` | `'name'` / `'team'` / `'classification'` |
| R-02 | Pre-selected team filter | `defaultTeamFilter` | team uuid |

**Assessments (`scope = 'assessments'`)**

| # | Setting | Key | Values |
|---|---|---|---|
| A-01 | Default session filter | `defaultSessionId` | session uuid |
| A-02 | Column visibility | `visibleColumns` | array of column keys |

### 9.8 Athlete-Facing Content Visibility Rules

**Decision date:** April 2026 | **V-Stage:** V2

Coaching workflow states, load monitoring data, and internal planning indicators
must never be visible to athletes — in-app or in PDF exports.

**Elements hidden from athletes:**

| Element | Reason |
|---|---|
| "No individual plan" badge | Internal coaching workflow state |
| "Individual plan active" badge | Internal coaching workflow state |
| ACWR values | Load monitoring — can cause anxiety or gaming |
| Peaking index | Tactical — coach's internal periodisation language |
| Week notes | May contain selection, tactical, or medical commentary |
| Ghost/team plan layer | Coaching reference layer, not athlete-facing |
| Draft/unconfirmed cells | Only confirmed planned data shown to athletes |

**Gate pattern:** `can('periodisation', 'viewCoachingData')` on each sensitive element.

**PDF export:** Two modes via `recipientRole` parameter (`'coach'` | `'athlete'`).
Coach: full data including ghost layer, ACWR, peaking index, week notes.
Athlete: confirmed plan data only, no system states, no internal indicators.

### 9.9 Settings Implementation Rules

- `scoring.js` is frozen — settings must never attempt to modify scoring logic
- All `user_preferences` queries follow the Three Rules
- Settings store only raw preference values (opacity float, theme string, uuid) —
  never derived or calculated values

---

## 10. Periodisation Feature

### 10.1 Design Philosophy
Purpose-built planning canvas — not a calendar app, not a form builder.
Three things merged: Gantt chart structure + spreadsheet flexibility +
sports platform intelligence.

### 10.2 Three Zoom Levels

| Zoom | Column unit | Use |
|---|---|---|
| 4-Year | Quarter | Olympic cycle planning |
| Annual (1Y) | Week | Season architecture — primary view |
| 6-Month / Monthly | Day | Block planning |
| Weekly | Day (wide) | Session-level intent |

All zoom levels show the same data — different lens, same canvas.
Clicking a week in annual view zooms to weekly view.

### 10.3 Two Planning Axes
- **Team plan** — master plan for the squad, all athletes inherit
- **Individual athlete plan** — override layer shown on top as ghost/background.
  Visual diff shows divergence clearly.

### 10.4 Row Architecture

**System rows** (auto-generated): Month header, date row, calendar week, season week.

**Row groups** (collapsible, department-owned):

| Group | Department | Key rows |
|---|---|---|
| Planning | S&C | Phase band, Week focus / Phase goal, Peaking index |
| Events & Fixtures | All | Competition (A/B/C priority), Testing, Camp/Travel, Holidays |
| Physical Fitness | S&C | User-defined rows, Volume (1–10), Intensity (1–10), ACWR (auto), Planned/Actual load |
| Technical / Tactical | Technical | Primary focus, Secondary focus, Games format |
| Sports Science | Physio / Nutrition | Physio notes, Nutrition phase, Recovery modality |
| Psychology | Psychologist | User-defined |
| Analysis | Analyst | User-defined |

**Row types:** Band · Text · Color Paint · Number · Marker · Toggle

### 10.5 Key Concepts

**Peaking Index** — per-week countdown (7→1), colour-coded red to green.
7 = deep prep, 1 = at peak. Shared language across all departments.

**AR (Active Recovery)** — week-level state crossing all physical quality rows simultaneously.

**Volume + Intensity** — separate numeric rows (1–10 per week). Load wave auto-generates.

**Three-layer quantitative rows** — Goal / Planned / Actual.

**ACWR** — Acute ÷ Chronic. Green (0.8–1.3) / Yellow (1.3–1.5) / Red (>1.5).
EWMA formula: λ = 2/(N+1). Acute window = 7d, chronic = 28d.
Only meaningful from W5 onward. W1 always returns 1.00.
Current `computeAcwrSeries` uses `(Volume + Intensity) / 2` per week.

**Monotony** = weekly average daily load ÷ SD of daily loads.
**Strain** = weekly load × monotony.

### 10.6 Weekly Drill-Down View
- Columns = days (Mon–Sun), sessions stacked by time per day
- Each session: time, venue, category, content list, RPE, planned/actual duration, recovery, notes
- AM/PM blocks visually separated. Screening/Tests row. Recovery Modality row.

**Right summary panel:** Week number + date range, phase name, week focus,
Volume Goal/Planned/Actual, Avg RPE Planned/Actual, ACWR visual bar, peaking index.

### 10.7 Session Library — Three Tiers
1. System defaults (AIS-provided) — Mobility Work, Core Training, Aerobic Endurance etc.
2. Org library (Admin-created) — Kabaddi Specific Warm Up, MAS Runs etc.
3. Use once (any staff, not saved) — one-off entries

### 10.8 Load Wave Chart
- Below grid, spatially aligned with week columns
- Blue = Volume, Red = Intensity, Green dashed = ACWR
- Auto-generated from numeric cell values
- Collapsible, scrolls in sync with grid
- EWMA / Rolling Average toggle = global control (recalculates all stat cards,
  charts, squad table simultaneously)

### 10.9 DEXA Scans (V2)
- `dexa_scans` table exists
- Animated AI PDF extraction planned for Log tab (fifth tab)
- DEXA Reports as fourth tab in Reports module
- Not yet built

### 10.10 Periodisation Database Schema

```sql
periodisation_plans
  id, org_id, team_id, athlete_id (null = team plan),
  name, start_date, end_date, template_name, created_by

plan_rows
  id, plan_id, org_id, group_name, row_type, label,
  color, sort_order, is_visible, department_owner

plan_cells
  id, row_id, date, value (text/color/number),
  span_end_date (for merged cells)

plan_templates
  id, org_id, name, sport_type,
  rows (JSON array of row definitions)
```

---

## 11. Platform Architecture — AIS + S&C Pro

### 11.1 Two Products, One Backend

```
Athlete Intelligence System/          ← monorepo root
├── ais/                              ← AIS frontend (React + Vite)
├── sc-pro/                           ← S&C Pro frontend (React + Vite)
└── shared Supabase project           ← cwyesqbxcczgbkkekhsc
    ├── Platform Core tables
    ├── AIS-owned tables
    └── S&C Pro-owned tables
```

**One Supabase project. One auth system. One JWT. Two frontends.**
No API layer between products. Both query Platform Core tables directly.
RLS enforces org isolation identically for both.

### 11.2 Operating Modes

```
Mode A — AIS Standalone
  org_feature_flags: periodisation=true, sc_pro=false
  S&C Pro links: hidden. S&C Pro tables: never queried.

Mode B — S&C Pro Standalone
  org_feature_flags: sc_pro=true, periodisation=false
  AIS links in S&C Pro: hidden. plan_cell_id always null on sessions.

Mode C — Bundle (both active)
  org_feature_flags: sc_pro=true, periodisation=true
  All integration features unlock. isBundleActive() returns true.
  platform_events: both products emit and consume.
```

`org_feature_flags` is the **sole** mechanism for detecting which products are
active. Every bundle integration feature gated behind `isBundleActive()`.
Never hardcode bundle detection.

### 11.3 Cross-Product Communication

**Reads:** Both products read Platform Core tables directly — no API.

**Writes:** Neither product writes to the other's owned tables. Cross-product
writes only via `platform_events` table (not yet built).

**Integration features** (bundle only):

| Event | From | To | Effect |
|---|---|---|---|
| `session_completed` | S&C Pro | AIS | Updates Actual load in load wave |
| `session_rpe_logged` | S&C Pro | AIS | Updates Actual RPE in weekly view |
| `retest_result_added` | AIS | S&C Pro | Flags 1RM profile for review |
| `taper_week_set` | AIS | S&C Pro | Flags sessions for volume reduction |
| `acwr_threshold_exceeded` | AIS | S&C Pro | Surfaces readiness warning (V2) |
| `programme_session_created` | S&C Pro | AIS | Session appears in AIS weekly view |

### 11.4 Long-Term Split Roadmap

The platform may split into separate Supabase projects at V3 if trigger conditions
are met. Full 7-step sequence, pre-split checklist, and estimated 10-day effort
documented in `AIS_SncPro_Split_Plan.md`. Do not begin split work without reading
that document and completing the pre-split checklist.

---

## 12. External Integrations

### 12.1 Catapult
- API access and docs in hand
- Three-layer adapter model: integration config → Edge Function sync → internal table reads
- Normalisation spec must be written before any code is written
- V2 timeline

### 12.2 Vald
- Similar adapter pattern to Catapult
- Lower complexity
- V2 timeline

### 12.3 Teamworks
- Competitor product and UI reference/inspiration
- 1,509 RPE rows already imported from Teamworks CSV export

---

## 13. Architecture Decisions — Multi-Org Scalability

### 13.1 Five-Layer Hierarchy

```
ORGANISATIONS
    └── GROUPS (teams, departments, cohorts)
            └── USERS (staff + athletes)
                    └── ROLES (what they can do)
                            └── RESOURCE PERMISSIONS
                                    (per feature: view/create/edit/delete)
```

### 13.2 Four User Layers

| Layer | Who | Access |
|---|---|---|
| Superuser | Platform / Ranjit | All orgs, all data, billing |
| Admin | Org administrator | Full org, manages roles and groups |
| Staff | Coaches, physio, nutrition, analysts | Role-based, group-scoped |
| Athlete | Athletes | Own data only, read-mostly |

### 13.3 RBAC Pattern

**Permission check in components:** `canSync(user, resource, action)` — synchronous,
user object already loaded from context.

**Permission check in async lib functions:** `can(resource, action)` — async,
resolves user internally.

**Resource strings (canonical):** `adminConfig`, `assessments`, `athlete_portal`,
`athleteRoster`, `injury_surveillance`, `periodisation`, `reports`, `rpe_logging`,
`sc_pro`, `sessionLibrary`, `staff_notes`, `unified_reports`, `wellness`.

### 13.4 CSS Variable Theme System

Three layers:
1. Org-level brand kit (Admin sets) — primary accent, secondary colour, logo
2. User-level preference — Dark / Light / System
3. Page-level override — periodisation canvas defaults to Light

Implementation: `data-theme` attribute swap on `<html>`. All colours via CSS
variables — zero hardcoded hex in components. Theme system is a drop-in
if built with variables from day one.

---

## 14. Feature Roadmap

### AIS V1 — Complete
- ✅ Athlete roster with photo management
- ✅ Assessment data entry + scoring engine
- ✅ PDF reports (individual, team, observations)
- ✅ Squad Dashboard
- ✅ Wellness Dashboard
- ✅ Periodisation canvas + weekly view
- ✅ Log Tab (RPE, Wellness, Assessment, Staff Notes, Attendance)
- ✅ Admin Panel
- ✅ Real auth + RLS

### AIS V2 — Next
- Wellness / RPE dashboards (ACWR via EWMA, monotony, strain)
- Session management (Google Calendar-style click-to-create)
- Load monitoring dashboard with EWMA/Rolling Average toggle
- DEXA scan upload + AI extraction + Reports tab
- Athlete portal
- Re-test tracking
- Admin config UI
- `user_preferences` table + Settings V2 UI (see Section 9)
- PWA support, mobile bottom nav
- Catapult integration
- Vald integration

### AIS V3
- Multi-org superuser
- Billing
- Mobile app store distribution
- Public API
- Platform split evaluation (see `AIS_SncPro_Split_Plan.md`)

### S&C Pro V1 — Active Build
See `SC_Pro_Architecture_v2.0.md` for full build status.
Active work: `SC_Pro_Auth_RBAC_Project_Plan.md` (SC-AUTH-01 through SC-AUTH-05).

### S&C Pro V2
- Readiness layer (wellness + CMJ + HRV/Whoop)
- Composite readiness score
- Load auto-adjustment suggestions
- Strava/GPS conditioning import

### S&C Pro V3
- VBT device integration
- Velocity-based load auto-regulation
- AI-assisted programme generation
- Mobile app (touch-optimised logging)

---

## 15. Key Principles & Learnings

**Architecture**
- No builder layer — complexity via smart defaults, not user-facing config UIs
- Data-first — raw numbers stored; visualisations derive from them
- CSS variables from day one — theme system is a drop-in later
- `scoring.js` is frozen — never modify; changes target `AthleteReport.jsx` only
- `users.id` is FK to `auth.users(id)` — user creation via `invite-user` Edge Function,
  not direct inserts
- The `invite-user` Edge Function handles `email_exists` by falling back to `generateLink`
- Anti-duplication check: before building any new component or table, confirm it
  doesn't already exist elsewhere in the codebase

**Data**
- Overall classification = median percentile rank across all tests
- Women's scores = intra-squad percentile only — never against men's benchmarks
- Sprint best-trial = all 4 splits from single best total-time trial
- Broad Jump values in Excel = cm — convert to meters before insertion
- Assessment results table uses `test_id` not `test_definition_id`
- Partial unique index for nullable dedup columns:
  `CREATE UNIQUE INDEX IF NOT EXISTS idx ON table (col) WHERE col IS NOT NULL`
- When matching from Teamworks exports: use `First Name + Last Name` —
  the `Full Name` field contains only surnames
- `wellness_logs` for daily wellness questionnaires (JSONB)
- RPE data belongs in `session_athlete_logs` not `wellness_logs`

**S&C Pro specific**
- S&C Pro never writes to AIS-owned tables — only via `platform_events`
- AIS never writes to S&C Pro-owned tables — only via `platform_events`
- `exercise_categories` uses fixed UUIDs: `ec000001-...` for regions,
  `ec000002-...` for patterns
- TD-01: periodisation canvas uses mouse events, not touch — must resolve
  before any mobile path for S&C Pro

**Supabase MCP**
- Verify org ID before any join query
- Run verification queries individually (only last result set returned)
- `information_schema.columns WHERE table_name = 'x' ORDER BY ordinal_position`
  reliably returns column structure

**Tooling**
- Claude.ai: architecture decisions, SQL review, planning
- Claude Code: multi-file orchestration, compliance sweeps
- Cursor: React/JSX UI work
- Prompt pattern: single execution covering all related issues, verify in browser,
  commit with one-line statement
- Bug protocol: capture all bugs before fixing; log mid-milestone issues rather
  than chasing immediately

---

## 16. Open Questions

1. Should Volume in the periodisation canvas derive automatically from training
   rows (sum of planned hours) or be a separate manual input?
2. Phase library — pre-built templates or always created from scratch?
3. History and re-use — should last year's plan be preserved as a template?
4. Default zoom when opening Periodisation tab — current week in monthly, or
   full season annual view?
5. Who can create individual athlete plan overrides — only S&C coach, or physio too?
6. ACWR toggle (EWMA vs Rolling Average) — global control confirmed — but should
   the default be EWMA or Rolling Average for first-time users?
7. `platform_events` table: polling interval vs Supabase Realtime subscription?
   Decision needed before building the event bus.

---

*Athlete Intelligence System · Architecture & Context Document v3.0 · June 2026*
*Ranjit Nahak · Strength & Conditioning Coach*
*Read this alongside `AIS_Architecture_Guidelines.md` at the start of every session.*
*Next session: run Pre-Development Checklist (Section 9 of Guidelines) before writing any code.*
