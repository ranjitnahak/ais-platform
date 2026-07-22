import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';

const SESSION_SELECT =
  'id, org_id, team_id, athlete_id, session_date, start_time, end_time, name, session_type, plan_cell_id';

function canAccessTeam(user, teamId) {
  if (!user || !teamId) return false;
  if (user.isSuperuser) return true;
  if (user.role === 'admin') return true;
  return (user.teamIds ?? []).includes(teamId);
}

export function useAttendanceSessions(selectedDate) {
  const { user, activeTeamId, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!selectedDate || !activeTeamId || !effectiveOrgId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const currentUser = user ?? (await getCurrentUser());
      if (!currentUser) {
        setSessions([]);
        return;
      }
      if (!canAccessTeam(currentUser, activeTeamId)) {
        setSessions([]);
        setError('You do not have access to this team.');
        return;
      }

      const { data, error: queryError } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .eq('org_id', effectiveOrgId)
        .eq('team_id', activeTeamId)
        .eq('session_date', selectedDate)
        .order('start_time');

      if (queryError) throw queryError;
      setSessions(data ?? []);
    } catch (err) {
      console.error('[useAttendanceSessions] fetchSessions failed:', err);
      setError(err.message ?? 'Could not load sessions.');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, activeTeamId, effectiveOrgId, user]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}
