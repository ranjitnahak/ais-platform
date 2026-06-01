# AIS — Build Sprint Milestone Document
**Sprint:** Tuesday 27 May → Thursday 29 May 2026  
**Author:** Ranjit Nahak, Strength & Conditioning Coach  
**Status:** Active — Living Document  
**Last updated:** 27 May 2026

---

## How to Use This Document

**For Claude Code:** Read this document at the start of every session. Check off milestones as they complete. Add blockers if encountered. Never skip a GATE milestone — they are verification checkpoints, not optional steps.

**For Cursor:** Read the relevant day's section before starting any task. Each milestone specifies the exact files to touch. Do not modify files outside the scope of the active milestone.

**For Claude.ai:** This document is the orchestration reference. All SQL is reviewed here before execution. All architecture decisions are recorded here.

**The Three Rules — enforced on every line of code written this sprint:**
1. Every Supabase query includes `.eq('org_id', user.orgId)`
2. Identity always from `src/lib/auth.js` — zero hardcoded IDs anywhere
3. Every team-scoped query includes `.in('team_id', user.teamIds)`

**Architecture docs to read before any session:**
- `ais/docs/AIS_Architecture_Guidelines.md` — how everything must be built
- `ais/docs/AIS_Architecture_Context.md` — what is currently built
- `ais/docs/AIS_Pending_Items.md` — outstanding items and known debt

---

## Sprint Goal

By end of Thursday 29 May, the following must be true:

- Real authentication works for all four user types (Superuser, Admin, Staff, Athlete)
- RBAC is enforced — every feature is permission-gated, every data query is scoped
- RLS is re-enabled in Supabase — the database enforces tenant isolation at the row level
- Athletes can log RPE after sessions
- Athletes can submit daily wellness check-ins
- Coaching staff can view RPE and wellness data for their assigned athletes
- The Unified Athlete Intelligence Report generates on demand, respects role visibility, and exports to PDF
- Admin panel allows user management and role assignment
- Superuser panel allows feature flag control per org
- All 15+ data scoping violations from the compliance audit are fixed
- No hardcoded org IDs or user IDs remain anywhere in the codebase

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

## Tuesday 27 May — Foundation

**Day goal:** Data integrity fixed. All new schemas in database. Supabase Auth enabled. Nothing visible to users changes, but the ground is solid for everything that follows.

**Tooling:** Claude Code for SQL and file fixes. Claude.ai for SQL review before execution.

---

### Block T-A: Emergency Data Integrity Fixes
*Assign to: Claude Code*  
*Estimated time: 1 hour*  
*These must be the very first thing done today — they are live data risks.*

| # | Milestone | File | Status | Notes |
|---|-----------|------|--------|-------|
| T-01 | Remove hardcoded `ORG_ID` constant from `AddAthleteModal.jsx` — replace with `getCurrentUser().orgId` imported from `src/lib/auth.js` | `ais/src/components/athletes/AddAthleteModal.jsx` | ⬜ | Rule 2 violation. New athletes currently created against hardcoded org. |
| T-02 | Remove hardcoded org UUID from `Reports.jsx` — replace with `getCurrentUser().orgId` | `ais/src/pages/Reports.jsx` | ⬜ | Rule 2 violation. Reports query running against wrong org. |
| T-03 | Add `.eq('org_id', user.orgId)` to all four queries in `SquadDashboard.jsx` — athletes, assessment_sessions, assessment_results, benchmarks | `ais/src/components/dashboard/SquadDashboard.jsx` | ⬜ | All reads currently unscoped. |

**Verification after T-01 to T-03:** Claude Code runs a grep across entire `ais/src/` and `sc-pro/src/` for any remaining hardcoded UUID strings matching the default org pattern (`a1000000`). Zero results expected.

---

### Block T-B: SQL Schema Design and Review
*Assign to: Claude.ai (review) then Claude Code (execution)*  
*Estimated time: 2 hours*  
*ALL SQL must be reviewed in Claude.ai before Claude Code executes it in Supabase.*

