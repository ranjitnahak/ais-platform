# AIS — Sprint Milestone Document
**Sprint window:** 28 May 2026 onwards
**Author:** Ranjit Nahak, Strength & Conditioning Coach
**Status:** Active — Living Document
**Last updated:** 28 May 2026
**Preceding sprint:** AIS_Sprint_Milestones_27_29_May.md (auth, RLS, RBAC, wellness, RPE — completed)

---

## How to Use This Document

**For Claude Code:** Read this document at the start of every session. Check off
milestones as they complete. Add blockers if encountered. Never skip a GATE
milestone — they are verification checkpoints, not optional steps.

**For Cursor:** Read the relevant sprint section before starting any task.
Each milestone specifies the exact files to touch. Do not modify files outside
the scope of the active milestone.

**For Claude.ai:** This document is the orchestration reference. All SQL is
reviewed in Claude.ai before execution. All architecture decisions are recorded
here.

**The Three Rules — enforced on every line of code written:**
1. Every Supabase query includes `.eq('org_id', user.orgId)`
2. Identity always from `src/lib/auth.js` — zero hardcoded IDs anywhere
3. Every team-scoped query includes `.in('team_id', user.teamIds)`

**Architecture docs to read before any session:**
- `ais/docs/AIS_Architecture_Guidelines.md` — how everything must be built
- `ais/docs/AIS_Architecture_Context.md` — what is currently built
- `ais/docs/AIS_Pending_Items.md` — outstanding items and known debt

---

## Status Legend

```
⬜ Not started
🔄 In progress
✅ Complete
🚫 Blocked — see blocker note
⚠️  Needs review before proceeding
```

---

## Sprint 0 — User Management (In Progress)
**Assign to:** Cursor
**Status:** 🔄 In progress
**Depends on:** Schema confirmed (user_permission_overrides + deactivated_at ✅)

### Milestones

| # | Item | File(s) | Status |
|---|------|---------|--------|
| S0-01 | New AddUserModal — two paths: Athlete + Staff | `src/components/admin/AddUserModal.jsx` | ⬜ |
| S0-02 | useAddUser hook — all data logic extracted | `src/hooks/useAddUser.js` | ⬜ |
| S0-03 | Admin.jsx — replace Invite User with Add User, clickable rows, three-dot menu | `src/pages/Admin.jsx` | ⬜ |
| S0-04 | UserDetailPage — /admin/users/:userId route, Profile + Permissions tabs | `src/pages/UserDetailPage.jsx` | ⬜ |
| S0-05 | useUserPermissions hook — role defaults + override resolution | `src/hooks/useUserPermissions.js` | ⬜ |
| S0-06 | UserPermissionsGrid — three-state checkboxes, autosave, reset | `src/components/admin/UserPermissionsGrid.jsx` (new) | ⬜ |
| S0-07 | auth.js — can() and canSync() check user_permission_overrides first | `src/lib/auth.js` | ⬜ |
| S0-08 | Athletes.jsx — remove Add Athlete button | `src/pages/Athletes.jsx` | ⬜ |
| S0-09 | is_active sweep — add .eq('is_active', true) to 5 operational files | Multiple | ⬜ |
| S0-10 | App.jsx — add /admin/users/:userId route | `src/App.jsx` | ⬜ |

### GATE S0 — Verification checklist
Before closing Sprint 0:
- [ ] Add User → Staff path → invite email arrives
- [ ] Add User → Athlete path → athlete appears in Athletes page under correct team
- [ ] Click user row → UserDetailPage loads at /admin/users/:userId
- [ ] Permissions tab → inherited state shows correctly from role defaults
- [ ] Toggle one override → orange checkbox appears, saved indicator fires
- [ ] Reset to role defaults → returns to grey inherited state
- [ ] Deactivate a user → disappears from Athletes page and Wellness dashboard
- [ ] Deactivated user still visible in Admin Users tab
- [ ] Delete blocked when user has existing data — correct warning shown
- [ ] No Add Athlete button on Athletes page

---

