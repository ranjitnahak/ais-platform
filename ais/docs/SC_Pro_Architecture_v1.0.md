# S&C Pro
## Strength & Conditioning Programming Platform

**Architecture & Product Requirements Document · v1.0 · April 2026**

**Author:** Ranjit Nahak, Strength & Conditioning Coach
**Status:** Requirements complete — implementation pending AIS V1.5 stabilisation
**Companion documents:** AIS_Architecture_Guidelines.md · AIS_Architecture_Context.md · AIS_Pending_Items.md

> S&C Pro is a separate product from AIS but shares the same Supabase project, auth layer, and Platform Core tables. Read this document alongside AIS_Architecture_Guidelines.md — all Three Rules, RBAC patterns, and coding standards defined there govern S&C Pro equally.

---

## 1. Product Identity

### 1.1 What S&C Pro Is

S&C Pro is a professional strength and conditioning programming platform designed for performance sport organisations. It sits below the AIS Periodisation canvas in the planning continuum — AIS owns the season architecture, S&C Pro owns what happens inside each session.

S&C Pro solves one primary problem: building individualised programmes for 30–60 athletes takes too long. Delivery is fragmented. Actual vs planned data is invisible to the coach. S&C Pro eliminates all three pain points.

The reference product is TrainHeroic. S&C Pro is modelled on TrainHeroic's core interactions — weekly calendar, session builder, exercise library, athlete logging — and extends them significantly with: all prescription types, true individualisation at scale, periodisation phase context on every session, and readiness-informed load management (V2).

### 1.2 What S&C Pro Is Not

- Not a generic workout logger. The intelligence (1RM auto-calculation, %1RM prescription, RPE-based loading, readiness flags) is baked in — not configured by users.
- Not a standalone product architecturally. It shares Platform Core infrastructure with AIS. One Supabase project, one auth layer, one athlete database.
- Not a periodisation tool. AIS owns the season plan. S&C Pro owns the session content. The session is the handoff point between them.
- Not a consumer fitness app. S&C Pro is built for performance sport organisations — national squads, academies, professional clubs — not individual gym-goers.

### 1.3 The Planning Continuum

S&C Pro completes the top-to-bottom planning chain that AIS begins. This is the core architectural principle that differentiates the platform from TrainHeroic:

```
4-Year Canvas (AIS)
  └── Annual Periodisation Canvas (AIS)
        └── Weekly Drill-Down (AIS)
              └── Session — the handoff point
                    └── Exercise Blocks (S&C Pro)
                          └── Exercise Prescriptions (S&C Pro)
                                └── Athlete Logs Actual (S&C Pro)
                                      └── Data feeds back up the chain
```

The session is accessible from both directions. A coach can drill down from the AIS annual canvas into a weekly view and click into a session to design it in S&C Pro. Or a coach can build a programme in S&C Pro and have those sessions automatically appear in the AIS weekly view for the corresponding dates.

---

## 2. Platform Architecture

### 2.1 Shared Infrastructure — Platform Core

The following tables belong to neither AIS nor S&C Pro. They are Platform Core — activated by either product, owned by the platform. A standalone S&C Pro customer and a standalone AIS customer both read and write these tables. They are the foundation of the unified experience.

| Table | Purpose | Owned By |
|---|---|---|
| `organisations` | Top-level org entity. Logo, theme, plan tier. | Platform Core |
| `teams` | Teams within an org. Sport, group linkage. | Platform Core |
| `users` | Staff and athlete accounts. Auth identity. | Platform Core |
| `athletes` | Athlete profiles. Photo, position, sport, DOB. | Platform Core |
| `athlete_teams` | Many-to-many: athletes to teams. | Platform Core |
| `groups` | Access scope containers between org and teams. | Platform Core |
| `roles / role_permissions / user_roles` | RBAC layer — what each user can do. | Platform Core |
| `sessions` | The join point. Date, time, team, periodisation link. | Platform Core (shared) |

> The sessions table is the critical shared table. AIS writes the session shell (date, time, team, phase context, periodisation plan link). S&C Pro writes the session content (exercise blocks, prescriptions, actual logs). Neither product owns it exclusively.

### 2.2 AIS-Owned Tables (S&C Pro reads, never writes)

- `assessment_sessions`, `assessment_results`, `test_definitions`, `benchmarks`
- `periodisation_plans`, `plan_rows`, `plan_cells`, `plan_templates`
- `camps`, `audit_log`, `dashboard_layouts`

