import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { resolveAthleteId } from '../lib/resolveAthleteId';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId, resolveAthleteSessionTeamIds } from '../lib/orgScope';
import { fetchAthleteTodaySessions, localTodayIso } from '../lib/athleteTodaySessions';

export function useRPELog() {
  const { user, activeOrgId } = useUser();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  useEffect(() => {
    void loadTodaySessions();
  }, [effectiveOrgId, user?.id, user?.teamIds, user?.primaryTeamId, activeOrgId]);

  async function loadTodaySessions() {
    try {
      setLoading(true);
      const currentUser = user ?? (await getCurrentUser());
      if (!currentUser || !effectiveOrgId) {
        setSessions([]);
        return;
      }

      const athleteId = await resolveAthleteId(currentUser, effectiveOrgId);
      if (!athleteId) {
        setSessions([]);
        return;
      }

      const today = localTodayIso();
      const teamIds = resolveAthleteSessionTeamIds(currentUser);
      const mapped = await fetchAthleteTodaySessions(supabase, {
        athleteId,
        orgId: effectiveOrgId,
        today,
        teamIds,
      });

      setSessions(mapped);
    } catch (err) {
      console.error('[useRPELog] loadTodaySessions failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRPELog({ sessionId, actualRpe, actualDurationMin }) {
    try {
      setSubmitting(true);
      setError(null);
      const currentUser = user ?? (await getCurrentUser());
      if (!currentUser || !effectiveOrgId) throw new Error('Not authenticated');

      const athleteId = await resolveAthleteId(currentUser, effectiveOrgId);
      if (!athleteId) throw new Error('No athlete profile linked to this account.');

      const session = sessions.find((row) => (row.id ?? row.sessionId) === sessionId);

      const { error: upsertError } = await supabase.from('session_athlete_logs').upsert(
        {
          session_id: sessionId,
          athlete_id: athleteId,
          org_id: effectiveOrgId,
          team_id: session?.team_id ?? null,
          actual_rpe: actualRpe,
          actual_duration_min: actualDurationMin,
          logged_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,athlete_id' },
      );
      if (upsertError) throw upsertError;
      setSubmitted(true);
    } catch (err) {
      console.error('[useRPELog] submitRPELog failed:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return { sessions, loading, submitting, error, submitted, submitRPELog };
}