## Sprint 1 — Navigation Restructure
**Assign to:** Cursor
**Estimated time:** 1 day
**Depends on:** Sprint 0 GATE passed
**Schema changes:** None

### Goal
Simplify the sidebar to 7 items. Move all system-config out of Settings into
Admin. Move all dashboards under a single Dashboard tab. Create the Log tab
for all data entry.

### New sidebar structure
```
Dashboard      (tab bar inside: Wellness | RPE | + future tabs)
Athletes       (roster only — unchanged)
Periodisation  (unchanged)
Log            (data entry: RPE logging | wellness submission | staff notes)
Reports        (PDF reports — unchanged)
Admin          (absorbs Teams + Roles from Settings)
Settings       (personal only: theme, view preferences)
```

### Milestones

| # | Item | File(s) | Status |
|---|------|---------|--------|
| S1-01 | Sidebar — update to 7-item structure with new icons | `src/components/layout/Sidebar.jsx` | ⬜ |
| S1-02 | Dashboard page shell — tab bar: Wellness \| RPE \| (placeholder tabs) | `src/pages/Dashboard.jsx` | ⬜ |
| S1-03 | Move WellnessDashboard into Dashboard → Wellness tab | `src/pages/Dashboard.jsx` | ⬜ |
| S1-04 | Move RPE view into Dashboard → RPE tab | `src/pages/Dashboard.jsx` | ⬜ |
| S1-05 | Log page — tab bar: RPE Entry \| Wellness Entry \| Staff Notes | `src/pages/Log.jsx` (new) | ⬜ |
| S1-06 | Move AthleteHome RPE + Wellness forms into Log page tabs | `src/pages/Log.jsx` | ⬜ |
| S1-07 | Move StaffNotes into Log → Staff Notes tab | `src/pages/Log.jsx` | ⬜ |
| S1-08 | Admin — absorb Teams section from Settings | `src/pages/Admin.jsx` | ⬜ |
| S1-09 | Admin — absorb Roles section from Settings | `src/pages/Admin.jsx` | ⬜ |
| S1-10 | Settings page — strip to personal preferences only (theme toggle placeholder, view prefs placeholder) | `src/pages/Settings.jsx` | ⬜ |
| S1-11 | Fix sidebar disappearing on Wellness/Dashboard pages | `src/components/layout/` | ⬜ |
| S1-12 | Update all internal navigation links and routes in App.jsx | `src/App.jsx` | ⬜ |

### GATE S1
- [ ] Sidebar shows exactly 7 items
- [ ] Dashboard tab → Wellness tab shows wellness dashboard
- [ ] Dashboard tab → RPE tab shows RPE view
- [ ] Log tab → three sub-tabs all functional
- [ ] Admin → Teams tab works (create team, view teams)
- [ ] Admin → Roles tab works
- [ ] Settings page is personal-only (no team or role config)
- [ ] Sidebar visible on all pages including Dashboard tabs
- [ ] No broken routes

---

## Sprint 2 — Body Map Component
**Assign to:** Cursor (React component) + Claude.ai (region taxonomy review)
**Estimated time:** 2 days
**Depends on:** Sprint 1 GATE passed
**Schema changes:** None (stores as JSONB array in existing wellness_logs.responses)

### Goal
Build a reusable interactive body map component for soreness selection.
Used in: wellness form (athlete), injury data entry (Sprint 6).

### Body region taxonomy — confirmed list

**Front view (28 regions):**
Right Head, Left Head,
Right Shoulder, Left Shoulder,
Right Chest, Left Chest,
Right Upper Arm, Left Upper Arm,
Right Elbow, Left Elbow,
Right Abdomen, Left Abdomen,
Right Forearm, Left Forearm,
Right Wrist, Left Wrist,
Right Hip and Groin, Left Hip and Groin,
Right Thigh, Left Thigh,
Right Knee, Left Knee,
Right Lower Leg, Left Lower Leg,
Right Ankle, Left Ankle,
Right Foot, Left Foot