### 2.3 S&C Pro-Owned Tables (AIS reads select fields, never writes)

- `programmes` — the programme container (name, sport, phase type, block structure)
- `programme_weeks` — weekly microcycle within a programme
- `programme_sessions` — session assignment within a week (links to shared sessions table)
- `session_blocks` — A/B/C blocks within a session (Warm-up, Main, Accessory, Cool-down)
- `session_exercises` — exercises within a block with full prescription
- `exercise_library` — org library + system defaults
- `athlete_1rm` — tested and estimated 1RM values per athlete per exercise
- `athlete_exercise_logs` — actual performance logged by athlete per set
- `loading_schemes` — saved set/rep/intensity schemes for reuse

### 2.4 The Three Integration Mechanisms

#### Mechanism 1 — Shared Database Reads

Both products point at the same Supabase project. S&C Pro reads athlete profiles, org/team data, and assessment results directly. AIS reads actual session volume and RPE from S&C Pro's logs directly. No API needed for reads. This is what makes the unified athlete profile and the load wave chart actual line possible.

#### Mechanism 2 — Platform Events

Cross-product writes happen through a shared `platform_events` table. Neither product writes directly into the other's owned tables. Events fire when something in one product needs to trigger a change in the other.

| Event | Fired By | Consumed By | Effect |
|---|---|---|---|
| `session_completed` | S&C Pro (athlete logs) | AIS | Updates Actual load in periodisation canvas load wave |
| `session_rpe_logged` | S&C Pro | AIS | Updates Actual RPE row in weekly view |
| `retest_result_added` | AIS (assessment) | S&C Pro | Flags 1RM profile for review / update loading zones |
| `taper_week_set` | AIS (periodisation) | S&C Pro | Flags sessions in that week for volume reduction review |
| `acwr_threshold_exceeded` | AIS (ACWR calc) | S&C Pro | Surfaces readiness warning on upcoming sessions (V2) |
| `programme_session_created` | S&C Pro | AIS | Session appears in AIS weekly drill-down view |

#### Mechanism 3 — Unified Navigation Shell

Both products share the same sidebar, header, auth cookie, and design tokens. The athlete or coach never knows they have moved between products. Navigation links cross between them. Subdomain routing for V1 (`ais.platform.com` / `pro.platform.com`). Shared monorepo shell in V3.

### 2.5 Standalone Operation

A standalone S&C Pro customer (no AIS) creates their org, teams, and athletes against Platform Core tables. The `periodisation_plan_id` foreign key on sessions is nullable — standalone sessions simply never populate it. All S&C Pro features work without AIS being active. The integration features unlock only when both modules are active for the org.

When an org adds their second product later — whether adding AIS to an existing S&C Pro account or adding S&C Pro to an existing AIS account — there is no migration. The Platform Core tables already contain all their athletes and teams. The new module activates and can immediately read existing data.

---

## 3. Database Schema

### 3.1 Core S&C Pro Tables

All tables follow the Three Rules from `AIS_Architecture_Guidelines.md`: `org_id` is mandatory and non-nullable on every table, all queries are scoped through `getCurrentUser()` from `src/lib/auth.js`, and no query returns all rows without team filtering.

#### `programmes`

```sql
id            uuid PK
org_id        uuid NOT NULL FK → organisations
name          text NOT NULL
sport         text
phase_type    enum (accumulation | intensification | realisation | transition | general)
training_age  enum (beginner | intermediate | advanced | elite)
difficulty    enum (low | moderate | high | very_high)
description   text
is_template   boolean DEFAULT false
created_by    uuid FK → users
created_at    timestamptz DEFAULT now()
```

#### `programme_weeks`

```sql
id              uuid PK
programme_id    uuid NOT NULL FK → programmes
org_id          uuid NOT NULL FK → organisations
week_number     integer NOT NULL
label           text          -- e.g. 'Week 1 — Accumulation'
notes           text
```

#### `sessions` (shared — Platform Core)

