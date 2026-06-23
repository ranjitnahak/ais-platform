-- S&C Pro — Allow platform superusers to read/write SC Pro tables across orgs (org switcher).
-- Symptom: "new row violates row-level security policy for table \"programmes\"" on Create programme.
-- Evidence: superuser, insert org_id = JSW Sports (a3000000), get_current_org_id() = AKFI (a2000000).
-- Cause: SC Pro tables had org isolation only; no superuser bypass (unlike sessions / periodisation).
-- Depends on: public.is_platform_superuser() from superuser_cross_org_rls_v1.sql
-- Note: .insert().select() requires SELECT visibility on the new row (RETURNING check).

-- programmes
DROP POLICY IF EXISTS programmes_platform_superuser_select ON public.programmes;
CREATE POLICY programmes_platform_superuser_select
  ON public.programmes FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS programmes_platform_superuser_insert ON public.programmes;
CREATE POLICY programmes_platform_superuser_insert
  ON public.programmes FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programmes_platform_superuser_update ON public.programmes;
CREATE POLICY programmes_platform_superuser_update
  ON public.programmes FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programmes_platform_superuser_delete ON public.programmes;
CREATE POLICY programmes_platform_superuser_delete
  ON public.programmes FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- programme_weeks
DROP POLICY IF EXISTS programme_weeks_platform_superuser_select ON public.programme_weeks;
CREATE POLICY programme_weeks_platform_superuser_select
  ON public.programme_weeks FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_weeks_platform_superuser_insert ON public.programme_weeks;
CREATE POLICY programme_weeks_platform_superuser_insert
  ON public.programme_weeks FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_weeks_platform_superuser_update ON public.programme_weeks;
CREATE POLICY programme_weeks_platform_superuser_update
  ON public.programme_weeks FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_weeks_platform_superuser_delete ON public.programme_weeks;
CREATE POLICY programme_weeks_platform_superuser_delete
  ON public.programme_weeks FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- programme_sessions
DROP POLICY IF EXISTS programme_sessions_platform_superuser_select ON public.programme_sessions;
CREATE POLICY programme_sessions_platform_superuser_select
  ON public.programme_sessions FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_sessions_platform_superuser_insert ON public.programme_sessions;
CREATE POLICY programme_sessions_platform_superuser_insert
  ON public.programme_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_sessions_platform_superuser_update ON public.programme_sessions;
CREATE POLICY programme_sessions_platform_superuser_update
  ON public.programme_sessions FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_sessions_platform_superuser_delete ON public.programme_sessions;
CREATE POLICY programme_sessions_platform_superuser_delete
  ON public.programme_sessions FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- programme_teams
DROP POLICY IF EXISTS programme_teams_platform_superuser_select ON public.programme_teams;
CREATE POLICY programme_teams_platform_superuser_select
  ON public.programme_teams FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_teams_platform_superuser_insert ON public.programme_teams;
CREATE POLICY programme_teams_platform_superuser_insert
  ON public.programme_teams FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_teams_platform_superuser_update ON public.programme_teams;
CREATE POLICY programme_teams_platform_superuser_update
  ON public.programme_teams FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_teams_platform_superuser_delete ON public.programme_teams;
CREATE POLICY programme_teams_platform_superuser_delete
  ON public.programme_teams FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- programme_athletes
DROP POLICY IF EXISTS programme_athletes_platform_superuser_select ON public.programme_athletes;
CREATE POLICY programme_athletes_platform_superuser_select
  ON public.programme_athletes FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_athletes_platform_superuser_insert ON public.programme_athletes;
CREATE POLICY programme_athletes_platform_superuser_insert
  ON public.programme_athletes FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_athletes_platform_superuser_update ON public.programme_athletes;
CREATE POLICY programme_athletes_platform_superuser_update
  ON public.programme_athletes FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS programme_athletes_platform_superuser_delete ON public.programme_athletes;
CREATE POLICY programme_athletes_platform_superuser_delete
  ON public.programme_athletes FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- session_blocks
DROP POLICY IF EXISTS session_blocks_platform_superuser_select ON public.session_blocks;
CREATE POLICY session_blocks_platform_superuser_select
  ON public.session_blocks FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS session_blocks_platform_superuser_insert ON public.session_blocks;
CREATE POLICY session_blocks_platform_superuser_insert
  ON public.session_blocks FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS session_blocks_platform_superuser_update ON public.session_blocks;
