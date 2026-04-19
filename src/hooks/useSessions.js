import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getCurrentUser } from '../lib/auth';

export const useSessions = (teamId, planId, weekStart, weekEnd) => {
  const [sessions, setSessions] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const user = getCurrentUser();

  const fetchSessions = useCallback(async () => {
    if (!teamId || !weekStart || !weekEnd || !user?.teamIds?.includes(teamId)) {
      setSessions([]);
      setInitialLoading(false);
      return;
    }

    let q = supabase
      .from('sessions')
      .select('*')
      .eq('org_id', user.orgId)
      .eq('team_id', teamId)
      .in('team_id', user.teamIds)
      .gte('session_date', weekStart)
      .lte('session_date', weekEnd)
      .order('session_date')
      .order('start_time');

    if (planId) q = q.eq('plan_id', planId);

    const { data, error } = await q;
    if (error) {
      console.error(error);
      setSessions([]);
    } else {
      setSessions(data || []);
    }
    setInitialLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, planId, weekStart, weekEnd]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const upsertSession = async (sessionData) => {
    const { data, error } = await supabase
      .from('sessions')
      .upsert({
        ...sessionData,
        org_id: user.orgId,
        team_id: teamId,
        plan_id: planId ?? sessionData.plan_id,
      })
      .select();
    if (error) throw error;
    if (!data?.[0]) return null;
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === data[0].id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = data[0];
        return next;
      }
      return [...prev, data[0]];
    });
    return data[0];
  };

  return { sessions, loading: initialLoading, fetchSessions, upsertSession };
};