```sql
id                   uuid PK
org_id               uuid NOT NULL FK → organisations
team_id              uuid FK → teams
programme_week_id    uuid FK → programme_weeks  -- null if standalone
plan_cell_id         uuid FK → plan_cells       -- null if no AIS link
name                 text NOT NULL
session_date         date
session_time         time
venue                text
category             enum (strength | power | speed | conditioning | mobility | recovery | mixed)
coach_instructions   text
planned_duration_min integer
actual_duration_min  integer
planned_rpe          numeric(3,1)
actual_rpe           numeric(3,1)
is_published         boolean DEFAULT false
publish_at           timestamptz
created_by           uuid FK → users
created_at           timestamptz DEFAULT now()
```

#### `session_blocks`

```sql
id           uuid PK
session_id   uuid NOT NULL FK → sessions
org_id       uuid NOT NULL FK → organisations
label        text NOT NULL          -- e.g. 'A', 'B', 'Warm-up', 'Main'
block_type   enum (warmup | main | accessory | cooldown | conditioning | custom)
format       enum (straight | superset | circuit | emom | amrap | custom)
sort_order   integer NOT NULL
notes        text
```

#### `session_exercises`

```sql
id                   uuid PK
block_id             uuid NOT NULL FK → session_blocks
org_id               uuid NOT NULL FK → organisations
exercise_id          uuid FK → exercise_library
sort_order           integer NOT NULL
sets                 integer
-- Prescription type (one active per exercise, others null)
prescription_type    enum (absolute | pct_1rm | rpe | rir | velocity | max | time | distance | custom)
prescription_value   numeric          -- the target value (kg, %, rpe score, m/s, etc.)
reps                 integer
reps_range_high      integer          -- for rep ranges e.g. 8-12
tempo                text             -- e.g. '3-1-1-0'
rest_seconds         integer
is_optional          boolean DEFAULT false
coach_note           text
```

#### `exercise_library`

```sql
id                    uuid PK
org_id                uuid FK → organisations  -- null = system default
name                  text NOT NULL
movement_pattern      enum (push | pull | hinge | squat | carry | rotate | jump | sprint | isometric | custom)
primary_muscle_group  text
equipment_required    text[]
parameter_1           enum (reps | time | distance | calories)
parameter_2           enum (weight_kg | weight_pct | rpe | rir | velocity | none)
video_url             text
coaching_cues         text
reference_max_id      uuid FK → exercise_library  -- e.g. Paused Squat references Back Squat
suggested_swap_ids    uuid[]
tags                  text[]
is_system_default     boolean DEFAULT false
created_by            uuid FK → users
```

#### `athlete_1rm`

```sql
id             uuid PK
athlete_id     uuid NOT NULL FK → athletes
org_id         uuid NOT NULL FK → organisations
exercise_id    uuid NOT NULL FK → exercise_library
tested_1rm     numeric          -- from a formal 1RM test
working_max    numeric          -- recent best working weight
estimated_1rm  numeric          -- system-estimated from logged sets
test_date      date
source         enum (tested | estimated | coach_entered)
notes          text
```

#### `athlete_exercise_logs`

```sql
id              uuid PK
session_id      uuid NOT NULL FK → sessions
exercise_id     uuid NOT NULL FK → exercise_library
athlete_id      uuid NOT NULL FK → athletes
org_id          uuid NOT NULL FK → organisations
set_number      integer NOT NULL
actual_reps     integer
actual_weight   numeric
actual_rpe      numeric(3,1)
actual_rir      integer
actual_velocity numeric          -- m/s if VBT device used
completed       boolean DEFAULT false
notes           text
logged_at       timestamptz DEFAULT now()
```

---

## 4. Feature Modules

### 4.1 Programme Builder

The Programme Builder is the coach's primary authoring environment. The goal is speed — a coach should be able to build a full week of sessions for a 40-person squad in under 30 minutes, where the same task currently takes 2–3 hours in Excel.

#### Programme Library

- List view with columns: Name, Sport, Phase Type, Training Age, Team Usage, Last Used, Created By
- Folder organisation by sport and phase type — not a flat list
- Filter by: Sport, Phase Type (Accumulation / Intensification / Realisation / Transition), Training Age, Created By
- Actions per programme: Edit, Copy, Save as Template, Archive, Delete
- 'Create Programme' button opens a new programme with configurable name, sport, phase type, number of weeks
- Saved templates appear in a separate Templates tab — reusable across seasons and sports

#### Weekly Programme View

