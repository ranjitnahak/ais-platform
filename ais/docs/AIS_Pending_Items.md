# AIS — Pending Items & Backlog
**Last updated:** April 2026  
**Author:** Ranjit Nahak, Strength & Conditioning Coach  
**Status:** Living document — update at the end of every development thread

---

## How to Use This Document

Add completed items with ✅ and date. Add new items as they are identified.
Review at the start of every thread to pick up where work left off.
Items are ordered by priority within each section.

---

## V1 — Outstanding Fixes (Kabaddi Camp)

These are small, self-contained fixes for the active Kabaddi camp reports.
Should be cleared before any new V1.5 features are added.

| # | Item | File | Notes |
|---|------|------|-------|
| V1-01 | Send Report mailto not pre-filling athlete email | `AthleteReport.jsx` | `athlete.email` not reaching the component — debug with `console.log(athlete)` |
| V1-02 | Flexibility axis collapsed on radar for some athletes | `AthleteReport.jsx` | Case-insensitive fix applied to `getTierScore` but needs verification |
| V1-03 | Overall classification → median percentile not implemented | `AthleteReport.jsx` | Design complete. Replace `overallFromQualities` with median percentile logic. Thresholds: 76–100=Excellent, 51–75=Above Average, 26–50=Average, 0–25=Below Average. Do NOT modify `scoring.js` |
| V1-04 | ~14 athletes still without profiles | Supabase DB | Athletes: Narender, Rahul, Parvesh, and others — data pending from camp |

---

## V1.5 — Periodisation (In Progress)

### Completed This Thread (April 2026)
- ✅ Band resize — left/right drag working, saves correctly (id preserved in flushSave)
- ✅ Ghost layer — dimmed to 25% opacity on individual athlete view
- ✅ Autosave — debounced 1.5s autosave replacing manual Save button
- ✅ Refactor Step 1 — `useResizeDrag` hook extracted
- ✅ Refactor Step 2 — `useSpanDrag` hook extracted
- ✅ Refactor Step 3 — `PeriodisationToolbar` component extracted
- ✅ Refactor Step 4 — `CellRenderer` + `cellUtils.js` extracted
- ✅ Refactor Step 5 — `PeriodisationGrid` + `gridUtils.js` extracted
- ✅ Individual plan auto-create — `org_id` fix + recovery check for empty plans
- ✅ DB cleanup — duplicate plan records and zero-row athlete plans fixed
- ✅ `.cursorrules` + `docs/` folder set up in project root

### Outstanding — Code Quality

| # | Item | File(s) | Notes |
|---|------|---------|-------|
| P-01 | CSS variables — replace all hardcoded hex values | All `src/components` and `src/pages` files | 44+ instances in `PeriodisationCanvas.jsx` alone. Do AFTER refactor is complete. First add tokens to `src/index.css`, then sweep files. |
| P-02 | Autosave error handling | `PeriodisationCanvas.jsx` | If `flushSave` fails, restore manual Save button so user can retry. Currently fails silently. |
| P-03 | Error handling on all async operations | `usePeriodisationPlan.js`, `PeriodisationCanvas.jsx` | 13 await calls, only 2 try/catch. Every await needs a try/catch with console.error prefix. |
| P-04 | Accessibility — add id/name to input fields | All components with inputs | 30 browser warnings: "form field element should have an id or name attribute" |

### Outstanding — Features

| # | Item | Notes |
|---|------|-------|
| P-05 | PDF export for periodisation | Brief written, build not started. Separate from athlete PDF reports. |
| P-06 | 4Y zoom view | Grid renders at quarter-column level for Olympic cycle planning |
| P-07 | Session Planner standalone feature | Exercise selection, sets/reps/rest, drill sequences. Bidirectional link with periodisation canvas. |
| P-08 | ACWR auto-calculation display | Auto-row already in schema. Calculation logic in `periodisationUtils.js`. Needs UI wiring. |
| P-09 | Peaking index display | Per-week countdown 7→1, color-coded red to green |
| P-10 | Week notes persistence verification | Tiptap editor built. Verify per-week storage is working correctly after refactor. |

