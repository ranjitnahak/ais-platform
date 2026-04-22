# Athlete Intelligence System (AIS) — Architecture & Context Document
**Last updated:** April 2026  
**Purpose:** Continuity document for picking up work across threads  
**Author:** Ranjit Nahak, Strength & Conditioning Coach

---

## Document Map

| File | Purpose | Update frequency |
|---|---|---|
| `AIS_Architecture_Guidelines.md` | **How** to build — rules, Three Rules, RBAC, anti-patterns, coding standards | Rarely — architecture decisions only |
| `AIS_Architecture_Context.md` (this file) | **What** is built — current state, tech stack, schema, active data, feature design | Per thread — reflects current build state |
| `AIS_Pending_Items.md` | **What** needs doing — bugs, backlog, tech debt, V-stage tracking | Every thread |
| `AIS_Settings_Backlog.md` | Settings feature design brief — implementation brief for V2 Settings module | When new settings items are identified |

> `Three_rules` standalone file is superseded — Section 3 of `AIS_Architecture_Guidelines.md` is the authoritative source.

---

## 1. Project Overview

AIS (Athlete Intelligence System) is a globally ambitious, sport-agnostic Athlete Management System designed to compete with and surpass Smartabase/Teamworks. It is being built in parallel with active coaching work.

**Core philosophy:** Smart defaults + guided customisation. No "builder" layer. Four interface layers (Superuser / Admin / Staff / Athlete) designed into the schema from day one. Key differentiators: faster/cleaner UI, professional PDF output, minimal clicks for data entry, sport-agnostic intelligence with configurable benchmarks per org, full data ownership.

**Report signatory:** Ranjit Nahak, Strength and Conditioning Coach  
**Color scheme:** Charcoal `#1C1C1E` + vibrant orange `#F97316`  
**Classification colors:** Red / Orange / Blue / Green for Below Average / Average / Above Average / Excellent

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend / DB | Supabase PostgreSQL |
| Supabase URL | `https://cwyesqbxcczgbkkekhsc.supabase.co` |
| UI Design reference | Google Stitch |
| Dev environment | Cursor IDE + Claude Code |
| PDF generation | jsPDF + html2canvas |
| Charts | Chart.js |
| Hosting | Vercel (`https://ais-platform-omega.vercel.app`) |

---

## 3. What Is Already Built (MVP)

### 3.1 Database Schema (12 tables, Supabase PostgreSQL)
RLS is currently **disabled** for active development. Re-enabling is a V2 milestone tied to auth implementation.

| Table | Purpose |
|---|---|
| `organisations` | Top-level org entity. Has `logo_url` (IIS) and `secondary_logo_url` (JSW Sports) |
| `users` | Staff and athlete accounts |
| `teams` | Teams within an org |
| `athletes` | Athlete profiles with photo |
| `athlete_teams` | Many-to-many: athletes ↔ teams |
| `test_definitions` | Definition of each test (name, unit, direction) |
| `benchmarks` | Classification thresholds per test per gender |
| `assessment_sessions` | A testing session (camp + date) |
| `assessment_results` | Individual athlete results per test |
| `dashboard_layouts` | Configurable dashboard widget layout |
| `camps` | Camp records |
| `audit_log` | Action logging |

**Default org ID:** `a1000000-0000-0000-0000-000000000001`

### 3.2 Active Camp Data — Kabaddi S&C Camp
- Session: "S&C Camp — 28 Mar 2026" (ID: `f1000000-0000-0000-0000-000000000001`)
- Teams:
  - "Asian Games Probable — Men" (ID: `b2000000-0000-0000-0000-000000000001`, 27 athletes)
  - "Asian Games Probable — Women" (ID: `b2000000-0000-0000-0000-000000000002`, 32 athletes)
  - 63 total athlete profiles created (~14 still without profiles pending data)

### 3.3 Tests Configured (5 tests, IDs `c1000000-...0001` to `...0008`)
- Sit & Reach (cm, higher better)
- Seated Chest Medicine Ball Throw (m, higher better)
- Standing Broad Jump (m, higher better — converted from cm in Excel)
- Sprint with splits: Split 1 (0–5m), Split 2 (5–10m), Split 3 (10–20m), Total Time (seconds, lower better)
- Yo-Yo IR1 (level, higher better)

### 3.4 Scoring Logic
- Men: absolute benchmarks (4 tiers)
- Women: gender-filtered squad percentile rank only (≥75=Excellent, ≥50=Above Average, ≥25=Average, <25=Below Average)
- Engine: `src/lib/scoring.js` → `classifyScore({value, gender, direction, benchmarks, squadValues})` returns `{classification, percentileRank, method}`
- **Do not modify `scoring.js`** — changes target `AthleteReport.jsx` only