**Back view (22 regions):**
Left Posterior Head, Right Posterior Head,
Left Neck, Right Neck,
Left Posterior Shoulder, Right Posterior Shoulder,
Left Thoracic Spine, Right Thoracic Spine,
Left Posterior Trunk, Right Posterior Trunk,
Left Buttock and Pelvis, Right Buttock and Pelvis,
Left Posterior Elbow, Right Posterior Elbow,
Left Posterior Hand, Right Posterior Hand,
Left Posterior Knee, Right Posterior Knee,
Left Posterior Ankle, Right Posterior Ankle,
Left Posterior Foot, Right Posterior Foot

**Total: 50 named regions**

### Milestones

| # | Item | File(s) | Status |
|---|------|---------|--------|
| S2-01 | BodyMapSelector.jsx — SVG front + back figure, 50 named hit zones, tap to select/deselect | `src/components/shared/BodyMapSelector.jsx` (new) | ⬜ |
| S2-02 | Selected regions highlight red, unselected neutral | `src/components/shared/BodyMapSelector.jsx` | ⬜ |
| S2-03 | Component API: value (string[]), onChange (string[]) — controlled component pattern | `src/components/shared/BodyMapSelector.jsx` | ⬜ |
| S2-04 | Selected region labels listed below the diagram | `src/components/shared/BodyMapSelector.jsx` | ⬜ |
| S2-05 | Integrate into athlete wellness form — replaces soreness_areas text field | `src/pages/Log.jsx` (wellness tab) | ⬜ |
| S2-06 | Wellness data stored as JSON array: `["Right Knee", "Left Thigh"]` in responses JSONB | `src/hooks/useWellness.js` | ⬜ |
| S2-07 | Coach Wellness dashboard — show selected body regions per athlete as tag chips | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |
| S2-08 | Mobile-optimised: touch targets minimum 44×44px, diagram scales to screen width | `src/components/shared/BodyMapSelector.jsx` | ⬜ |

### GATE S2
- [ ] Athlete can tap front and back regions on wellness form
- [ ] Selected regions highlight correctly
- [ ] Deselect works on second tap
- [ ] Saved regions appear in coach wellness view as tags
- [ ] Component works on mobile (touch, scaling)
- [ ] Component is importable standalone — no wellness-specific logic inside it

---

## Sprint 3 — Wellness Dashboard Redesign
**Assign to:** Cursor
**Estimated time:** 2 days
**Depends on:** Sprint 2 GATE passed
**Schema changes:** None

### Goal
Replace current card-grid wellness dashboard with Teamworks-style data table.
Information-dense, colour-coded, filterable. Configurable in Sprint 5.

### Target layout
```
[Date selector] [Team filter] [Athlete filter]        [Squad | Individual toggle]

SQUAD VIEW — data table
Athlete | Availability | Fatigue | Sleep Quality | Sleep Hours | Training Motivation |
Perf Satisfaction | Perf Yesterday | Gut Health | Soreness | Sore Areas | Comments

Colour coding per cell:
  Score 1-3  → red background
  Score 4-5  → amber background
  Score 6-7  → no highlight (neutral)
  Score 8-10 → green background (good)

Summary row at bottom: squad averages per column

INDIVIDUAL VIEW (on athlete row click)
  7-day trend chart per metric (line chart, Chart.js)
  Body map showing selected sore areas
```

### Milestones

| # | Item | File(s) | Status |
|---|------|---------|--------|
| S3-01 | WellnessDashboard — replace card grid with data table | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |
| S3-02 | Date selector (default: today), team filter, athlete filter | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |
| S3-03 | Cell colour coding: red/amber/neutral/green thresholds | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |
| S3-04 | Squad averages row at table bottom | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |
| S3-05 | Squad \| Individual toggle | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |
| S3-06 | Individual view — athlete row click → 7-day trend per metric (Chart.js line chart) | `src/components/wellness/WellnessAthleteDetail.jsx` (new) | ⬜ |
| S3-07 | Individual view — body map showing sore areas (uses BodyMapSelector in read-only mode) | `src/components/wellness/WellnessAthleteDetail.jsx` | ⬜ |
| S3-08 | Submitted today counter — "X of Y submitted" with % bar | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |
| S3-09 | Flag row: any metric ≤ 3 highlights entire athlete row with left orange border | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |
| S3-10 | Responsive: horizontal scroll on narrow screens, athlete name column frozen | `src/components/wellness/WellnessDashboard.jsx` | ⬜ |

