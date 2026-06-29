import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { getEffectiveOrgId, narrowTeamIds, resolveOrgTeamScope } from '../lib/orgScope';
import { useUser } from '../context/UserContext';
import {
  computeAthleteSummary,
  computeReasonBreakdown,
  computeSquadMetrics,
  computeWeeklyTrend,
} from '../lib/attendanceEngine';
import { formatRange } from '../lib/periodisationUtils';
import {
  buildTodayRange,
  rangePresetLabel,
  resolveDashboardDateRange,
} from '../lib/dashboardDateRange';

const SESSION_SELECT = 'id, org_id, team_id, athlete_id, session_date, start_time, name';
const RECORD_SELECT = 'id, session_id, athlete_id, status, reason, informed, note, marked_by, marked_at';

const DEFAULT_FILTERS = { range: 'today', dateFrom: null, dateTo: null };

export function useAttendanceDashboard() {
  const { user, activeOrgId, activeTeamId } = useUser();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sessions, setSessions] = useState([]);
  const [athleteTeams, setAthleteTeams] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [dateRange, setDateRange] = useState(buildTodayRange());
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setRangeFilter = useCallback((nextRange) => {
    setFilters((prev) => {
      if (nextRange === 'custom') {
        const seed = dateRangeRef.current;
        return {
          ...prev,
          range: 'custom',
          dateFrom: prev.dateFrom ?? seed.dateFrom,
          dateTo: prev.dateTo ?? seed.dateTo,
        };
      }
      return { ...prev, range: nextRange };
    });
  }, []);

  const setCustomDateRange = useCallback(({ dateFrom, dateTo }) => {
    setFilters((prev) => ({
      ...prev,
      range: 'custom',
      dateFrom,
      dateTo,
    }));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const currentUser = user ?? (await getCurrentUser());
        const orgId = getEffectiveOrgId(currentUser, activeOrgId);
        if (!currentUser || !orgId || !activeTeamId) {
          if (mounted) {
            setSessions([]);
            setAthleteTeams([]);
            setAttendanceRecords([]);
            setDateRange(buildTodayRange());
          }
          return;
        }

        const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, currentUser, activeOrgId);
        const teamIds = narrowTeamIds(effectiveTeamIds, activeTeamId);
        if (!teamIds.length || !teamIds.includes(activeTeamId)) {
          if (mounted) {
            setSessions([]);
            setAthleteTeams([]);
            setAttendanceRecords([]);
          }
          return;
        }

        const resolvedRange = await resolveDashboardDateRange(filters, {
          orgId,
          teamId: activeTeamId,
        });

        const { dateFrom, dateTo } = resolvedRange;

        const [sessionsRes, athleteTeamsRes] = await Promise.all([
          supabase
            .from('sessions')
            .select(SESSION_SELECT)
            .eq('org_id', orgId)
            .eq('team_id', activeTeamId)
            .gte('session_date', dateFrom)
            .lte('session_date', dateTo)
            .order('session_date')
            .order('start_time'),
          supabase
            .from('athlete_teams')
            .select('athlete_id, team_id, joined_at, left_at, athletes!inner(id, full_name, org_id, is_active)')
            .eq('team_id', activeTeamId)
            .eq('athletes.org_id', orgId)
            .eq('athletes.is_active', true),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (athleteTeamsRes.error) throw athleteTeamsRes.error;

        const sessionRows = sessionsRes.data ?? [];
        const athleteTeamRows = athleteTeamsRes.data ?? [];
        const sessionIds = sessionRows.map((row) => row.id);

        let recordRows = [];
        if (sessionIds.length) {
          const { data, error: recordsError } = await supabase
            .from('attendance_records')
            .select(RECORD_SELECT)
            .eq('org_id', orgId)
            .in('session_id', sessionIds);
          if (recordsError) throw recordsError;
          recordRows = data ?? [];
        }

        if (!mounted) return;

        setSessions(sessionRows);
        setAthleteTeams(athleteTeamRows);
        setAttendanceRecords(recordRows);
        setDateRange(resolvedRange);
      } catch (err) {
        console.error('[useAttendanceDashboard] load failed:', err);
        if (mounted) {
          setError(err.message ?? 'Could not load attendance dashboard.');
          setSessions([]);
          setAthleteTeams([]);
          setAttendanceRecords([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [user, activeOrgId, activeTeamId, filters.range, filters.dateFrom, filters.dateTo]);

  const squadMetrics = useMemo(
    () => computeSquadMetrics({
      sessions,
      athleteTeams,
      attendanceRecords,
      teamId: activeTeamId,
      dateRange,
    }),
    [sessions, athleteTeams, attendanceRecords, activeTeamId, dateRange],
  );

  const weeklyTrend = useMemo(
    () => computeWeeklyTrend({
      sessions,
      athleteTeams,
      attendanceRecords,
      teamId: activeTeamId,
      dateRange,
    }),
    [sessions, athleteTeams, attendanceRecords, activeTeamId, dateRange],
  );

  const reasonBreakdown = useMemo(
    () => computeReasonBreakdown({ attendanceRecords, sessions, dateRange }),
    [attendanceRecords, sessions, dateRange],
  );

  const athleteSummary = useMemo(
    () => computeAthleteSummary({
      sessions,
      athleteTeams,
      attendanceRecords,
      teamId: activeTeamId,
      dateRange,
    }),
    [sessions, athleteTeams, attendanceRecords, activeTeamId, dateRange],
  );

  const dateRangeLabel = useMemo(
    () => formatRange(dateRange.dateFrom, dateRange.dateTo),
    [dateRange],
  );

  const rangeLabel = rangePresetLabel(filters.range);

  return {
    loading,
    error,
    filters,
    setFilter,
    setRangeFilter,
    setCustomDateRange,
    squadMetrics,
    weeklyTrend,
    reasonBreakdown,
    athleteSummary,
    dateRangeLabel,
    rangeLabel,
    activeTeamId,
    hasSessions: sessions.length > 0,
  };
}
