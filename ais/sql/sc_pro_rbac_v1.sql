-- =============================================================================
-- S&C Pro — RBAC extension (SP-02) — documentation & V2 placeholder
-- =============================================================================
-- AIS_Architecture_Guidelines.md §6: RBAC model, canonical resource strings,
--   role_permissions (role_id, resource, action) with action ∈ view|edit|admin.
-- SC_Pro_Architecture_v1.0.md §11.3: coaching-internal UI gated with
--   can('programme', 'viewCoachingData') — boolean, not a hierarchy level.
--
-- V1 (current): No roles / role_permissions / user_roles tables in Supabase.
--   Permissions live only in src/lib/auth.js stub until V2 Auth + RLS.
--
-- V2 (future): Add programme to role_permissions; map viewCoachingData via
--   convention (e.g. resource 'programme', action 'viewCoachingData' as a
--   dedicated row, or a separate permission table — final schema TBD with Auth).
--   Do NOT create roles / role_permissions / user_roles in this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- S&C Pro RBAC requirements (reference)
-- -----------------------------------------------------------------------------
-- 1) Resource: programme — actions view | edit | admin (same hierarchy as §6.2)
-- 2) viewCoachingData: boolean — Staff true, Athlete false (Settings / SC §11.3)
-- 3) Canonical role_permissions.resource string for S&C Pro: 'programme'
--    (add to Guidelines §6.3 canonical list at next architecture doc edit)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- V2 placeholder — commented only (do not execute)
-- -----------------------------------------------------------------------------
-- Example: Staff role id from roles table after V2 migration
-- INSERT INTO role_permissions (role_id, resource, action)
--   VALUES ('<staff_role_uuid>', 'programme', 'edit');
-- INSERT INTO role_permissions (role_id, resource, action)
--   VALUES ('<staff_role_uuid>', 'programme', 'viewCoachingData');
--   -- OR store viewCoachingData as action on programme if you adopt a
--   -- single-table enum extension; align with can() in auth.js at V2.
--
-- Athlete role: programme at 'view' only, no viewCoachingData row (or explicit deny)
-- INSERT INTO role_permissions (role_id, resource, action)
--   VALUES ('<athlete_role_uuid>', 'programme', 'view');
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Verification (no RBAC tables in V1 — documents stub-only state)
-- -----------------------------------------------------------------------------
-- auth.js cannot be validated from SQL. Confirm in code review:
--   ais/src/lib/auth.js → permissions.programme, permissions.viewCoachingData,
--   and can() handling for boolean keys + can('programme', 'viewCoachingData').
SELECT
  current_database() AS database,
  'SP-02 V1: programme + viewCoachingData in src/lib/auth.js stub; no DB RBAC rows' AS rbac_note;