- Weeks displayed as tabs or a horizontal scroll — Week 1, Week 2, Week 3 etc.
- Each week shows a Mon–Sun grid of session slots
- Session cards on the grid show: session name, category badge, number of exercises, estimated duration
- Actions on session slot: Add Session, Add from Library, Copy from Previous Week, Leave Empty
- 'Copy Week' function to duplicate entire week structure with one click — primary time-saving feature
- Bulk assign programme to athletes: select athletes, assign — system auto-calculates their individual loads from their 1RM profiles

#### Session Builder

Three-panel layout on desktop — Navigation panel (left), Session Content (centre), Prescription panel (right).

Left panel: mini week calendar + session list for the current week. Clicking a session in the list navigates to it without leaving the builder.

Centre panel: Session header (date, name, category, coach instructions), then blocks stacked vertically. Each block has a label (A, B, C or Warm-up / Main / Accessory / Cool-down), a format tag (Straight Sets / Superset / Circuit / EMOM / AMRAP), and exercises listed below it.

Right panel: Prescription fields for the selected exercise. Sets, Reps (or range), Prescription Type selector, Prescription Value, Tempo, Rest. The prescription panel adapts based on the type selected — %1RM shows the calculated absolute load alongside the percentage. RPE shows a 1–10 selector. Velocity shows m/s target.

#### Exercise Search & Addition

- Search panel opens inline when adding an exercise to a block
- Results show: exercise name, movement pattern badge, equipment icons
- Filter by: Movement Pattern, Equipment Required, Muscle Group, Tags
- 'Recent' section at top showing coach's 10 most recently used exercises
- 'New Exercise' button creates a new exercise directly from within the builder — no leaving the session
- Suggested swaps visible on hover — pre-defined alternatives at exercise level

#### Individualisation — Template + Override Layer

This is the core architectural differentiator from TrainHeroic. Every programme is written as a template with relative prescriptions (%1RM, RPE, RIR, Max). The system auto-calculates each athlete's absolute load from their 1RM profile.

- Coach writes: 'Back Squat — 4 × 5 @ 80%'
- System calculates per athlete: Athlete A sees 100kg, Athlete B sees 80kg, Athlete C sees 115kg
- Override layer: coach can open any athlete's version of the session and override specific exercises
- Override types: exercise-level (change prescription for this athlete) or session-level (replace entire session for this athlete)
- Overrides stored separately — they never modify the template
- Override indicator on athlete card in compliance view — shows which athletes have active overrides
- Injured athlete workflow: mark exercise as 'modified' with a note — surfaces in the compliance view as a flag

### 4.2 Exercise Library

#### Three-Tier Structure

- System defaults — AIS-provided exercise library. Covers all major movement patterns across sports. Cannot be deleted by orgs, can be hidden.
- Org library — exercises created by the org's coaches. Visible to all staff within the org.
- One-time — exercises added directly to a session without saving to library. Useful for one-off variations.

#### Exercise Record

- Name (required)
- Movement Pattern (required) — Push / Pull / Hinge / Squat / Carry / Rotate / Jump / Sprint / Isometric / Custom
- Primary Muscle Group
- Equipment Required — multi-select (Barbell / Dumbbell / Cable / Machine / Band / Bodyweight / Kettlebell / Custom)
- Default Parameters — Parameter 1 (Reps / Time / Distance) + Parameter 2 (Weight kg / %1RM / RPE / RIR / Velocity / None)
- Video — YouTube, Vimeo URL, or uploaded file for org-specific technique demonstrations
- Coaching Cues — rich text field. Displayed to athlete in session view.
- Reference Max Exercise — links to another exercise whose 1RM is used for %1RM calculation (e.g. Paused Squat → Back Squat)
- Suggested Swaps — pre-defined alternatives. Athlete or coach can substitute without rebuilding session.
- Tags — free text, used for search
- Track As Exercise — contributes to personal record tracking for this exercise

### 4.3 Athlete Profile in S&C Pro

The athlete profile in S&C Pro is lightweight — it shows S&C-specific data only. When the AIS bundle is active, an additional Assessments tab appears showing AIS assessment classifications and radar chart data.

#### Strength Profile Tab (replaces TrainHeroic Circuits tab)

- Pinned key lifts at top: Back Squat, Bench Press, Deadlift, Power Clean, Pull-Up — configurable per org
- Each pinned lift shows: Tested 1RM (date), Working Max (date), Estimated 1RM (auto-calculated from logs)
- Full exercise history below — searchable, filterable by movement pattern
- 1RM trend chart per exercise — shows estimated 1RM over time (Lift Progress analytics)