CREATE POLICY session_blocks_platform_superuser_update
  ON public.session_blocks FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS session_blocks_platform_superuser_delete ON public.session_blocks;
CREATE POLICY session_blocks_platform_superuser_delete
  ON public.session_blocks FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- session_exercises
DROP POLICY IF EXISTS session_exercises_platform_superuser_select ON public.session_exercises;
CREATE POLICY session_exercises_platform_superuser_select
  ON public.session_exercises FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS session_exercises_platform_superuser_insert ON public.session_exercises;
CREATE POLICY session_exercises_platform_superuser_insert
  ON public.session_exercises FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS session_exercises_platform_superuser_update ON public.session_exercises;
CREATE POLICY session_exercises_platform_superuser_update
  ON public.session_exercises FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS session_exercises_platform_superuser_delete ON public.session_exercises;
CREATE POLICY session_exercises_platform_superuser_delete
  ON public.session_exercises FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- exercise_library
DROP POLICY IF EXISTS exercise_library_platform_superuser_select ON public.exercise_library;
CREATE POLICY exercise_library_platform_superuser_select
  ON public.exercise_library FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS exercise_library_platform_superuser_insert ON public.exercise_library;
CREATE POLICY exercise_library_platform_superuser_insert
  ON public.exercise_library FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS exercise_library_platform_superuser_update ON public.exercise_library;
CREATE POLICY exercise_library_platform_superuser_update
  ON public.exercise_library FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS exercise_library_platform_superuser_delete ON public.exercise_library;
CREATE POLICY exercise_library_platform_superuser_delete
  ON public.exercise_library FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- athlete_1rm
DROP POLICY IF EXISTS athlete_1rm_platform_superuser_select ON public.athlete_1rm;
CREATE POLICY athlete_1rm_platform_superuser_select
  ON public.athlete_1rm FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_1rm_platform_superuser_insert ON public.athlete_1rm;
CREATE POLICY athlete_1rm_platform_superuser_insert
  ON public.athlete_1rm FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_1rm_platform_superuser_update ON public.athlete_1rm;
CREATE POLICY athlete_1rm_platform_superuser_update
  ON public.athlete_1rm FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_1rm_platform_superuser_delete ON public.athlete_1rm;
CREATE POLICY athlete_1rm_platform_superuser_delete
  ON public.athlete_1rm FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- athlete_exercise_logs
DROP POLICY IF EXISTS athlete_exercise_logs_platform_superuser_select ON public.athlete_exercise_logs;
CREATE POLICY athlete_exercise_logs_platform_superuser_select
  ON public.athlete_exercise_logs FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_exercise_logs_platform_superuser_insert ON public.athlete_exercise_logs;
CREATE POLICY athlete_exercise_logs_platform_superuser_insert
  ON public.athlete_exercise_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_exercise_logs_platform_superuser_update ON public.athlete_exercise_logs;
CREATE POLICY athlete_exercise_logs_platform_superuser_update
  ON public.athlete_exercise_logs FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS athlete_exercise_logs_platform_superuser_delete ON public.athlete_exercise_logs;
CREATE POLICY athlete_exercise_logs_platform_superuser_delete
  ON public.athlete_exercise_logs FOR DELETE TO authenticated
  USING (public.is_platform_superuser());

-- loading_schemes
DROP POLICY IF EXISTS loading_schemes_platform_superuser_select ON public.loading_schemes;
CREATE POLICY loading_schemes_platform_superuser_select
  ON public.loading_schemes FOR SELECT TO authenticated
  USING (public.is_platform_superuser());

DROP POLICY IF EXISTS loading_schemes_platform_superuser_insert ON public.loading_schemes;
CREATE POLICY loading_schemes_platform_superuser_insert
  ON public.loading_schemes FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS loading_schemes_platform_superuser_update ON public.loading_schemes;
CREATE POLICY loading_schemes_platform_superuser_update
  ON public.loading_schemes FOR UPDATE TO authenticated
  USING (public.is_platform_superuser())
  WITH CHECK (public.is_platform_superuser());

DROP POLICY IF EXISTS loading_schemes_platform_superuser_delete ON public.loading_schemes;
CREATE POLICY loading_schemes_platform_superuser_delete
  ON public.loading_schemes FOR DELETE TO authenticated
  USING (public.is_platform_superuser());