| # | Milestone | Status | Notes |
|---|-----------|--------|-------|
| T-04 | Draft and review: RBAC tables SQL — `roles`, `role_permissions`, `user_roles`, `groups`, `group_members` | ⬜ | Review in Claude.ai first. Four boolean CRUD columns on role_permissions: can_view, can_create, can_edit, can_delete. |
| T-05 | Draft and review: Feature flags SQL — `org_feature_flags` table | ⬜ | feature_key values: 'assessments', 'periodisation', 'sc_pro', 'wellness', 'injury_surveillance', 'athlete_portal', 'rpe_logging', 'ai_assistant', 'unified_reports' |
| T-06 | Draft and review: RPE logging SQL — `session_athlete_logs` table | ⬜ | One row per athlete per session. Includes session_load (rpe × duration, pre-computed). UNIQUE(session_id, athlete_id). |
| T-07 | Draft and review: Wellness SQL — `wellness_form_items`, `wellness_logs`, `wellness_thresholds` tables | ⬜ | JSONB responses column. Configurable per org. Composite score computed on insert. |
| T-08 | Draft and review: Staff notes SQL — `athlete_staff_notes` table | ⬜ | domain as text (not enum). is_flagged boolean. |
| T-09 | Draft and review: Unified reports SQL — `athlete_reports`, `team_reports`, `report_access_grants` tables | ⬜ | Sections as separate JSONB columns. share_token for external PDF access. |
| T-10 | Draft and review: RLS policy set — policies for every existing table plus all new tables | ⬜ | This is the most critical SQL of the sprint. Every policy reviewed line by line before execution. |

---

### Block T-C: Schema Execution in Supabase
*Assign to: Claude Code*  
*Estimated time: 1 hour*  
*Only execute after Claude.ai has reviewed every SQL block in T-04 to T-10.*

| # | Milestone | Status | Notes |
|---|-----------|--------|-------|
| T-11 | Add `auth_id uuid UNIQUE REFERENCES auth.users(id)` column to `users` table | ⬜ | Nullable for now — existing rows don't have auth yet. |
| T-12 | Add `is_active boolean NOT NULL DEFAULT true` to `users` table | ⬜ | |
| T-13 | Execute RBAC tables migration (from T-04) | ⬜ | Verify tables exist with correct columns after execution. |
| T-14 | Execute feature flags migration (from T-05) | ⬜ | |
| T-15 | Execute RPE logging migration (from T-06) | ⬜ | |
| T-16 | Execute wellness migrations (from T-07) | ⬜ | |
| T-17 | Execute staff notes migration (from T-08) | ⬜ | |
| T-18 | Execute unified reports migration (from T-09) | ⬜ | |
| T-19 | Enable Supabase Auth in project settings | ⬜ | Email/password provider. Confirm email optional for V2 — disable for now so onboarding is frictionless. |
| T-20 | Seed default roles for IIS org — S&C Coach, Physio, Analyst, Head Coach, Admin, Athlete | ⬜ | SQL insert into roles table with is_system = true. Default role_permissions seeded with sensible defaults per role. |
| T-21 | Seed Haryana Steelers wellness form items — all 10 items from Smartabase form | ⬜ | fatigue, soreness, sleep_quality, sleep_hours, mood, motivation, performance_satisfaction, plan_adherence, gut_health, soreness_areas. |
| T-22 | Seed org_feature_flags for IIS org — enable all features | ⬜ | All features enabled for the existing org so nothing breaks for current users. |

**GATE T: Before ending Tuesday**  
Claude Code runs verification queries:
```sql
-- Verify all new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'roles','role_permissions','user_roles','groups','group_members',
  'org_feature_flags','session_athlete_logs','wellness_form_items',
  'wellness_logs','wellness_thresholds','athlete_staff_notes',
  'athlete_reports','team_reports','report_access_grants'
);
-- Expected: 14 rows

-- Verify auth_id column added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'auth_id';

-- Verify default roles seeded
SELECT name FROM roles WHERE org_id = 'a1000000-0000-0000-0000-000000000001';

-- Verify wellness items seeded
SELECT COUNT(*) FROM wellness_form_items 
WHERE org_id = 'a1000000-0000-0000-0000-000000000001';
-- Expected: 10
```

**End of Tuesday status:** ⬜ All T milestones complete

---

## Wednesday 28 May — Authentication, Scoping Fixes, RLS, Data Entry

**Day goal:** Real login works for all role types. All 15+ scoping violations fixed. RLS enforced. Athletes can log RPE and wellness. Admin can manage users and roles.

**Tooling:** Claude Code for compliance sweep and SQL. Cursor for all UI components. Both running in parallel where possible.

---

### Block W-A: Real Authentication — Replace the Stub
*Assign to: Claude Code + Cursor*  
*Estimated time: 3 hours*  
*This is the most critical block of the sprint. W-05 must be verified before anything else proceeds.*