### 3.5 Best-Trial Selection Logic
- Highest value for Broad Jump / Sit & Reach / Chest Pass
- Lowest total time for Sprint (all 4 splits pulled from that single best trial)
- Single value for Yo-Yo

### 3.6 Overall Classification (Recently Fixed Design)
Driven by **median percentile rank** across all tests (replacing flawed mode/quality-axis aggregation).  
Thresholds: 76–100 = Excellent, 51–75 = Above Average, 26–50 = Average, 0–25 = Below Average.  
Code changes target `AthleteReport.jsx` only — replacing `overallFromQualities` with median percentile logic, updating UI from `avgPct` to `medianPct`.

### 3.7 MVP Screens Built
- **Athletes** — roster + add athlete modal with photo upload + crop
- **Reports** — athlete list with team filter + PDF report generation
- **SquadDashboard**

### 3.8 PDF Report Features
- IIS + JSW logos in header
- Athlete photo + name / gender / age / position / sport
- Camp name + date
- Overall classification badge with percentile
- 8 test score cards (color-coded badges + progress bars + ordinal percentile)
- Radar chart (5 axes: Flexibility / Upper Body Power / Lower Body Power / Speed / Endurance using actual squad percentiles)
- Performance summary (Strengths / Developing / Priority Focus)
- Signatory
- Download PDF + Send Report (mailto) buttons

### 3.9 Supabase Storage
- Two public buckets: "Logos" (IIS + JSW Sports logos) and "Athletes" (athlete photos)

### 3.10 Data Correction Workflow
SQL-first: Diagnostic query → DELETE incorrect rows → INSERT correct values using `test_id` (not `test_definition_id`).  
Note: `assessment_results` table uses `test_id` (not `test_definition_id`).

---

## 4. Periodisation Feature — In Progress (V1.5)

Design is complete. Core canvas, refactoring, and several features are built. See `AIS_Pending_Items.md` for outstanding items.

### 4.1 Design Philosophy
A purpose-built planning canvas — not a calendar app, not a form builder. Feels like a spreadsheet but is backed by a structured database. Three things merged: Gantt chart structure + spreadsheet flexibility + sports platform intelligence.

### 4.2 Three Zoom Levels
| Zoom | Column unit | Use |
|---|---|---|
| 4-Year | Quarter | Olympic cycle planning |
| Annual (1Y) | Week | Season architecture — primary view |
| 6-Month / Monthly | Day | Block planning |
| Weekly | Day (wide) | Session-level intent |

All zoom levels show the same data — different lens, same canvas. Clicking a week in annual view zooms to weekly view.

### 4.3 Two Planning Axes
- **Team plan** — master plan for the squad, all athletes inherit
- **Individual athlete plan** — override layer shown on top of team plan as a ghost/background layer. Visual diff shows divergence clearly.

### 4.4 Row Architecture
**System rows** (auto-generated, always present):
- Month header, date row, calendar week number, season week number

**Row groups** (collapsible, department-owned):

| Group | Department | Key rows |
|---|---|---|
| Planning | S&C | Phase band, Week focus / Phase goal, Peaking index |
| Events & Fixtures | All | Competition (with A/B/C priority), Testing, Camp/Travel, Holidays |
| Physical Fitness | S&C | User-defined rows (Strength, Speed, Endurance etc.), Volume (1–10), Intensity (1–10), ACWR (auto-calculated), Planned/Actual load |
| Technical / Tactical | Technical staff | Primary focus, Secondary focus, Games format |
| Sports Science | Physio / Nutrition | Physio notes, Nutrition phase, Recovery modality |
| Psychology | Psychologist | User-defined |
| Analysis | Analyst | User-defined |

**Row types:**
- Band — drag to create colored spans (phases)
- Text — short label spanning cells
- Color Paint — click/drag to paint intensity
- Number — numeric per cell (1–10 scale)
- Marker — single-day flag
- Toggle — on/off per day

### 4.5 Key Concepts
**Peaking Index** — per-week countdown (7→1), color-coded red to green. 7 = deep prep, 1 = at peak. Shared language across all departments.

**AR (Active Recovery)** — a week-level state that crosses all physical quality rows simultaneously. Set once, applies to all.

**Volume + Intensity as separate numeric rows** — entered as 1–10 per week. The load wave chart auto-generates from these values.

**Three-layer quantitative rows** — Goal (season target) / Planned (coach schedules) / Actual (filled retrospectively).