| P-11 | Individual plan row structure is architecturally wrong
Individual plans currently own their own plan_rows, causing drift 
when team plan rows change or when athletes move between teams.
Correct design: rows always owned by team plan. Individual plan 
stores only plan_cells (override layer). Row rendering in individual 
athlete view must always query team plan rows, not individual plan rows.
Affects: usePeriodisationPlan.js, PeriodisationCanvas.jsx
Fix before: adding more rows to team plans or building athlete transfer workflow.

| P-12 | Individual plan row structure is architecturally wrong
Individual plans currently own their own plan_rows, causing drift 
when team plan rows change or when athletes move between teams.
Correct design: rows always owned by team plan. Individual plan 
stores only plan_cells (override layer). Row rendering in individual 
athlete view must always query team plan rows, not individual plan rows.
Affects: usePeriodisationPlan.js, PeriodisationCanvas.jsx
Fix before: adding more rows to team plans or building athlete transfer workflow.

---

## V2 — Planned Features

These must NOT be partially implemented in V1.5. Use stub pattern only.

| # | Item | Notes |
|---|------|-------|
| V2-01 | Auth + RLS re-enabled | Supabase Auth replaces `src/lib/auth.js` stub. RLS policies need writing. |
| V2-02 | Athlete portal | Athlete-facing view — own data only, read-mostly. Visibility rules designed (see `AIS_Settings_Backlog.md`). |
| V2-03 | Wellness / RPE tracking | Per-session RPE, wellness questionnaires, trend charts |
| V2-04 | Re-test tracking + progress comparison | Compare assessment scores across sessions |
| V2-05 | Admin config UI | Org-level settings, role management, group management |
| V2-06 | Theme system | Org-level brand kit + user-level dark/light/system. CSS variables must be in place first (P-01). |
| V2-07 | Training plan generator | Separate project. AI-assisted session planning. |
| V2-08 | `user_preferences` table + `src/lib/preferences.js` | Settings stub. Schema designed in `AIS_Settings_Backlog.md`. |

---

## V3 — Future

| # | Item |
|---|------|
| V3-01 | Multi-org superuser UI |
| V3-02 | Billing |
| V3-03 | Mobile app (touch events needed — current canvas is mouse-only) |
| V3-04 | Public API |
| V3-05 | Wearable integrations |

---

## Known Technical Debt

| # | Item | Severity | Notes |
|---|------|----------|-------|
| TD-01 | Mobile/touch support missing | Medium | Entire resize and span-drag system uses mouse events only. No touch events. iPads/tablets won't work for band drag/resize. V3 item. |
| TD-02 | CSS variables not implemented | Medium | 44+ hardcoded hex values across components. Blocks V2 theme system. Fix before V2. |
| TD-03 | No error handling on async ops | Medium | Silent failures give users no feedback. Every await needs try/catch. |
| TD-04 | `PeriodisationCanvas.jsx` still large | Low | Refactor reduced it significantly but may still be over 400 lines. Verify line count after refactor commits. |
| TD-05 | Ghost layer only renders at `cell_date` column | Low | `ghostCellMap` keyed by `cell_date` only — ghost band appears as single-column pill, not spanning. Not visible to user but architecturally incomplete. |
| TD-06 | Duplicate plan auto-create | Fixed | Root cause: `org_id` missing in row-copy INSERT. Fixed in `usePeriodisationPlan.js`. Recovery check added for zero-row plans. |

---

## Architecture Guidelines — Updates Needed

The following additions to `AIS_Architecture_Guidelines.md` were designed this thread and need to be written in:

| # | Section | Content |
|---|---------|---------|
| AG-01 | Section 12 — Component Size & Refactoring Rules | 400-line rule, split sequence, current known debt |
| AG-02 | Section 13 — Error Handling & Observability Rules | Every await in try/catch, user-visible failure signals, autosave failure recovery |
| AG-03 | Section 9 additions | Pre-development checklist: component health check, async error handling check |