| # | Milestone | File(s) | Tool | Status | Notes |
|---|-----------|---------|------|--------|-------|
| W-01 | Build login page — email/password form, Supabase Auth signIn, redirect on success | `ais/src/pages/Login.jsx` (new) | Cursor | ⬜ | Dark theme, charcoal + orange. No registration — users are invited by admin. |
| W-02 | Build password reset page — enter email, receive reset link | `ais/src/pages/ResetPassword.jsx` (new) | Cursor | ⬜ | |
| W-03 | Add auth route guards to `App.jsx` — unauthenticated users redirect to login | `ais/src/App.jsx` | Cursor | ⬜ | |
| W-04 | Replace `auth.js` stub — `getCurrentUser()` now reads real Supabase session, queries users + user_roles + role_permissions, returns real orgId, teamIds, permissions | `ais/src/lib/auth.js` | Claude Code | ⬜ | This is the most important file change of the sprint. Review output carefully before testing. |
| W-05 | Replicate auth.js replacement for S&C Pro | `sc-pro/src/lib/auth.js` | Claude Code | ⬜ | Same pattern, same file, sc-pro copy. |

**GATE W-A: Auth verification**  
Before proceeding to W-06, manually verify:
- [ ] Can log in with a real email/password
- [ ] `getCurrentUser()` returns correct `id`, `orgId`, `role`, `teamIds`
- [ ] Refreshing the page keeps the session
- [ ] Logging out clears the session and redirects to login
- [ ] A user with no matching `users` row gets a clear error, not a blank screen

**Do not proceed to W-06 until this gate is passed.**

---

### Block W-B: Compliance Sweep — Fix All Scoping Violations
*Assign to: Claude Code*  
*Estimated time: 2-3 hours*  
*Run as one orchestrated pass. Claude Code reads each file, applies the fix, verifies the import, moves to next.*

**AIS violations:**

| # | Milestone | File | Violation | Status |
|---|-----------|------|-----------|--------|
| W-06 | Add org_id + team_id scoping | `ais/src/pages/Athletes.jsx` | Missing org_id on athletes, athlete_teams, assessment_sessions, assessment_results | ⬜ |
| W-07 | Add org_id scoping to athlete load/update/assessment reads | `ais/src/pages/AthleteProfile.jsx` | Missing org_id on multiple queries | ⬜ |
| W-08 | Fix athlete_teams insert scoping | `ais/src/components/athletes/AddAthleteModal.jsx` | athlete_teams insert has no org scoping (T-01 fixed ORG_ID — this fixes the remaining insert) | ⬜ |
| W-09 | Fix plan_templates query — replace .or() with .eq('org_id') + fix athlete_teams read | `ais/src/pages/Periodisation.jsx` | .or() pattern not approved for this table | ⬜ |
| W-10 | Add org_id to athlete_teams member load/insert/delete + teams update | `ais/src/components/settings/TeamDetailModal.jsx` | athlete_teams and teams update unscoped | ⬜ |
| W-11 | Fix session_library_items query — document .or() as approved exception | `ais/src/components/periodisation/PeriodisationWeekly.jsx` | system defaults have null org_id — approved pattern, needs comment | ⬜ |
| W-12 | Add team_id filter to plan_rows and plan_cells queries | `ais/src/lib/athleteTeamPlanSync.js` | Rule 3 violation | ⬜ |
| W-13 | Add team_id filter to plan_rows and plan_cells queries | `ais/src/hooks/usePeriodisationPlan.js` | Rule 3 violation | ⬜ |
| W-14 | Add org_id to athlete_teams member-count query | `ais/src/pages/Settings.jsx` | Missing org scoping | ⬜ |

**S&C Pro violations:**