**ACWR auto-calculation** — Acute load ÷ Chronic load. Color coded: green (0.8–1.3 safe), yellow (1.3–1.5 caution), red (>1.5 danger).

**Competition markers** — typed: Friendly / League / Cup / International / Tournament + A/B/C priority.

**Phase library** — org library + system defaults + one-time use. Admin-gated for permanent additions.

### 4.6 Weekly Drill-Down View
- Columns = days (Mon–Sun)
- Sessions stacked by time within each day (multi-session support)
- Each session has: time, venue, category, content list (multi-item from library), RPE (1–10), planned duration, actual duration, recovery modality, notes
- AM/PM blocks visually separated
- Screening/Tests row per session (e.g. CMJ)
- Recovery Modality row (Ice Bath, Pool Recovery, Massage)
- Week-level notes strip at bottom (with abbreviation glossary)

**Right summary panel:**
- Week number + date range
- Phase name
- Week focus + description
- Volume: Goal / Planned / Actual
- Avg RPE: Planned / Actual
- ACWR with visual bar
- Peaking index

### 4.7 Session Detail Drawer
Opens on clicking any session cell. Slides in from right. Contains:
- Day + session time, venue
- Category badge (auto-derived from dominant content items)
- Session content (multi-item list, picks from org library)
- RPE selector (1–10, color coded)
- Planned vs Actual duration
- Recovery modality dropdown
- Notes field
- "Plan this session →" button (links to Session Planner)

### 4.8 Session Library (Content Dropdown System)
Three tiers:
1. **System defaults** (AIS-provided): Mobility Work, Core Training, Aerobic Endurance, Recovery Run etc.
2. **Org library** (Admin-created): Kabaddi Specific Warm Up, MAS Runs, French Contrast etc.
3. **Use once** (any staff, not saved to library): one-off entries for specific sessions

Admin-gated for permanent org library additions.

### 4.9 Load Wave Chart
- Sits below the grid, spatially aligned with week columns above
- Blue line = Volume, Red line = Intensity, Green dashed = ACWR
- Auto-generated from numeric cell values — not drawn manually
- Collapsible but always available
- Scrolls in sync with the grid

### 4.10 Session Planner (Separate Feature — Linked)
A detailed session design tool — exercise selection, sets/reps/rest, drill sequences, warm-up/cool-down. Lives in its own section of AIS.

**Bidirectional link:**
- From periodisation → session planner: "Plan this session" button opens Session Planner pre-populated with date/time/team/venue/category
- From session planner → periodisation: sessions planned directly auto-appear in weekly view
- Visual indicator on weekly cells: thin colored bottom border = fully planned session exists

### 4.11 Database Schema (4 new tables needed)

```sql
periodisation_plans
  id, org_id, team_id, athlete_id (null = team plan),
  name, start_date, end_date, template_name, created_by

plan_rows
  id, plan_id, group_name, row_type, label,
  color, sort_order, is_visible, department_owner

plan_cells
  id, row_id, date, value (text/color/number),
  span_end_date (for merged cells)

plan_templates
  id, org_id, name, sport_type,
  rows (JSON array of row definitions)
```

Plus extend existing tables:
- `assessment_sessions` — add link to plan
- `camps` — add link to plan  
- Sessions table (new, for session planner integration)

### 4.12 Implementation Sequence
1. DB schema — 4 new tables + sessions table + RBAC layer
2. Annual canvas — grid renders at 1Y zoom, frozen labels, date headers
3. Phase band creation — drag to create colored spans
4. Row groups — add, collapse, reorder
5. Cell painting and text entry
6. Weekly view — day columns, AM/PM blocks, multi-session
7. Session drawer — time-based, content dropdown with library
8. Session library — org library + system defaults
9. Session Planner as standalone feature
10. Bidirectional link — periodisation ↔ session planner
11. ACWR auto-calculation + load wave chart
12. Peaking index + AI analysis

---

## 5. Architecture Decisions — Multi-Org Scalability

### 5.1 Comparative Analysis: AIS vs Smartabase/Teamworks

**What Smartabase does better:**
- Three-site separation (Auth / Admin / Builder) — clean concern separation at URL level
- Role-based data permissions at resource level — per form: Linked / Calendar / Read / Write / Delete
- System permissions separate from data permissions
- Groups as an access layer between org and teams
- Typed form fields (Number, Duration, Rating, Slider etc.) — enforced schema
- Audit trail built in

**What AIS does better:**
- Purpose-built for S&C — domain intelligence baked in, not a generic form builder
- No builder layer needed — smart defaults, new org works in minutes not weeks
- Professional PDF reports out of the box
- Periodisation canvas — nothing comparable exists in Smartabase
- Cleaner modern UX (dark-first, charcoal + orange)
- AI integration layer ("Ask AI about this week")
- ACWR auto-calculation built into planning canvas

