import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { resolveAthleteId } from '../lib/resolveAthleteId';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';

export function useAthleteSessionRpe() {
  const { user, activeOrgId } = useUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const logRpe = useCallback(
    async (sessionId, { actualRpe, actualDurationMin, notes = null, teamId = null }) => {
      try {
        setSaving(true);
        setError(null);
        const currentUser = user ?? (await getCurrentUser());
        const effectiveOrgId = getEffectiveOrgId(currentUser, activeOrgId);
        if (!currentUser?.id || !effectiveOrgId) throw new Error('Not authenticated');

        const athleteId = await resolveAthleteId(currentUser, effectiveOrgId);
        if (!athleteId) throw new Error('No athlete profile linked to this account.');

        const { error: upsertError } = await supabase.from('session_athlete_logs').upsert(
          {
            session_id: sessionId,
            athlete_id: athleteId,
            org_id: effectiveOrgId,
            team_id: teamId,
            actual_rpe: actualRpe,
            actual_duration_min: actualDurationMin,
            notes,
            logged_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,athlete_id' },
        );

        if (upsertError) throw upsertError;
        return { actualRpe, actualDurationMin };
      } catch (err) {
        console.error('[useAthleteSessionRpe] logRpe failed:', err);
        setError(err.message || 'Failed to save');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [user, activeOrgId],
  );

  const clearError = useCallback(() => setError(null), []);

  return { logRpe, saving, error, clearError };
}