| # | Milestone | File | Violation | Status |
|---|-----------|------|-----------|--------|
| W-15 | Add org_id to session_exercises select/update in saveCell() | `sc-pro/src/hooks/useProgressionView.js` | Missing org filter on UPDATE — was causing 0-row matches | ⬜ |
| W-16 | Document exercise_library .or() pattern as approved exception | `sc-pro/src/pages/SessionBuilder.jsx` | System defaults have null org_id — approved pattern | ⬜ |
| W-17 | Add org_id to athlete_teams roster query | `sc-pro/src/hooks/useSessionData.js` | Missing org filter | ⬜ |
| W-18 | Document exercise_library .or() pattern as approved exception | `sc-pro/src/lib/programmeImporter.js` | Same approved pattern | ⬜ |
| W-19 | Document exercise_library .or() pattern as approved exception | `sc-pro/src/lib/assistantActions.js` | Same approved pattern | ⬜ |
| W-20 | Document exercise_library .or() and exercise_tags pattern | `sc-pro/src/lib/exerciseCategoryUtils.js` | Same approved pattern | ⬜ |
| W-21 | Add org_id to athlete_teams roster query | `sc-pro/src/components/AssignProgrammeModal.jsx` | Missing org filter | ⬜ |
| W-22 | Add org_id to athlete_teams lookup | `sc-pro/src/hooks/useProgrammeAssignment.js` | Missing org filter | ⬜ |
| W-23 | Add team_id filter to programmes and programme_weeks queries | `sc-pro/src/hooks/useProgrammeDetailPage.js` | Rule 3 violation | ⬜ |
| W-24 | Add team_id filter to session_blocks and session_exercises | `sc-pro/src/lib/programmeWeeklyCopy.js` | Rule 3 violation | ⬜ |
| W-25 | Add team_id filter to programmes and programme_weeks | `sc-pro/src/hooks/useProgrammesLibrary.js` | Rule 3 violation | ⬜ |
| W-26 | Add team_id filter to programmes | `sc-pro/src/hooks/useAgentExecution.js` | Rule 3 violation + undocumented feature | ⬜ |
| W-27 | Add team_id filter to sessions | `sc-pro/src/lib/sessionClipboardPaste.js` | Rule 3 violation | ⬜ |
| W-28 | Add team_id filter to organisations, sessions, programme_weeks, session_blocks | `sc-pro/src/lib/programmePDFData.js` | Rule 3 violations | ⬜ |
| W-29 | Add team_id filter to programmes | `sc-pro/src/lib/fetchProgrammesForAthlete.js` | Rule 3 violation | ⬜ |
| W-30 | Add team_id filter to sessions | `sc-pro/src/lib/duplicateProgrammeSession.js` | Rule 3 violation | ⬜ |
| W-31 | Add team_id filter to sessions bulk copy | `sc-pro/src/lib/sessionBulkOps.js` | Rule 3 violation | ⬜ |
| W-32 | Add team_id filter to SESSION_PREVIEW_SELECT | `sc-pro/src/components/SessionPreviewPanel.jsx` | Rule 3 violation | ⬜ |

**Verification after W-06 to W-32:**
Claude Code runs:
```bash
# No hardcoded org UUIDs anywhere
grep -r "a1000000" ais/src/ sc-pro/src/
# Expected: zero results

# No hardcoded user UUIDs anywhere  
grep -r "u1000000" ais/src/ sc-pro/src/
# Expected: zero results (auth.js stub lines are now replaced)

# Every file that queries Supabase imports from auth.js
grep -rL "from.*auth" ais/src/ sc-pro/src/ | grep -v node_modules
# Review output — any file with a supabase query must import auth
```

---

### Block W-C: Enable RLS
*Assign to: Claude Code*  
*Estimated time: 30 minutes + 30 minutes verification*  
*This is a GATE. Do not proceed until verification passes.*

| # | Milestone | Status | Notes |
|---|-----------|--------|-------|
| W-33 | Apply RLS policies to all tables (from T-10, reviewed SQL) | ⬜ | Execute via Supabase CLI or dashboard SQL editor. |
| W-34 | Verify existing screens still work — smoke test all major routes | ⬜ | Athletes, Reports, SquadDashboard, Periodisation, S&C Pro Programmes, Session Builder. |

**GATE W-C: RLS verification**
- [ ] Log in as staff user — Athletes page loads with correct data
- [ ] Reports page shows correct athletes
- [ ] SquadDashboard shows correct data
- [ ] Periodisation canvas loads
- [ ] S&C Pro programme list loads
- [ ] Session builder loads
- [ ] No console errors about missing data or 0-row returns

**If any screen fails:** Stop, do not proceed, diagnose the failing RLS policy before continuing. A broken screen means a policy is too restrictive. Add the missing condition, re-test.

---

### Block W-D: Admin Panel
*Assign to: Cursor*  
*Estimated time: 2 hours*

| # | Milestone | File(s) | Status | Notes |
|---|-----------|---------|--------|-------|
| W-35 | Admin panel page scaffold — route, sidebar link (Admin role only), layout | `ais/src/pages/Admin.jsx` (new) | ⬜ | Gated: can('adminConfig', 'view') |
| W-36 | User list tab — all users in org, their role, their team assignments, last active | `ais/src/components/admin/UserList.jsx` (new) | ⬜ | |
| W-37 | Invite user flow — enter email, select role, select team(s), send invite | `ais/src/components/admin/InviteUserModal.jsx` (new) | ⬜ | Creates pending user row, triggers Supabase Auth invite email |
| W-38 | Role permissions grid — per role, per resource, CRUD checkboxes | `ais/src/components/admin/RolePermissionsGrid.jsx` (new) | ⬜ | Saves to role_permissions table. Admin only. |
| W-39 | Team/group management — create teams, assign users to teams | `ais/src/components/admin/TeamManagement.jsx` (new) | ⬜ | |