#### Notes Tab

- Injury History — structured free text
- Movement Screen / FMS Results — structured free text
- Training Background — structured free text
- Modifications In Effect — flagged modifications that affect current programme delivery

#### Account Tab

- Email, unit preference (kg / lb), team and programme assignments, days since last login

#### Assessments Tab (AIS bundle only)

- AIS assessment classification badges and scores
- Radar chart from last assessment session
- Link to full AIS report

### 4.4 Coach Home Dashboard

#### Activity Feed — Exception First

Unlike TrainHeroic's chronological feed, S&C Pro surfaces exceptions first. Normal completions are below. The coach's first view tells them what needs attention today.

- PRIORITY: Athletes who logged actual RPE significantly above planned RPE (flag threshold: +2 points)
- PRIORITY: Athletes who missed a session without a logged reason
- PRIORITY: Athletes showing 3+ consecutive high-RPE sessions (fatigue accumulation flag — V2 with ACWR)
- NORMAL: Session completions with blocks done, readiness score, volume, intensity
- NORMAL: Personal records set in today's sessions

#### Needs Programming Widget

- Real-time list of athletes and teams with no sessions scheduled in the next 7 days
- One-click to open the programme builder for that team

#### Today's Sessions Summary

- Sessions scheduled for today across all teams — quick view of planned volume
- Live compliance tracker updating as athletes log throughout the day

### 4.5 Compliance Analytics

Six core analytics report types, each available at Single Athlete and Team/Group scope — mirroring TrainHeroic's structure but extended with AIS data where bundle is active.

| Report | Single Athlete | Team/Group | AIS Extension (bundle) |
|---|---|---|---|
| Compliance | Session completion rate, blocks done vs planned | Team heatmap — who logged by day | Phase compliance by periodisation block |
| Lift Progress | Estimated 1RM trend per exercise over time | Team strength percentile distribution | Assessment result overlay |
| Training Summary | Volume, intensity, RPE planned vs actual per week | Team average vs individual deviation | ACWR from AIS load wave |
| Performance (1RM) | Current working max + estimated 1RM per lift | Team strength profile table | Assessment classification alongside 1RM |
| Readiness (V2) | Composite score: wellness + CMJ + HRV + ACWR | Team readiness heatmap | ACWR contribution from AIS |
| Lift History | All logged sets — complete history | Team volume by exercise / movement pattern | N/A |

---

## 5. Prescription System

### 5.1 Prescription Types

All seven prescription types are supported on any exercise. The coach selects the type per exercise when building the session. Types can be combined — a single exercise can have both a %1RM prescription and an RPE target simultaneously.

| Type | Input | Athlete Sees | Auto-calc Source |
|---|---|---|---|
| Absolute | Coach enters kg/lb directly | 80kg × 5 | None — manually entered |
| %1RM | Coach enters percentage (e.g. 80%) | 80kg × 5 (= 80% of your 100kg 1RM) | `athlete_1rm.tested_1rm` or `estimated_1rm` |
| RPE | Coach enters RPE target (1–10) | Target RPE: 8/10 | None — self-regulated by athlete |
| RIR | Coach enters reps in reserve (e.g. 2) | Stop with 2 reps left in tank | None — self-regulated by athlete |
| Velocity | Coach enters m/s target | Target: 0.7 m/s mean concentric | VBT device or manual entry (V3) |
| Max | No value — go as hard as possible | MAX EFFORT | None — auto-records what athlete logs |
| Time | Coach enters duration (e.g. 00:45) | 45 seconds | None — time-based |

### 5.2 1RM Auto-Calculation Logic

When a coach prescribes %1RM, the system resolves the athlete's actual load using this priority order:

1. Tested 1RM — from a formal 1RM test recorded in `athlete_1rm` (most accurate)
2. Estimated 1RM — auto-calculated from logged sets using Epley formula (`weight × (1 + reps/30)`)
3. Coach-entered working max — manually set by coach for new athletes without logging history
4. No data — system displays the percentage without an absolute value. Athlete self-selects. System prompts athlete to log their working weight so the estimate can be built.

Reference Max linkage: If an exercise has a Reference Max Exercise defined (e.g. Paused Back Squat → Back Squat), the system uses the referenced exercise's 1RM for the calculation. This allows %1RM prescription on variations without requiring a separate 1RM test for each variation.

---

