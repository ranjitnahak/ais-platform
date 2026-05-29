import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId, resolveOrgTeamScope } from '../lib/orgScope';

function formatLastRpeDate(isoDate) {
  if (!isoDate) return null;
  const logged = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const loggedDay = new Date(logged);
  loggedDay.setHours(0, 0, 0, 0);
  if (loggedDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return logged.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function buildLastSevenDays() {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    days.push(date.toISOString().split('T')[0]);
  }
  return days;
}

export function useAthleteHome() {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wellnessDoneToday, setWellnessDoneToday] = useState(false);
  const [todaySession, setTodaySession] = useState(null);
  const [streakDays, setStreakDays] = useState([]);
  const [lastRpe, setLastRpe] = useState(null);
  const [lastRpeDateLabel, setLastRpeDateLabel] = useState(null);

  const streakCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let count = 0;
    for (let index = streakDays.length - 1; index >= 0; index -= 1) {
      const day = streakDays[index];
      if (day.submitted) {
        count += 1;
        continue;
      }
      if (day.date === today) continue;
      break;
    }
    return count;
  }, [streakDays]);

  useEffect(() => {
    let mounted = true;

    async function loadHomeData() {
      if (!user?.id || !effectiveOrgId) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, user, activeOrgId);
        const today = new Date().toISOString().split('T')[0];
        const lastSeven = buildLastSevenDays();

        let athleteId = user.athleteId;
        if (!athleteId) {
          if (mounted) {
            setWellnessDoneToday(false);
            setTodaySession(null);
            setStreakDays(lastSeven.map((date) => ({ date, submitted: false })));
            setLastRpe(null);
            setLastRpeDateLabel(null);
          }
          return;
        }

        let sessionTeamIds = effectiveTeamIds;
        if (!sessionTeamIds.length) {
          const { data: athleteTeams, error: athleteTeamsError } = await supabase
            .from('athlete_teams')
            .select('team_id')
            .eq('athlete_id', athleteId);
          if (athleteTeamsError) throw athleteTeamsError;
          sessionTeamIds = (athleteTeams ?? []).map((row) => row.team_id);
        }

        const queries = [
          supabase
            .from('wellness_logs')
            .select('id')
            .eq('org_id', effectiveOrgId)
            .eq('athlete_id', athleteId)
            .eq('log_date', today)
            .maybeSingle(),
          supabase
            .from('wellness_logs')
            .select('log_date')
            .eq('org_id', effectiveOrgId)
            .eq('athlete_id', athleteId)
            .in('log_date', lastSeven),
          supabase
            .from('session_athlete_logs')
            .select('actual_rpe, logged_at')
            .eq('org_id', effectiveOrgId)
            .eq('athlete_id', athleteId)
            .not('actual_rpe', 'is', null)
            .order('logged_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ];

        if (sessionTeamIds.length) {
          queries.push(
            supabase
              .from('sessions')
              .select('id, name, start_time')
              .eq('org_id', effectiveOrgId)
              .in('team_id', sessionTeamIds)
              .eq('session_date', today)
              .order('start_time', { ascending: true })
              .limit(1)
              .maybeSingle(),
          );
        }

        const results = await Promise.all(queries);
        for (const result of results) {
          if (result.error) throw result.error;
        }

        const [todayWellness, streakRows, lastRpeRow, sessionRow] = results;
        const submittedDates = new Set((streakRows.data ?? []).map((row) => row.log_date));

        if (!mounted) return;

        setWellnessDoneToday(Boolean(todayWellness.data));
        setTodaySession(sessionRow?.data ?? null);
        setStreakDays(lastSeven.map((date) => ({
          date,
          submitted: submittedDates.has(date),
        })));
        setLastRpe(lastRpeRow.data?.actual_rpe ?? null);
        setLastRpeDateLabel(formatLastRpeDate(lastRpeRow.data?.logged_at));
      } catch (err) {
        console.error('[useAthleteHome] loadHomeData failed:', err);
        if (mounted) setError(err.message || 'Could not load home data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadHomeData();
    return () => { mounted = false; };
  }, [user?.id, user?.athleteId, effectiveOrgId, activeOrgId]);

  return {
    loading,
    error,
    wellnessDoneToday,
    todaySession,
    streakDays,
    streakCount,
    lastRpe,
    lastRpeDateLabel,
  };
}