---

### Block W-E: RPE Logging
*Assign to: Cursor (UI) + Claude Code (data hook)*  
*Estimated time: 2 hours*

| # | Milestone | File(s) | Tool | Status | Notes |
|---|-----------|---------|------|--------|-------|
| W-40 | RPE logging hook — fetch athlete's sessions for today, submit log to session_athlete_logs | `ais/src/hooks/useRPELog.js` (new) | Claude Code | ⬜ | Queries sessions by team_id and date. UNIQUE constraint handles duplicate submit gracefully. |
| W-41 | Athlete RPE form — session name, RPE slider (CR10: 0-10), duration (minutes), submit | `ais/src/pages/AthleteHome.jsx` (new) | Cursor | ⬜ | Mobile-first. Athlete sees only their sessions for today. |
| W-42 | Coach RPE view — per session, list of athletes with planned RPE vs logged actual RPE | `ais/src/components/sessions/SessionRPEView.jsx` (new) | Cursor | ⬜ | Gated: can('assessments', 'view'). Athletes see only their own row. |

---

### Block W-F: Wellness Check-in
*Assign to: Cursor (UI) + Claude Code (data hook)*  
*Estimated time: 2 hours*

| # | Milestone | File(s) | Tool | Status | Notes |
|---|-----------|---------|------|--------|-------|
| W-43 | Wellness hook — fetch org's form items, submit to wellness_logs, compute composite score | `ais/src/hooks/useWellness.js` (new) | Claude Code | ⬜ | Form items ordered by sort_order, filtered is_active = true. |
| W-44 | Athlete wellness form — renders dynamically from wellness_form_items, slider/radio/number inputs | `ais/src/pages/AthleteHome.jsx` (extend W-41) | Cursor | ⬜ | One submission per day enforced (UNIQUE constraint). Bilingual label support from label_translations jsonb. |
| W-45 | Coach wellness dashboard — today's submissions, composite score per athlete, flag indicators | `ais/src/components/wellness/WellnessDashboard.jsx` (new) | Cursor | ⬜ | Gated: can('wellness', 'view'). Shows only athletes in user's teamIds. |
| W-46 | Wellness trend micro-chart per athlete — 7-day composite score sparkline | `ais/src/components/wellness/WellnessTrend.jsx` (new) | Cursor | ⬜ | Used inside WellnessDashboard and AthleteProfile. |

**GATE W: End of Wednesday**
- [ ] Login works for all role types
- [ ] All 27 scoping violations fixed (W-06 to W-32)
- [ ] RLS live and all screens passing smoke test
- [ ] Admin can invite users and assign roles
- [ ] Athlete can log RPE after a session
- [ ] Athlete can submit wellness check-in
- [ ] Coach can see RPE and wellness data for their team

**End of Wednesday status:** ⬜ All W milestones complete

---

## Thursday 29 May — Unified Reports, Superuser Panel, Polish

**Day goal:** AI report generates on demand with role-based content. PDF exports. Team report works. Superuser controls feature flags. System is commercially ready.

**Tooling:** Claude Code for AI integration and data assembly. Cursor for report UI and PDF template.

---

### Block TH-A: Staff Notes
*Assign to: Cursor (UI) + Claude Code (hook)*  
*Estimated time: 1 hour*

| # | Milestone | File(s) | Tool | Status | Notes |
|---|-----------|---------|------|--------|-------|
| TH-01 | Staff notes hook — fetch notes for athlete filtered by viewer's domain permissions, submit new note | `ais/src/hooks/useStaffNotes.js` (new) | Claude Code | ⬜ | A physio can only write domain='physio'. Admin sees all domains. |
| TH-02 | Staff notes panel — per athlete, domain sections, add note form, flagging | `ais/src/components/reports/StaffNotesPanel.jsx` (new) | Cursor | ⬜ | Gated per domain. Each domain section only visible to permitted roles. |

---

### Block TH-B: Unified Report — Data Assembly and AI Synthesis
*Assign to: Claude Code*  
*Estimated time: 2 hours*