### GATE S3
- [ ] Table loads with today's data for all athletes in assigned teams
- [ ] Colour coding correct per threshold
- [ ] Date selector changes data
- [ ] Team filter works
- [ ] Click athlete row → individual view opens
- [ ] 7-day trend chart renders correctly
- [ ] Body map in individual view shows correct sore regions (read-only)
- [ ] Flagged athletes (score ≤ 3) highlighted

---

## Sprint 4 — RPE Dashboard
**Assign to:** Cursor
**Estimated time:** 2 days
**Depends on:** Sprint 3 GATE passed
**Schema changes:** None

### Goal
Build Teamworks-style RPE monitoring dashboard. Heatmap grid + squad line
charts. Replaces current minimal RPE view.

### Target layout
```
[Date From] [Date To — default last 30 days] [Team filter] [Session filter]

RPE HEATMAP TABLE
Athlete | date1 | date2 | date3 | ... | dateN
        |  6.0  |  7.5  |  8.0  |     |

Colour coding:
  RPE 1-4  → green
  RPE 5-6  → no highlight
  RPE 7-8  → amber
  RPE 9-10 → red

AVG row at bottom per date column

SQUAD RPE LINE CHART
  X axis: dates, Y axis: average RPE, mean line + ±1SD bands

SQUAD s-RPE LOAD LINE CHART
  X axis: dates, Y axis: RPE × duration (session load), squad aggregate
```

### Milestones

| # | Item | File(s) | Status |
|---|------|---------|--------|
| S4-01 | RPEDashboard — heatmap table, date range, team filter | `src/components/rpe/RPEDashboard.jsx` (new) | ⬜ |
| S4-02 | Cell colour coding: green/neutral/amber/red | `src/components/rpe/RPEDashboard.jsx` | ⬜ |
| S4-03 | Average row at bottom per date column | `src/components/rpe/RPEDashboard.jsx` | ⬜ |
| S4-04 | Squad average RPE line chart with mean + ±1SD (Chart.js) | `src/components/rpe/RPECharts.jsx` (new) | ⬜ |
| S4-05 | Squad s-RPE load line chart (RPE × duration aggregate) | `src/components/rpe/RPECharts.jsx` | ⬜ |
| S4-06 | Individual athlete RPE trend on row click | `src/components/rpe/RPEDashboard.jsx` | ⬜ |
| S4-07 | Flag: athletes with RPE ≥ 8 for 3+ consecutive days — orange row highlight + badge | `src/components/rpe/RPEDashboard.jsx` | ⬜ |
| S4-08 | Move RPEDashboard into Dashboard → RPE tab | `src/pages/Dashboard.jsx` | ⬜ |
| S4-09 | Responsive: frozen athlete column, horizontal scroll on date columns | `src/components/rpe/RPEDashboard.jsx` | ⬜ |

### GATE S4
- [ ] Heatmap loads for last 30 days
- [ ] Colour coding correct
- [ ] Squad RPE line chart renders
- [ ] s-RPE load chart renders
- [ ] 3-day RPE spike flag working
- [ ] Date range selector changes data
- [ ] Individual athlete trend visible on row click

---

## Sprint 5 — Athlete Login + Mobile View
**Assign to:** Cursor
**Estimated time:** 2-3 days
**Depends on:** Sprint 4 GATE passed
**Schema changes:** None

### Goal
Athlete-facing experience. Clean, mobile-first. Athlete logs into a different
view from staff — only their own data, no coaching-internal information.
Also covers aesthetic improvements to the athlete-facing screens.

### Athlete navigation (separate from staff sidebar)
```
Home       (today's wellness + RPE entry)
My Data    (personal history: wellness trends, RPE history, assessment results)
Programme  (S&C Pro sessions — placeholder for now)
Profile    (personal details, photo)
```