### 5.2 The Architectural Gap to Close

AIS currently has 2 effective layers (org + user). Multi-org scale requires 5:

```
ORGANISATIONS
    └── GROUPS (teams, departments, cohorts)
            └── USERS (staff + athletes)
                    └── ROLES (what they can do)
                            └── RESOURCE PERMISSIONS
                                    (per feature: view/edit/admin)
```

### 5.3 Recommended Four User Layers

| Layer | Who | Access |
|---|---|---|
| Superuser | Anthropic / platform | All orgs, all data, billing |
| Admin | Org administrator | Full org, manages roles and groups |
| Staff | Coaches, physio, nutrition, analysts | Role-based, group-scoped |
| Athlete | Athletes | Own data only, read-mostly |

### 5.4 RBAC Schema (to add before periodisation tables)

```sql
-- Roles (replaces simple role enum on users)
roles: id, org_id, name, description

-- What each role can do per feature
role_permissions: role_id, resource, action (view/edit/admin)

-- Which role a user has, scoped to which group/team
user_roles: user_id, role_id, group_id

-- Groups (between org and team)
groups: id, org_id, name, description
group_members: group_id, user_id, access_level
```

**Key principle:** A staff member's permissions are always scoped to their group membership. A Kabaddi S&C coach has Edit access to Periodisation — but only for their assigned teams, not all teams in the org.

### 5.5 CSS Variable Theme System (Planned)
Three layers:
1. **Org-level brand kit** (Admin sets) — primary accent color, secondary color, logo
2. **User-level preference** — Dark / Light / System per user
3. **Page-level override** — Periodisation canvas defaults to Light (better for color-coded planning), Reports defaults to Dark

Implementation: `data-theme` attribute swap on `<html>` element. All colors reference CSS variables. Theme system can be dropped in without touching component code if built with variables from day one.

---

## 6. Feature Roadmap

### V1 (Current / Active)
- [x] Athlete roster with photo management
- [x] Assessment data entry + scoring engine
- [x] PDF reports (individual athlete)
- [x] Squad dashboard
- [ ] Fix: mailto pre-fill in Send Report
- [ ] Fix: Flexibility axis radar collapse
- [ ] Fix: Overall classification → median percentile
- [ ] Complete ~14 missing athlete profiles

### V1.5 (Next — Periodisation)
- [ ] RBAC schema foundation
- [ ] Periodisation annual canvas (1Y zoom)
- [ ] Phase band creation
- [ ] Row groups + cell types
- [ ] Weekly drill-down
- [ ] Session drawer + content library
- [ ] Load wave chart
- [ ] Session Planner (standalone)
- [ ] Bidirectional session link

### V2
- Training plan generator (separate project)
- Wellness / RPE tracking
- Re-test tracking + progress comparison
- Athlete portal (athlete-facing view)
- Admin config UI
- Auth + RLS re-enabled
- Theme system (org-level + user-level)

### V3
- Multi-org superuser
- Billing
- Mobile app
- API
- Wearable integrations

---

## 7. Key Principles & Learnings

- **No builder layer** — complexity handled through smart defaults, not user-facing config UIs
- **Overall classification = median percentile rank** — not aggregated qualitative labels
- **Women's scores = intra-squad percentile only** — never against men's absolute benchmarks
- **Sprint best-trial = all 4 splits from single best total-time trial** — not independently optimised
- **Broad Jump values in Excel = cm** — must convert to meters before insertion
- **RLS disabled during dev** — re-enable is a V2 milestone
- **CSS variables from day one** — makes theme system a drop-in later
- **Data-first architecture** — raw numbers are stored; visualisations (load wave, charts) derive from them
- **SQL-first data correction** — diagnose → delete → insert with verified data
- **Cursor IDE prompts should be tightly scoped** — e.g. "modify only AthleteReport.jsx, do not touch scoring.js"

---

## 8. Open Questions for Future Threads

1. Should Volume derive automatically from training rows (sum of planned hours) or be a separate manual input? Or both?
2. Phase library — pre-built templates (e.g. "Standard 4-week accumulation block") or always created from scratch?
3. History and re-use — should last year's plan be preserved as a template for next year?
4. Default zoom when opening Periodisation tab — current week in monthly, or full season from above?
5. Who can create individual athlete plan overrides — only S&C coach, or also physio?
6. Exact navigation entry point for Periodisation in the AIS sidebar

---

*End of context document. Resume in a new thread using this document as the brief.*
