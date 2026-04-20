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

*AIS — Athlete Intelligence System · Pending Items · Ranjit Nahak · April 2026*