### Milestones

| # | Item | File(s) | Status |
|---|------|---------|--------|
| S5-01 | Role-based navigation — athletes see athlete nav, staff see staff sidebar | `src/App.jsx`, `src/components/layout/` | ⬜ |
| S5-02 | Athlete Home — clean mobile-first layout: date, today's tasks (wellness + RPE if session today) | `src/pages/AthleteHome.jsx` | ⬜ |
| S5-03 | Wellness entry form — full body map integrated, bilingual labels (EN/HI), submit confirmation | `src/pages/AthleteHome.jsx` | ⬜ |
| S5-04 | RPE entry — session selector, CR10 slider, duration field, submit | `src/pages/AthleteHome.jsx` | ⬜ |
| S5-05 | My Data page — personal wellness 7-day trend, RPE history, last assessment classification | `src/pages/AthleteMyData.jsx` (new) | ⬜ |
| S5-06 | Assessment results view — athlete sees own classification badges + radar chart (no coaching data) | `src/pages/AthleteMyData.jsx` | ⬜ |
| S5-07 | Profile page — photo, name, DOB, position, jersey number (read-only) | `src/pages/AthleteProfile.jsx` | ⬜ |
| S5-08 | Mobile viewport — all athlete pages optimised for 375px–430px screens | All athlete pages | ⬜ |
| S5-09 | Touch targets — all interactive elements minimum 44×44px | All athlete pages | ⬜ |
| S5-10 | Aesthetic pass — athlete login screen design, loading states, empty states | `src/pages/Login.jsx`, athlete pages | ⬜ |
| S5-11 | Staff views — responsive audit: sidebar collapses to icon-only below 1024px | `src/components/layout/Sidebar.jsx` | ⬜ |
| S5-12 | Staff views — table horizontal scroll on mobile, no broken layouts | Key pages | ⬜ |

### GATE S5
- [ ] Athlete logs in → sees athlete nav (not staff sidebar)
- [ ] Staff logs in → sees staff sidebar (unchanged)
- [ ] Athlete home loads on mobile without horizontal overflow
- [ ] Wellness form with body map submits correctly on mobile touch
- [ ] RPE form submits correctly
- [ ] My Data page shows personal wellness + RPE history
- [ ] Athlete cannot access any staff-only route (redirected to /athlete-home)
- [ ] Staff sidebar collapses correctly on narrow screens

---

## Sprint 6 — Injury Surveillance
**Assign to:** Claude.ai (schema) + Cursor (UI)
**Estimated time:** 3 days
**Depends on:** Sprint 5 GATE passed + Ranjit shares Smartabase injury form format
**Schema changes:** Yes — 2 new tables (reviewed in Claude.ai before execution)

### Goal
Physio-led injury recording and status tracking. Athletes select body region
on body map. Coach sees flag only (no clinical detail). Physio sees full record.

### Pending before sprint starts
- [ ] Ranjit to share Smartabase injury form field list
- [ ] Claude.ai to design and review schema (injury_records, injury_status_history)
- [ ] SQL reviewed and approved before execution

### Planned milestones (subject to form format)

| # | Item | File(s) | Status |
|---|------|---------|--------|
| S6-01 | Schema: injury_records table | SQL — review in Claude.ai first | ⬜ |
| S6-02 | Schema: injury_status_history table | SQL — review in Claude.ai first | ⬜ |
| S6-03 | Injury entry form — body map + fields (date, mechanism, severity, notes) | `src/components/injury/InjuryEntryForm.jsx` (new) | ⬜ |
| S6-04 | Injury status workflow: Reported → Under Assessment → Modified Training → Full Training → Cleared | `src/components/injury/InjuryStatusBadge.jsx` (new) | ⬜ |
| S6-05 | Injury tab in Dashboard — flagged athletes, current status, days since injury | `src/pages/Dashboard.jsx` | ⬜ |
| S6-06 | Athlete injury history — physio sees full detail, coach sees status only | `src/pages/UserDetailPage.jsx` (extend) | ⬜ |
| S6-07 | Permission gate — injury detail gated behind can('injury_surveillance', 'view') | All injury components | ⬜ |
| S6-08 | BodyMapSelector reused — no duplication | `src/components/shared/BodyMapSelector.jsx` | ⬜ |

