import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import { resolveAthleteId } from '../lib/resolveAthleteId';

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
  const [todaySessions, setTodaySessions] = useState([]);
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

        const today = new Date().toISOString().split('T')[0];
        const lastSeven = buildLastSevenDays();

        const athleteId = await resolveAthleteId(user, effectiveOrgId);
        if (!athleteId) {
          if (mounted) {
            setWellnessDoneToday(false);
            setTodaySessions([]);
            setStreakDays(lastSeven.map((date) => ({ date, submitted: false })));
            setLastRpe(null);
            setLastRpeDateLabel(null);
          }
          return;
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
          supabase
            .from('session_athlete_logs')
            .select(`
              session_id,
              actual_rpe,
              sessions!inner(
                id, session_date, start_time, session_type, venue, rpe_planned
              )
            `)
            .eq('athlete_id', athleteId)
            .eq('org_id', effectiveOrgId)
            .eq('sessions.session_date', today)
            .order('start_time', { foreignTable: 'sessions', ascending: true }),
        ];

        const results = await Promise.all(queries);
        for (const result of results) {
          if (result.error) throw result.error;
        }

        const [todayWellness, streakRows, lastRpeRow, sessionRows] = results;
        const submittedDates = new Set((streakRows.data ?? []).map((row) => row.log_date));

        const sessions = (sessionRows.data ?? []).map((row) => {
          const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
          return {
            sessionId: row.session_id,
            actualRpe: row.actual_rpe,
            ...session,
          };
        });

        if (!mounted) return;

        setWellnessDoneToday(Boolean(todayWellness.data));
        setTodaySessions(sessions);
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
  }, [user?.id, effectiveOrgId, activeOrgId]);

  const refreshTodaySessions = async () => {
    if (!user?.id || !effectiveOrgId) return;
    try {
      const athleteId = await resolveAthleteId(user, effectiveOrgId);
      if (!athleteId) return;

      const today = new Date().toISOString().split('T')[0];
      const { data, error: sessionError } = await supabase
        .from('session_athlete_logs')
        .select(`
          session_id,
          actual_rpe,
          sessions!inner(
            id, session_date, start_time, session_type, venue, rpe_planned
          )
        `)
        .eq('athlete_id', athleteId)
        .eq('org_id', effectiveOrgId)
        .eq('sessions.session_date', today)
        .order('start_time', { foreignTable: 'sessions', ascending: true });

      if (sessionError) throw sessionError;

      setTodaySessions(
        (data ?? []).map((row) => {
          const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
          return {
            sessionId: row.session_id,
            actualRpe: row.actual_rpe,
            ...session,
          };
        }),
      );

      const { data: lastRpeRow, error: lastRpeError } = await supabase
        .from('session_athlete_logs')
        .select('actual_rpe, logged_at')
        .eq('org_id', effectiveOrgId)
        .eq('athlete_id', athleteId)
        .not('actual_rpe', 'is', null)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRpeError) throw lastRpeError;
      setLastRpe(lastRpeRow?.actual_rpe ?? null);
      setLastRpeDateLabel(formatLastRpeDate(lastRpeRow?.logged_at));
    } catch (err) {
      console.error('[useAthleteHome] refreshTodaySessions failed:', err);
    }
  };

  return {
    loading,
    error,
    wellnessDoneToday,
    todaySessions,
    streakDays,
    streakCount,
    lastRpe,
    lastRpeDateLabel,
    refreshTodaySessions,
  };
}