| # | Milestone | File(s) | Status | Notes |
|---|-----------|--------|--------|-------|
| TH-03 | Data assembly function — queries all data sources for an athlete within date range, builds structured context object | `ais/src/lib/buildAthleteReportContext.js` (new) | ⬜ | Sources: assessment_results, session_athlete_logs, wellness_logs, periodisation plan cells, athlete_staff_notes, injury_records (if exists). |
| TH-04 | Role-based context filter — strips sections the requesting user cannot see before AI call | `ais/src/lib/filterReportContext.js` (new) | ⬜ | Injury section: only if can('injury_surveillance', 'view'). Staff notes: filtered by domain. Never send data the viewer can't see to the AI. |
| TH-05 | AI synthesis function — sends filtered context to Anthropic API (claude-sonnet-4-20250514), stores result in athlete_reports | `ais/src/lib/generateAthleteReport.js` (new) | ⬜ | System prompt: professional sports science analyst, 4-6 paragraphs, evidence-based, actionable. Stores ai_model_version. |
| TH-06 | Team report assembly — aggregates across all athletes in team, AI synthesis at squad level | `ais/src/lib/generateTeamReport.js` (new) | ⬜ | Sections: squad_overview, availability, performance distribution, flags, AI narrative. |

---

### Block TH-C: Report UI
*Assign to: Cursor*  
*Estimated time: 2 hours*

| # | Milestone | File(s) | Status | Notes |
|---|-----------|--------|--------|-------|
| TH-07 | Generate Report button on athlete profile — visible only to permitted roles, opens date range picker | `ais/src/pages/AthleteProfile.jsx` (extend) | ⬜ | Gated: can('unified_reports', 'view'). Shows loading state during generation. |
| TH-08 | Athlete report view — sections rendered from stored JSONB, each section conditionally shown by role | `ais/src/pages/AthleteReportView.jsx` (new) | ⬜ | Assessment section, training section, wellness section, RPE section, injury section (gated), staff notes (gated per domain), AI synthesis. |
| TH-09 | Regenerate button — re-runs AI synthesis with latest data, replaces stored synthesis | `ais/src/pages/AthleteReportView.jsx` (extend) | ⬜ | Shows generated_at timestamp so viewer knows how fresh the report is. |
| TH-10 | Team report trigger — "Generate Team Report" on team page, date range picker | `ais/src/pages/TeamReportView.jsx` (new) | ⬜ | Gated: can('unified_reports', 'view') AND can('adminConfig', 'view') or head_coach role. |

---

### Block TH-D: PDF Export and External Sharing
*Assign to: Claude Code (generation logic) + Cursor (PDF template)*  
*Estimated time: 2 hours*

| # | Milestone | File(s) | Tool | Status | Notes |
|---|-----------|---------|------|--------|-------|
| TH-11 | Athlete report PDF template — styled HTML, sections match screen view, respects role filter | `ais/src/lib/buildAthleteReportPDF.js` (new) | Cursor | ⬜ | Uses existing jsPDF + html2canvas pipeline. IIS + JSW logos in header. |
| TH-12 | PDF generation endpoint — renders template, uploads to Supabase storage, saves pdf_url | `ais/src/lib/buildAthleteReportPDF.js` (extend) | Claude Code | ⬜ | PDF bucket in Supabase storage. Filename: `{org_id}/{athlete_id}/{report_id}.pdf` |
| TH-13 | Team report PDF template | `ais/src/lib/buildTeamReportPDF.js` (new) | Cursor | ⬜ | Squad summary layout. |
| TH-14 | External share — generate share_token, copy shareable link to clipboard, set expiry (7 days default) | `ais/src/components/reports/ShareReportModal.jsx` (new) | Cursor | ⬜ | Inserts row in report_access_grants. Link format: /report/share/{token} |
| TH-15 | Public report view — validates share_token, checks expiry, renders PDF or report view without login | `ais/src/pages/SharedReportView.jsx` (new) | Cursor | ⬜ | No auth required. Token-gated only. |

---

### Block TH-E: Superuser Panel and Feature Flags
*Assign to: Cursor*  
*Estimated time: 1 hour*

| # | Milestone | File(s) | Status | Notes |
|---|-----------|--------|--------|-------|
| TH-16 | Superuser panel route — only visible to is_superuser role | `ais/src/pages/SuperuserPanel.jsx` (new) | ⬜ | Completely hidden from all other roles. |
| TH-17 | Org list — all organisations, plan tier, user count, active features | `ais/src/components/superuser/OrgList.jsx` (new) | ⬜ | |
| TH-18 | Feature flag toggles — per org, enable/disable each feature_key | `ais/src/components/superuser/FeatureFlagPanel.jsx` (new) | ⬜ | Writes to org_feature_flags. |
| TH-19 | Feature flag checks in application — if feature not enabled for org, route returns "not available" | `ais/src/lib/featureFlags.js` (new) | ⬜ | `isFeatureEnabled(featureKey)` — checks org_feature_flags for current user's org. Used as route guard. |