### GATE S6
- [ ] Physio can enter injury record with body map selection
- [ ] Status workflow transitions correctly
- [ ] Coach sees flag badge only — no clinical detail
- [ ] Physio sees full injury history
- [ ] Injury tab in Dashboard shows flagged athletes
- [ ] BodyMapSelector is the same component as wellness — not duplicated

---

## Sprint 7 — Configurable Dashboard Foundation
**Assign to:** Claude.ai (architecture) + Cursor (UI) + Claude Code (schema)
**Estimated time:** 3 days
**Depends on:** Sprint 6 GATE passed
**Schema changes:** Extend dashboard_layouts table (already exists)

### Goal
Make dashboards user-configurable. Coaches choose which widgets to show
and in what layout. Default layouts seeded per role. No external BI tool
dependency — built in-house using Chart.js (already in stack).

### Widget types (V1)
- Stat card (single number + trend arrow)
- Line chart (time series — RPE, wellness score, s-RPE load)
- Heatmap table (wellness grid, RPE grid)
- Bar chart (squad distribution)
- Radar chart (assessment — already built)

### Milestones

| # | Item | File(s) | Status |
|---|------|---------|--------|
| S7-01 | Widget registry — config objects per widget type | `src/lib/widgetRegistry.js` (new) | ⬜ |
| S7-02 | Schema: extend dashboard_layouts with widget config JSONB | SQL — review in Claude.ai | ⬜ |
| S7-03 | DashboardCanvas — renders widget list from layout config | `src/components/dashboard/DashboardCanvas.jsx` (new) | ⬜ |
| S7-04 | Add Widget panel — pick type, configure source + metric + filters | `src/components/dashboard/AddWidgetPanel.jsx` (new) | ⬜ |
| S7-05 | Widget resize/reorder — drag to reorder, save layout | `src/components/dashboard/DashboardCanvas.jsx` | ⬜ |
| S7-06 | Save layout to user_preferences (scope = 'dashboard') | `src/lib/preferences.js` | ⬜ |
| S7-07 | Seed default layouts per role: S&C Coach, Physio, Head Coach | SQL seed | ⬜ |
| S7-08 | "Reset to default" button — clears user layout, reverts to role default | `src/components/dashboard/DashboardCanvas.jsx` | ⬜ |

### GATE S7
- [ ] Default layout loads for each role on first login
- [ ] Add widget flow works end to end
- [ ] Layout saves and persists across sessions
- [ ] Reset to default works
- [ ] All existing dashboard widgets (wellness, RPE, assessment radar) work as widget instances
- [ ] No external BI dependency

---

## Pending Items Log
*Items identified but not yet assigned to a sprint*

| # | Item | Priority | Notes |
|---|------|----------|-------|
| P-01 | Data migration — Smartabase wellness + RPE historical data | High | Awaiting export format from Ranjit |
| P-02 | V1 report bugs — mailto, radar flexibility axis, median percentile | Medium | In AIS_Pending_Items.md as V1-01/02/03 |
| P-03 | CSS variables sweep — 44+ hardcoded hex values | Medium | P-01 in AIS_Pending_Items.md |
| P-04 | Individual plan row architecture fix (P-11 in pending items) | High | Fix before athlete transfer workflow |
| P-05 | External share tokens for reports (TH-14/15 from May sprint) | Low | Not yet built |
| P-06 | is_active flip on first login (user accepts invite) | Medium | Auth trigger or onLogin hook |
| P-07 | SMTP sender — move from onboarding@resend.dev to verified domain | High | Before any real user is onboarded |

---

## Architecture Decisions Recorded This Sprint Window

