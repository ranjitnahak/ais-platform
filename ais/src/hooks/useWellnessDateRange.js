import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, canSync } from '../lib/auth';
import { getEffectiveOrgId, narrowTeamIds, resolveOrgTeamScope } from '../lib/orgScope';
import { useUser } from '../context/UserContext';
import { formatRange, addDays } from '../lib/periodisationUtils';
import {
  buildTodayRange,
  resolveDashboardDateRange,
} from '../lib/dashboardDateRange';
import { WELLNESS_METRIC_COLUMNS } from '../lib/wellnessDashboardConstants';

const DEFAULT_FILTERS = { range: 'today', dateFrom: null, dateTo: null };
const FLAG_SCORE_THRESHOLD = 2.5;

function isFlaggedLog(log) {
  const score = log.composite_score == null ? null : Number(log.composite_score);
  return Boolean(log.flagged) || (score != null && score < FLAG_SCORE_THRESHOLD);
}

function inclusiveDayCount(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 1;
  let count = 0;
  let cursor = dateFrom;
  while (cursor <= dateTo) {
    count += 1;
    cursor = addDays(cursor, 1);
  }
  return Math.max(count, 1);
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageMetricResponses(athleteLogs) {
  const responses = {};
  let hasAny = false;
  for (const col of WELLNESS_METRIC_COLUMNS) {
    const values = athleteLogs
      .map((log) => log.responses?.[col.key])
      .filter((value) => value != null && Number.isFinite(Number(value)))
      .map(Number);
    const avg = mean(values);
    if (avg != null) {
      responses[col.key] = Math.round(avg * 10) / 10;
      hasAny = true;
    }
  }
  return hasAny ? responses : null;
}

function computeSingleDaySummary(logs, athleteCount) {
  const scored = logs.filter((log) => log.composite_score != null);
  const average = mean(scored.map((log) => Number(log.composite_score)));
  const flagged = logs.filter(isFlaggedLog).length;
  return {
    submitted: logs.length,
    total: athleteCount,
    average,
    flagged,
    submittedLabel: 'Submitted Today',
    flaggedLabel: 'Flagged',
    submittedDisplay: `${logs.length} of ${athleteCount}`,
    flaggedDisplay: String(flagged),
  };
}

function computeRangeSummary(logs, athleteCount, dateFrom, dateTo) {
  const dayCount = inclusiveDayCount(dateFrom, dateTo);
  const scored = logs.filter((log) => log.composite_score != null);
  const average = mean(scored.map((log) => Number(log.composite_score)));

  const byDate = new Map();
  for (const log of logs) {
    const day = log.log_date;
    if (!byDate.has(day)) byDate.set(day, []);
    byDate.get(day).push(log);
  }

  const dailyFlagged = [];
  let cursor = dateFrom;
  while (cursor <= dateTo) {
    const dayLogs = byDate.get(cursor) ?? [];
    dailyFlagged.push(dayLogs.filter(isFlaggedLog).length);
    cursor = addDays(cursor, 1);
  }

  const avgDailySubmitted = logs.length / dayCount;
  const avgFlagged = mean(dailyFlagged) ?? 0;

  return {
    submitted: avgDailySubmitted,
    total: athleteCount,
    average,
    flagged: avgFlagged,
    submittedLabel: 'Avg Daily Submissions',
    flaggedLabel: 'Avg Flagged',
    submittedDisplay: `${avgDailySubmitted.toFixed(1)} of ${athleteCount}`,
    flaggedDisplay: avgFlagged.toFixed(1),
  };
}

function buildAthleteViews(athletes, logs, isSingleDay) {
  const byAthlete = new Map();
  for (const log of logs) {
    if (!byAthlete.has(log.athlete_id)) byAthlete.set(log.athlete_id, []);
    byAthlete.get(log.athlete_id).push(log);
  }

  return athletes.map((athlete) => {
    const athleteLogs = byAthlete.get(athlete.id) ?? [];
    if (isSingleDay) {
      const log = athleteLogs[0] ?? null;
      return {
        athlete,
        log,
        score: log?.composite_score == null ? null : Number(log.composite_score),
        status: log ? 'Submitted' : 'Not submitted',
        flagged: log ? isFlaggedLog(log) : false,
        sorenessAreas: Array.isArray(log?.responses?.soreness_areas)
          ? log.responses.soreness_areas
          : [],
        responses: log?.responses ?? null,
      };
    }

    const scored = athleteLogs
      .filter((log) => log.composite_score != null)
      .map((log) => Number(log.composite_score));
    const score = mean(scored);
    return {
      athlete,
      log: null,
      score,
      status: '—',
      flagged: false,
      sorenessAreas: [],
      responses: averageMetricResponses(athleteLogs),
    };
  });
}

export function useWellnessDateRange() {
  const { user, activeOrgId, activeTeamId } = useUser();
  const canView = canSync(user, 'wellness', 'view');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [athletes, setAthletes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dateRange, setDateRange] = useState(buildTodayRange());
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      if (nextRange === 'calendar') {
        const seed = dateRangeRef.current;
        const day = prev.dateFrom ?? seed.dateFrom;
        return {
          ...prev,
          range: 'calendar',
          dateFrom: day,
          dateTo: day,
        };
      }
      return { ...prev, range: nextRange, dateFrom: null, dateTo: null };
    });
  }, []);

  const setCustomDateRange = useCallback(({ dateFrom, dateTo }) => {
    setFilters((prev) => {
      if (prev.range === 'calendar') {
        const day = dateFrom || dateTo;
        return {
          ...prev,
          range: 'calendar',
          dateFrom: day,
          dateTo: day,
        };
      }
      return {
        ...prev,
        range: 'custom',
        dateFrom,
        dateTo,
      };
    });
  }, []);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const currentUser = user ?? (await getCurrentUser());
        const orgId = getEffectiveOrgId(currentUser, activeOrgId) ?? activeOrgId ?? currentUser?.orgId;
        if (!currentUser || !orgId) {
          if (mounted) {
            setAthletes([]);
            setLogs([]);
            setDateRange(buildTodayRange());
          }
          return;
        }

        const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, currentUser, activeOrgId);
        const teamIds = narrowTeamIds(effectiveTeamIds, activeTeamId);
        if (!teamIds.length) {
          if (mounted) {
            setAthletes([]);
            setLogs([]);
          }
          return;
        }

        const resolvedRange = await resolveDashboardDateRange(filters, {
          orgId,
          teamId: activeTeamId ?? teamIds[0],
        });
        const { dateFrom, dateTo } = resolvedRange;

        const { data: athleteRows, error: athleteError } = await supabase
          .from('athletes')
          .select('id, full_name, photo_url, athlete_teams!inner(team_id)')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .in('athlete_teams.team_id', teamIds)
          .order('full_name', { ascending: true });
        if (athleteError) throw athleteError;

        const athleteIds = [...new Set((athleteRows ?? []).map((athlete) => athlete.id))];
        if (!athleteIds.length) {
          if (mounted) {
            setAthletes([]);
            setLogs([]);
            setDateRange(resolvedRange);
          }
          return;
        }

        const { data: logRows, error: logError } = await supabase
          .from('wellness_logs')
          .select('athlete_id, composite_score, flagged, responses, logged_at, log_date, athletes(full_name, photo_url)')
          .eq('org_id', orgId)
          .in('team_id', teamIds)
          .gte('log_date', dateFrom)
          .lte('log_date', dateTo)
          .in('athlete_id', athleteIds)
          .order('composite_score', { ascending: true });
        if (logError) throw logError;

        if (mounted) {
          setAthletes(athleteRows ?? []);
          setLogs(logRows ?? []);
          setDateRange(resolvedRange);
        }
      } catch (err) {
        console.error('[useWellnessDateRange] loadDashboard failed:', err);
        if (mounted) setError(err.message ?? 'Failed to load wellness dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [canView, user, activeOrgId, activeTeamId, filters]);

  const isSingleDay = dateRange.dateFrom === dateRange.dateTo;

  const summary = useMemo(() => {
    if (isSingleDay) return computeSingleDaySummary(logs, athletes.length);
    return computeRangeSummary(logs, athletes.length, dateRange.dateFrom, dateRange.dateTo);
  }, [athletes.length, dateRange.dateFrom, dateRange.dateTo, isSingleDay, logs]);

  const athleteViews = useMemo(
    () => buildAthleteViews(athletes, logs, isSingleDay),
    [athletes, isSingleDay, logs],
  );

  const dateRangeLabel = useMemo(
    () => formatRange(dateRange.dateFrom, dateRange.dateTo),
    [dateRange],
  );

  return {
    canView,
    loading,
    error,
    filters,
    setRangeFilter,
    setCustomDateRange,
    athletes,
    logs,
    athleteViews,
    summary,
    isSingleDay,
    dateRange,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
    dateRangeLabel,
  };
}