---

## DB State — April 2026

### Known issues resolved
- Duplicate `periodisation_plans` records for Men's team — 2 of 3 deleted, canonical plan ID: `1572ca68-f3bb-4102-8c25-6064dc60edd3`
- Zero-row individual athlete plans (Naveen, Ajit, Adesh) — rows copied from team plan via SQL
- Duplicate Adesh M Warkhade plan — deleted plan ID `61e3ab9d-1097-490a-b787-101d8b579660`
- Duplicate `plan_cells` from pre-fix resize saves — cleaned via `ROW_NUMBER()` query

### Canonical IDs (Men's team)
- Default org: `a1000000-0000-0000-0000-000000000001`
- Men's team: `b2000000-0000-0000-0000-000000000001`
- Women's team: `b2000000-0000-0000-0000-000000000002`
- Assessment session: `f1000000-0000-0000-0000-000000000001`
- Canonical team plan (Men): `1572ca68-f3bb-4102-8c25-6064dc60edd3`


---

## S&C Pro — Backlog (Pending AIS V1.5 Stabilisation)

Full requirements in `SC_Pro_Architecture_v1.0.md`.
Do not begin implementation until AIS V1.5 Session Planner is stable and shipped.

### Completed / in progress (April 23, 2026)
- ✅ **SP-05 (23 Apr 2026)** — S&C Pro **Programme Builder Phase 1** delivered as standalone Vite app at repo root **`sc-pro/`** (not under `ais/src`): programme library + filters + pagination + create/duplicate/template actions; weekly grid + create session + deep **Copy Week**; **Session Builder** three-panel layout with blocks, exercise search (recent in `localStorage`), prescription panel, publish, autosave hooks. Shared **Kinetic Precision** tokens in `sc-pro/src/index.css`; Supabase usage follows Three Rules (`org_id` on all org-scoped queries). **Line-count rule:** after refactor, **no** `sc-pro/src/pages/*.jsx` or `sc-pro/src/hooks/*.js` file exceeds **400 lines** (largest page file: `SessionBuilder.jsx` ~253 lines).
- ✅ **SP-05 follow-up (24 Apr 2026)** — `sc-pro` fixes: (1) Session builder left panel lists only sessions in the **calendar week (Mon–Sun) containing the open session’s `session_date`** (`calendarWeekRangeContainingSessionDate` in `weekDates.js` + `SessionBuilderLeft.jsx`). (2) Left panel labels use **`sessions.name`** with **category** fallback instead of a generic “Session” placeholder. (3) Programme week tabs show the **dot only when `programme_sessions` has at least one row** for that `programme_week_id` (`useProgrammeDetailPage.js` + `ProgrammeDetail.jsx`). (4) Athlete loads use **only `session.team_id` roster** (skip roster fetch + show assign-team message when `team_id` is null); **`athlete_teams` has no `org_id`** — org scoping remains on **`athletes.org_id`** per schema.
- ✅ **SP-05 prescription UX (23 Apr 2026)** — Session Builder: **inline prescription pills** per exercise (`PrescriptionPillRow.jsx`, `ExercisePill.jsx`, `usePrescriptionPills.js`, `prescriptionPillLogic.js`); **CSS variables** for pill colours in `sc-pro/src/index.css`; right rail **`SessionInfoPanel.jsx`** (YouTube embed from `video_url`, %1RM athlete loads card, last `athlete_exercise_logs` row with `org_id`); **single-select** exercise row toggles selection; new exercises insert **sets: 3**, **reps: null**, **prescription_type: `max`**. Legacy `SessionPrescriptionPanel.jsx` retained in repo but unused.
- ✅ **SP-02 (23 Apr 2026)** — `ais/sql/sc_pro_rbac_v1.sql` (V1 documentation + V2 `role_permissions` placeholders only; no DB tables). **auth.js** updated with `programme` resource (`'edit'` on staff stub) and boolean **`viewCoachingData: true`**; `can()` extended for boolean permission keys and for **`can('programme', 'viewCoachingData')`** per SC §11.3.
- ✅ **S&C Pro system exercise library seed (v1)** — `ais/sql/sc_pro_exercise_library_seed_v1.sql` (57 movements, reference max + suggested swaps, idempotent `ON CONFLICT`). Run in Supabase after schema migration when ready to seed.
- ✅ **S&C Pro core DDL revised for §3 alignment** — `ais/sql/sc_pro_schema_v1.sql` now tracks `SC_Pro_Architecture_v1.0.md` §3: enums (`sc_pro_*`), `programmes` (sport text + phase_type / training_age / difficulty), `programme_weeks`, **`programme_sessions`**, `session_blocks`, `session_exercises`, `exercise_library` (nullable `org_id` for system defaults per spec), `athlete_1rm`, `athlete_exercise_logs`, `loading_schemes`, and **additive** `sessions` columns (`programme_week_id`, `plan_cell_id`, `name`, SC category/RPE/publish fields, etc.). Removed earlier draft `programme_teams` (not in architecture §3.1 — team scope remains `sessions.team_id`).