## 6. Athlete Experience

### 6.1 Athlete Session View

The athlete opens the app and sees today's session. The view is clean, confident, and action-oriented. No coaching workflow states, no internal planning data, no ACWR values — following the same visibility rules defined in `AIS_Settings_Backlog.md`.

#### Today View

- Session name, category badge, date, venue
- Periodisation context strip (bundle only): Week number, Phase name, Week focus — pulled from AIS canvas
- Coach instructions at the top
- Blocks listed in order. Each block shows its label and format.
- Exercises within each block show: exercise name, sets × reps, prescribed load (calculated for this athlete), rest period
- Exercise thumbnail/video accessible on tap
- Coaching cues accessible on tap
- 'LAST' section per exercise: what this athlete did the last time this exercise appeared

#### Logging Flow

- Athlete taps 'Start Session' — timer begins
- Logging is set-by-set. After each set, athlete enters: actual reps completed, actual weight used
- RPE captured at set level (optional) and session level (required on session complete)
- If actual weight differs significantly from prescribed: system notes the deviation (visible to coach in compliance view)
- 'Complete Session' button at bottom — fires `session_completed` event to AIS

#### Week View

- Athlete can view other scheduled sessions in the current week
- Future sessions shown in read-only preview mode — no logging until session date
- Past sessions shown with completion indicator and logged data

### 6.2 What Athletes Never See

Following the visibility rules from `AIS_Settings_Backlog.md`, the following are never shown to athletes in S&C Pro or in exported content:

| Hidden Element | Reason |
|---|---|
| ACWR values | Load monitoring tool — can cause anxiety or gaming |
| Coach override indicators | Internal workflow state |
| 1RM estimates from other athletes | Privacy |
| Compliance percentage across team | Potentially demotivating or competitive in wrong direction |
| Planned vs actual volume discrepancy flags | Internal coach monitoring tool |
| Week notes from AIS canvas | May contain selection, tactical, or medical commentary |

Gate each hidden element with: `can('programme', 'viewCoachingData')` — same pattern as AIS periodisation coaching data visibility.

---

## 7. Commercial Tiers & Module Activation

### 7.1 Tier Structure

| Tier | Includes | Integration Features |
|---|---|---|
| AIS Only | Assessment, reports, periodisation canvas, squad dashboard | None |
| S&C Pro Only | Programming, exercise library, 1RM profiles, athlete logging, compliance | None — sessions have no periodisation link |
| Bundle (AIS + S&C Pro) | Both products fully active | Full planning continuum, sessions join point active, platform events firing, AIS data in S&C Pro athlete profile, unified athlete portal |

### 7.2 Module Activation

Modules are activated at org level. When an org purchases a second module, no data migration is required. Platform Core tables already contain all athletes, teams, and users. The new module activates and reads existing data immediately.

The sessions table `plan_cell_id` foreign key is nullable. Standalone S&C Pro sessions never populate it. When both modules are active, the sessions created by S&C Pro can be linked to plan cells in the AIS canvas — either automatically (programme dates align with canvas dates) or manually by the coach.

---

## 8. Version Scope Gates

### 8.1 S&C Pro V1 — Programme Authoring and Delivery

Scope: Solve the primary pain point — building programmes takes too long. Deliver individually-calculated sessions to 30–60 athletes. Make compliance visible.

| In Scope | Out of Scope |
|---|---|
| Programme builder — sessions, blocks, exercises | Readiness-informed load adjustment |
| All prescription types (absolute, %1RM, RPE, RIR, Max, time) | Force plate integration |
| Exercise library — system defaults + org library | HRV / Whoop integration |
| Athlete 1RM profiles (tested, estimated, coach-entered) | Velocity capture via app |
| Template + per-athlete override layer (exercise + session level) | GPS / Strava conditioning data |
| Athlete logging — actual load, reps, RPE per set | AI programme generation |
| Coach compliance view — planned vs actual, exception-first feed | VBT device integration |
| AIS integration — session link, RPE feeds to load wave | S&C Pro mobile app (web only in V1) |
| Unified navigation shell — same sidebar, same auth | |
| Programme templates — save and reuse across seasons and sports | |
| Needs Programming dashboard widget | |

### 8.2 S&C Pro V2 — Readiness Layer