### Decision: Centralise all user creation in Admin
Date: 28 May 2026
Add Athlete button removed from Athletes page. All user creation (athlete + staff)
goes through Admin → Add User modal with two paths. Staff path triggers invite
email. Athlete path creates profile only (no auth account until V2 athlete portal).

### Decision: user_permission_overrides table for per-user RBAC
Date: 28 May 2026
Role-level defaults in role_permissions. User-level exceptions in
user_permission_overrides. NULL = inherit from role. TRUE/FALSE = explicit override.
Resolution: check overrides first, fall back to role. Implemented in auth.js
can() and canSync() functions.

### Decision: Active/Inactive/Delete model for users
Date: 28 May 2026
Deactivate: is_active = false, deactivated_at = now(). User cannot log in.
Disappears from all operational views. Historical data preserved.
Delete: hard delete. Blocked if user has assessment/wellness/RPE data — system
forces deactivation instead. Requires admin confirmation.

### Decision: No external BI tool — in-house widget dashboard
Date: 28 May 2026
Power BI / Metabase not integrated. Dashboard system built in-house using
Chart.js (already in stack). Widget types: stat card, line chart, heatmap,
bar chart, radar. Widget config stored in dashboard_layouts table (already
in schema). Default layouts seeded per role. Sprint 7 item.

### Decision: Sidebar navigation structure
Date: 28 May 2026
7 items: Dashboard | Athletes | Periodisation | Log | Reports | Admin | Settings.
Dashboard absorbs all monitoring views (Wellness, RPE, Injury).
Log absorbs all data entry (RPE logging, wellness submission, staff notes).
Admin absorbs all system config (Teams, Roles, Users, Org settings).
Settings becomes personal-only (theme, view preferences).

### Decision: Body map component
Date: 28 May 2026
50 named body regions (28 front, 22 back). Built as reusable controlled React
component (src/components/shared/BodyMapSelector.jsx). SVG-based. Used in
wellness form and injury entry — same component, no duplication. Stores
selected regions as string array in JSONB column.

---

## Canonical Resource Strings
*Use these exact strings in role_permissions.resource, can() calls, UI gates*

```
assessments
periodisation
reports
sessionLibrary
athleteRoster
adminConfig
wellness
rpe_logging
injury_surveillance
athlete_portal
unified_reports
sc_pro
ai_assistant
```

---

## New Files Tracker
*Track all new files. None may exceed 400 lines at creation.*

| File | Sprint | Status | Line count |
|------|--------|--------|------------|
| `src/components/admin/AddUserModal.jsx` | S0 | ⬜ | — |
| `src/hooks/useAddUser.js` | S0 | ⬜ | — |
| `src/pages/UserDetailPage.jsx` | S0 | ⬜ | — |
| `src/hooks/useUserPermissions.js` | S0 | ⬜ | — |
| `src/components/admin/UserPermissionsGrid.jsx` | S0 | ⬜ | — |
| `src/pages/Log.jsx` | S1 | ⬜ | — |
| `src/components/shared/BodyMapSelector.jsx` | S2 | ⬜ | — |
| `src/components/wellness/WellnessAthleteDetail.jsx` | S3 | ⬜ | — |
| `src/components/rpe/RPEDashboard.jsx` | S4 | ⬜ | — |
| `src/components/rpe/RPECharts.jsx` | S4 | ⬜ | — |
| `src/pages/AthleteMyData.jsx` | S5 | ⬜ | — |
| `src/components/injury/InjuryEntryForm.jsx` | S6 | ⬜ | — |
| `src/components/injury/InjuryStatusBadge.jsx` | S6 | ⬜ | — |
| `src/components/dashboard/DashboardCanvas.jsx` | S7 | ⬜ | — |
| `src/components/dashboard/AddWidgetPanel.jsx` | S7 | ⬜ | — |
| `src/lib/widgetRegistry.js` | S7 | ⬜ | — |

---

*AIS — Athlete Intelligence System · Sprint Milestones 28 May 2026 onwards*
*Ranjit Nahak · Strength & Conditioning Coach*
*This document is the single source of truth for all sprints listed above.*
*Update status after every milestone. Never skip a GATE.*