---

### Block TH-F: AI Agent System — Governance
*Assign to: Claude Code*  
*Estimated time: 30 minutes*

| # | Milestone | File(s) | Status | Notes |
|---|-----------|--------|--------|-------|
| TH-20 | Add permission gate to AssistantPanel — only renders if can('sc_pro', 'use_ai_assistant') | `sc-pro/src/components/assistant/AssistantPanel.jsx` | ⬜ | |
| TH-21 | Add feature flag check — AssistantPanel only renders if isFeatureEnabled('ai_assistant') | `sc-pro/src/components/assistant/AssistantPanel.jsx` | ⬜ | |
| TH-22 | Add team_id filter to programmes query in useAgentExecution | `sc-pro/src/hooks/useAgentExecution.js` | ⬜ | Rule 3 violation from compliance audit. |

---

### Block TH-G: Buffer — V1 Fixes and Debt
*Use if Thursday schedule runs ahead. Otherwise carry to Friday.*

| # | Milestone | File(s) | Status | Notes |
|---|-----------|--------|--------|-------|
| B-01 | Fix mailto pre-fill in Send Report — debug athlete.email not reaching AthleteReport | `ais/src/components/reports/AthleteReport.jsx` | ⬜ | V1-01 from pending items |
| B-02 | Fix Flexibility radar axis collapse — verify case-insensitive fix in getTierScore | `ais/src/components/reports/AthleteReport.jsx` | ⬜ | V1-02 from pending items |
| B-03 | Implement median percentile for overall classification | `ais/src/components/reports/AthleteReport.jsx` | ⬜ | V1-03 from pending items. Do NOT touch scoring.js |
| B-04 | Begin CSS variables sweep — add tokens to index.css, sweep PeriodisationCanvas.jsx | `ais/src/index.css`, `ais/src/components/periodisation/PeriodisationCanvas.jsx` | ⬜ | P-01 from pending items. 44+ hardcoded hex values. |
| B-05 | Injury surveillance schema — design and review (once format shared) | New tables | ⬜ | Design in Claude.ai, execute via Claude Code |
| B-06 | Data migration planning — map Smartabase wellness/RPE fields to new schema | Document | ⬜ | |

**GATE TH: End of Thursday**
- [ ] Login → role-appropriate home works for all four user types
- [ ] Admin can invite users, assign roles, configure CRUD permissions
- [ ] Superuser can enable/disable features per org
- [ ] Athlete can log RPE and wellness
- [ ] Coach sees RPE and wellness for their team only
- [ ] Staff can add domain notes per athlete
- [ ] Unified athlete report generates on demand
- [ ] Report respects role visibility — physio sees injury, analyst does not
- [ ] PDF exports correctly
- [ ] External share link works without login
- [ ] Team report generates and exports
- [ ] No hardcoded org IDs anywhere in codebase
- [ ] RLS enforced on all tables
- [ ] AI Agent system is permission-gated and feature-flagged

**End of Thursday status:** ⬜ Sprint complete

---

## Known Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| RLS policies too restrictive — screens go blank | Medium | High | Smoke test every screen immediately after enabling RLS (Gate W-C). Fix policies before proceeding. |
| auth.js replacement breaks component that reads teamIds | Medium | High | Gate W-A verification must confirm teamIds array is populated correctly before any scoped query runs. |
| AI synthesis slow (10-15s per report) | High | Medium | Show progress indicator. Store result — subsequent views are instant reads, not repeat AI calls. |
| Wellness form JSONB composite score wrong | Low | Medium | Database function tested with known values before athlete form goes live. |
| Exercise library .or() pattern breaks under RLS | Low | High | RLS policy for exercise_library must explicitly allow rows where org_id IS NULL (system defaults) or org_id = requesting org. |
| PDF generation timeout for large reports | Low | Medium | Generate PDF asynchronously. Show "generating" state with polling. |

---

## Approved Architecture Exceptions

These are patterns that deviate from the Three Rules but are explicitly approved:

