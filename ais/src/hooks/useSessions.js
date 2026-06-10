import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getCurrentUser } from '../lib/auth';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';

export const useSessions = (teamId, planId, weekStart, weekEnd) => {
  const [sessions, setSessions] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const { user: contextUser, activeOrgId } = useUser();

  const fetchSessions = useCallback(async () => {
    try {
      const user = contextUser ?? (await getCurrentUser());
      const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
      if (!teamId || !weekStart || !weekEnd || !user?.teamIds?.includes(teamId) || !effectiveOrgId) {
        setSessions([]);
        setInitialLoading(false);
        return;
      }

      let q = supabase
        .from('sessions')
        .select('*, session_athlete_logs(count)')
        .eq('org_id', effectiveOrgId)
        .eq('team_id', teamId)
        .in('team_id', user.teamIds)
        .gte('session_date', weekStart)
        .lte('session_date', weekEnd)
        .order('session_date')
        .order('start_time');

      if (planId) q = q.eq('plan_id', planId);

      const { data, error } = await q;
      if (error) {
        console.error('[useSessions] fetchSessions failed:', error);
        setSessions([]);
      } else {
        setSessions(data || []);
      }
    } catch (err) {
      console.error('[useSessions] fetchSessions failed:', err);
      setSessions([]);
    } finally {
      setInitialLoading(false);
    }
  }, [teamId, planId, weekStart, weekEnd, contextUser, activeOrgId]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const upsertSession = async (sessionData) => {
    const user = contextUser ?? (await getCurrentUser());
    const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
    const { data, error } = await supabase
      .from('sessions')
      .upsert({
        ...sessionData,
        org_id: effectiveOrgId,
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

  const deleteSession = async (id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      const user = contextUser ?? (await getCurrentUser());
      const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id)
        .eq('org_id', effectiveOrgId);
      if (error) throw error;
    } catch (e) {
      await fetchSessions();
      throw e;
    }
  };

  return { sessions, loading: initialLoading, fetchSessions, upsertSession, deleteSession };
};
