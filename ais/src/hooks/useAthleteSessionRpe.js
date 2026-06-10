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
    async (sessionId, selectedRpe) => {
      try {
        setSaving(true);
        setError(null);
        const currentUser = user ?? (await getCurrentUser());
        const effectiveOrgId = getEffectiveOrgId(currentUser, activeOrgId);
        if (!currentUser?.id || !effectiveOrgId) throw new Error('Not authenticated');

        const athleteId = await resolveAthleteId(currentUser, effectiveOrgId);
        if (!athleteId) throw new Error('No athlete profile linked to this account.');

        const { error: updateError } = await supabase
          .from('session_athlete_logs')
          .update({
            actual_rpe: selectedRpe,
            logged_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId)
          .eq('athlete_id', athleteId)
          .eq('org_id', effectiveOrgId);

        if (updateError) throw updateError;
        return selectedRpe;
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