- Wellness questionnaire — morning athlete check-in (sleep, mood, soreness, energy)
- Force plate CMJ integration — manual entry first, API later (GymAware, Hawkin Dynamics)
- HRV integration — Whoop, Polar, Garmin via API
- Composite readiness score: wellness + CMJ delta + HRV + ACWR from AIS
- Load auto-adjustment suggestions based on readiness — coach approves, never auto-applies
- Strava / GPS import for conditioning sessions — actual distance, pace, HR zones
- Readiness heatmap analytics — team readiness by day

### 8.3 S&C Pro V3 — Velocity and Intelligence

- VBT device integration — GymAware, Output, or phone-based velocity capture
- Velocity-based load auto-regulation within session
- Force-velocity profile per athlete — auto-built from VBT logs
- AI-assisted programme generation based on athlete profile + periodisation phase + assessment data
- Estimated 1RM auto-update from velocity data (no formal re-test required)
- Mobile app with touch-optimised logging interface

---

## 9. Screens & Navigation Map

### 9.1 Coach-Side Navigation (S&C Pro)

| Screen | Primary Purpose | Key Actions |
|---|---|---|
| Home | Activity feed + compliance overview | Exception-first feed, Needs Programming widget, today's session summary |
| Programme Library | Browse, create, manage programmes | Create, copy, assign to team, save as template, filter |
| Programme Builder | Author sessions within a programme | Week tabs, session grid, drag-drop, copy week |
| Session Builder | Design individual session content | Add block, add exercise, set prescriptions, publish |
| Exercise Library | Browse and manage exercise database | Search, filter by movement/equipment, create new, edit |
| Athletes | Roster + athlete profiles | View 1RM profile, strength history, notes, override status |
| Analytics | Compliance, progress, lift history | Report type selector, single/team scope, date range |
| Settings | Org config, library settings | Unit preference, week start day, library visibility |

### 9.2 Athlete-Side Navigation (S&C Pro)

| Screen | Primary Purpose |
|---|---|
| Today | Current session with logging interface |
| This Week | Read-only preview of all sessions this week |
| History | Past sessions with logged data |
| Profile | Personal records, 1RM history, progress charts |

### 9.3 Integration Points with AIS Navigation

- AIS sidebar includes 'Programme' link when S&C Pro module is active → opens S&C Pro Programme Library
- AIS weekly drill-down session cell includes 'Design Session →' button → opens S&C Pro Session Builder pre-loaded with that session
- S&C Pro sidebar includes 'Periodisation' link when AIS module is active → opens AIS Periodisation Canvas
- S&C Pro athlete profile Assessments tab → opens AIS athlete report when bundle active

---

## 10. TrainHeroic Reference Analysis

### 10.1 What We Keep From TrainHeroic

- Weekly calendar as primary coach view
- Three-panel session builder: navigation / content / prescription
- Block-based session structure with labelled blocks (A, B, C)
- Exercise library with video, coaching cues, suggested swaps, reference max linkage
- LAST performance display in session builder (athlete sees previous session data)
- Save to Library from calendar context menu — coach builds session, it works, saves for reuse
- Compliance analytics: team-level planned vs actual
- Lift progress over time (estimated 1RM trend chart)
- Needs Programming dashboard widget
- Days since last login on athlete roster
- Athlete notes (injury history, modifications)

### 10.2 What We Build Better

- Prescription system: all types simultaneously (sets × reps × %1RM × RPE × RIR × velocity) — TrainHeroic supports one type at a time per exercise
- Exercise taxonomy: movement pattern + equipment + muscle group filter hierarchy — TrainHeroic uses a flat unorganised tag cloud
- Programme library: organised by sport / phase type / training age — TrainHeroic is a flat list
- Analytics: planned vs actual volume/RPE, composite readiness (V2), AIS assessment results integrated — TrainHeroic has no periodisation or assessment context
- Athlete profile: 1RM profile with pinned key lifts, AIS assessment tab in bundle — TrainHeroic's Circuits tab is irrelevant for performance sport
- Activity feed: exception-first (low readiness, RPE spikes, missed sessions) — TrainHeroic is purely chronological
- Calendar context menu: 'Link to periodisation cell' action — TrainHeroic has no periodisation layer

### 10.3 What We Replace Entirely