| Exception | Pattern | Reason | Files |
|---|---|---|---|
| Exercise library null org_id | `.or('org_id.is.null,org_id.eq.' + orgId)` | System default exercises have null org_id by design | SessionBuilder.jsx, SessionExerciseSearch.jsx, programmeImporter.js, assistantActions.js, exerciseCategoryUtils.js |
| Session library null org_id | `.or('is_system.eq.true,org_id.eq.' + orgId)` | System default session items have no org | PeriodisationWeekly.jsx |
| assessment_results classification column | Stored derived value | Legacy — was in original schema. Not to be propagated to new tables. Raw value is also stored. | assessment_results table |

---

## New Tables Added This Sprint

| Table | Purpose | Owner |
|---|---|---|
| `roles` | Named roles within an org | Platform Core |
| `role_permissions` | CRUD permissions per role per resource | Platform Core |
| `user_roles` | Role assignment per user, scoped to group | Platform Core |
| `groups` | Access scope containers | Platform Core |
| `group_members` | User membership in groups | Platform Core |
| `org_feature_flags` | Feature availability per org (superuser controlled) | Platform Core |
| `session_athlete_logs` | Per-athlete per-session RPE and duration | AIS |
| `wellness_form_items` | Configurable wellness questionnaire per org | AIS |
| `wellness_logs` | Daily athlete wellness responses | AIS |
| `wellness_thresholds` | Org-configurable flag thresholds per wellness item | AIS |
| `athlete_staff_notes` | Domain-specific staff observations per athlete | AIS |
| `athlete_reports` | Generated unified athlete intelligence reports | AIS |
| `team_reports` | Generated team-level reports | AIS |
| `report_access_grants` | External share tokens and access control | AIS |

---

## Resource Strings — Canonical List (Updated)

All `role_permissions.resource` values. Use these exact strings everywhere — in the database, in `can()` calls, in UI gates.

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

## Files Created This Sprint

Track new files to ensure none exceed 400 lines at creation.

| File | Created | Line count at creation | Status |
|---|---|---|---|
| `ais/src/pages/Login.jsx` | ⬜ | — | |
| `ais/src/pages/ResetPassword.jsx` | ⬜ | — | |
| `ais/src/pages/AthleteHome.jsx` | ⬜ | — | |
| `ais/src/pages/AthleteReportView.jsx` | ⬜ | — | |
| `ais/src/pages/TeamReportView.jsx` | ⬜ | — | |
| `ais/src/pages/SharedReportView.jsx` | ⬜ | — | |
| `ais/src/pages/Admin.jsx` | ⬜ | — | |
| `ais/src/pages/SuperuserPanel.jsx` | ⬜ | — | |
| `ais/src/hooks/useRPELog.js` | ⬜ | — | |
| `ais/src/hooks/useWellness.js` | ⬜ | — | |
| `ais/src/hooks/useStaffNotes.js` | ⬜ | — | |
| `ais/src/lib/buildAthleteReportContext.js` | ⬜ | — | |
| `ais/src/lib/filterReportContext.js` | ⬜ | — | |
| `ais/src/lib/generateAthleteReport.js` | ⬜ | — | |
| `ais/src/lib/generateTeamReport.js` | ⬜ | — | |
| `ais/src/lib/buildAthleteReportPDF.js` | ⬜ | — | |
| `ais/src/lib/buildTeamReportPDF.js` | ⬜ | — | |
| `ais/src/lib/featureFlags.js` | ⬜ | — | |
| `ais/src/components/admin/UserList.jsx` | ⬜ | — | |
| `ais/src/components/admin/InviteUserModal.jsx` | ⬜ | — | |
| `ais/src/components/admin/RolePermissionsGrid.jsx` | ⬜ | — | |
| `ais/src/components/admin/TeamManagement.jsx` | ⬜ | — | |
| `ais/src/components/sessions/SessionRPEView.jsx` | ⬜ | — | |
| `ais/src/components/wellness/WellnessDashboard.jsx` | ⬜ | — | |
| `ais/src/components/wellness/WellnessTrend.jsx` | ⬜ | — | |
| `ais/src/components/reports/StaffNotesPanel.jsx` | ⬜ | — | |
| `ais/src/components/reports/ShareReportModal.jsx` | ⬜ | — | |
| `ais/src/components/superuser/OrgList.jsx` | ⬜ | — | |
| `ais/src/components/superuser/FeatureFlagPanel.jsx` | ⬜ | — | |

---

*AIS — Athlete Intelligence System · Build Sprint 27–29 May 2026 · Ranjit Nahak*  
*This document is the single source of truth for this sprint. Update status after every milestone. Never skip a GATE.*