### Pre-conditions before S&C Pro V1 can start
- [ ] AIS V1.5 Session Planner complete and stable
- [ ] `sessions` table added to shared schema as Platform Core table
- [ ] Platform Core table ownership documented in Supabase (organisations,
      teams, users, athletes, athlete_teams confirmed as shared)
- [ ] `platform_events` table created in Supabase
- [x] RBAC extended (V1 stub): `programme` + `viewCoachingData` in `src/lib/auth.js`;
      V2 `role_permissions` mapping documented in `ais/sql/sc_pro_rbac_v1.sql` (23 Apr 2026)

### S&C Pro V1 — Build Sequence

| # | Item | Depends On |
|---|------|-----------|
| SP-01 | Platform Core extension — sessions table, confirm shared tables | AIS V1.5 stable |
| SP-02 | ✅ **Done 23 Apr 2026** — RBAC extension: `programme` + `viewCoachingData` in `auth.js`; `ais/sql/sc_pro_rbac_v1.sql` documents V2 `role_permissions` intent (no DB tables) | SP-01 |
| SP-03 | Exercise library — schema + system defaults seed + org library UI | SP-01 |
| SP-04 | Athlete 1RM profiles — schema + UI (tested, working max, coach-entered) | SP-01 |
| SP-05 | ✅ **Done 23 Apr 2026** — Programme builder — `sc-pro/` app: library + weekly view + session builder + prescriptions (see Completed section) | SP-03, SP-04 |
| SP-06 | Individualisation engine — %1RM auto-calculation, per-athlete load rendering | SP-04, SP-05 |
| SP-07 | Override layer — exercise-level and session-level athlete overrides | SP-05, SP-06 |
| SP-08 | Athlete logging — session view, set-by-set logging, session complete flow | SP-05 |
| SP-09 | Compliance view + analytics — planned vs actual, exception-first feed | SP-08 |
| SP-10 | AIS integration — platform_events wired, RPE → load wave, session link | SP-08, SP-09 |
| SP-11 | Unified navigation shell — shared sidebar, AIS ↔ S&C Pro links | SP-10 |
| SP-12 | Programme templates — save, reuse, assign to new season / sport | SP-05 |

### S&C Pro V2 — Readiness Layer (after V1 is stable)
- Wellness questionnaire (morning athlete check-in)
- Force plate CMJ integration (manual entry first, API later)
- HRV integration (Whoop, Polar, Garmin)
- Composite readiness score
- Load auto-adjustment suggestions (coach approves, never auto-applies)
- Strava / GPS conditioning import

### S&C Pro V3 — Velocity + Intelligence
- VBT device integration
- Velocity-based load auto-regulation
- AI programme generation
- Mobile app (touch-optimised logging)