- Parent Calendars → AIS Periodisation Canvas. TrainHeroic's 'parent calendar' is a workaround for not having a real periodisation layer. We replace it with the AIS canvas sitting above the weekly view.
- Manual 'Publish All' → Auto-publish with configurable timing. Same philosophy as AIS autosave — save on change, not on button press.
- Readiness (questionnaire score only) → Composite readiness score in V2: wellness + CMJ + HRV + ACWR. TrainHeroic's readiness is entirely self-reported with no objective data.
- Circuits tab on athlete profile → Strength Profile. TrainHeroic's circuits tab tracks CrossFit-style named workout PRs. Irrelevant for performance sport. Replaced with key lift history and 1RM trend.

### 10.4 Unique to S&C Pro — No TrainHeroic Equivalent

- Periodisation phase context on every session — week number, phase name, peaking index (AIS bundle)
- Drill-down from AIS annual canvas → weekly → session → S&C Pro session builder
- Template + per-athlete override layer at exercise and session level
- Assessment results feeding into athlete profile — AIS assessment classification alongside 1RM history
- ACWR from AIS feeding into readiness flag on session (V2)
- Bidirectional session link: build in S&C Pro → sessions appear in AIS canvas. Build in AIS → sessions pre-loaded in S&C Pro.
- Platform events — cross-product intelligence: taper week flags volume reduction, re-test updates loading zones

---

## 11. Architecture Compliance Checklist

All S&C Pro development must pass the AIS Pre-Development Checklist (Section 9 of `AIS_Architecture_Guidelines.md`) in addition to the following S&C Pro-specific checks:

### 11.1 Data & Queries

- Every Supabase query includes `.eq('org_id', user.orgId)`
- Every team-scoped query includes `.in('team_id', user.teamIds)`
- Identity imported from `src/lib/auth.js` — zero hardcoded IDs
- Every new table has `org_id` as non-nullable
- Raw values stored — derived display values (estimated 1RM, load calculations) computed at read time
- `athlete_1rm` stores `source` enum (tested / estimated / coach_entered) — never just a number without provenance

### 11.2 Integration Rules

- S&C Pro never writes directly to AIS-owned tables — only through `platform_events`
- AIS never writes directly to S&C Pro-owned tables — only through `platform_events`
- `sessions` table is the only shared write surface — both products may write to it within their defined fields
- `plan_cell_id` on sessions is always nullable — never required, never assumed present

### 11.3 Athlete Visibility

- `can('programme', 'viewCoachingData')` gates all coaching-internal elements
- ACWR, override indicators, team compliance data, coach notes never shown to athlete role
- Athlete export / athlete view defaults to clean, action-oriented display

### 11.4 Version Gate

- Readiness composite score, force plate integration, HRV integration — V2. Not partially implemented in V1.
- VBT device integration, velocity auto-regulation, AI generation — V3. Not partially implemented in V2.
- Stub pattern: `src/lib/readiness.js` created in V1 with hardcoded defaults. Swapped for real logic in V2.

---

## 12. Implementation Sequence

### When to Start S&C Pro

> S&C Pro development begins only after AIS V1.5 (Periodisation canvas) is stable. The Session Planner built in AIS V1.5 is the foundation that S&C Pro's session builder extends. Building both simultaneously would create messy interdependencies before either is settled.

### Recommended Build Sequence (S&C Pro V1)

1. **Platform Core extension** — add sessions table, confirm shared tables are stable
2. **RBAC extension** — add 'programme' resource to role_permissions. Add viewCoachingData permission to Staff role.
3. **Exercise library** — schema + seed system defaults + org library UI
4. **Athlete 1RM profiles** — schema + UI (tested, working max, coach-entered)
5. **Programme builder** — programme library + weekly view + session builder + exercise prescription
6. **Individualisation engine** — %1RM auto-calculation, per-athlete load rendering
7. **Override layer** — exercise-level and session-level athlete overrides
8. **Athlete logging** — session view, set-by-set logging, session complete flow
9. **Compliance view + analytics** — planned vs actual, exception-first feed, lift progress
10. **AIS integration** — platform_events table, session_completed and session_rpe_logged events wired to AIS load wave
11. **Unified navigation shell** — shared sidebar, AIS ↔ S&C Pro navigation links active
12. **Programme templates** — save, reuse, assign to new season / sport

---

*S&C Pro — Strength & Conditioning Programming Platform · Architecture & Product Requirements v1.0 · Ranjit Nahak · April 2026*

*Confidential — Internal Use Only · Companion to AIS_Architecture_Guidelines.md and AIS_Architecture_Context.md*
