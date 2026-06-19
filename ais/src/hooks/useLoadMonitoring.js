import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { getEffectiveOrgId, narrowTeamIds, resolveOrgTeamScope } from '../lib/orgScope';
import { useUser } from '../context/UserContext';
import { addDays, weekStartsBetween } from '../lib/periodisationUtils';
import {
  calculateACWR,
  calculateEWMA,
  calculateMonotony,
  calculateRollingAverage,
  calculateStrain,
  bucketRpe,
  resolveSessionLoad,
} from '../lib/loadCalculations';

const RANGE_DAYS = { '1W': 7, '2W': 14, '4W': 28, '8W': 56 };

function buildDateRange(selectedRange) {
  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - (RANGE_DAYS[selectedRange] ?? 28));
  return {
    dateFrom: rangeStart.toISOString().split('T')[0],
    dateTo: today.toISOString().split('T')[0],
  };
}

function buildDailyDates(dateFrom, dateTo) {
  const dates = [];
  let cur = dateFrom;
  while (cur <= dateTo) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

function formatShortDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function computeLoadSeries(dailyLoads, method) {
  if (method === 'rolling') {
    return {
      acute: calculateRollingAverage(dailyLoads, 7),
      chronic: calculateRollingAverage(dailyLoads, 28),
    };
  }
  return {
    acute: calculateEWMA(dailyLoads, 7),
    chronic: calculateEWMA(dailyLoads, 28),
  };
}

function resolveLogSessionDate(log, sessionsById) {
  const session = log.session_id ? sessionsById[log.session_id] : null;
  return session?.session_date ?? log.session_date ?? null;
}

function buildDailyLoadsForAthlete(dates, sessionsById, logs, athleteId) {
  const loadsByDate = Object.fromEntries(dates.map((d) => [d, 0]));
  for (const log of logs) {
    if (athleteId && log.athlete_id !== athleteId) continue;
    const sessionDate = resolveLogSessionDate(log, sessionsById);
    if (!sessionDate) continue;
    const load = resolveSessionLoad(log);
    if (load > 0 || log.actual_rpe != null) {
      loadsByDate[sessionDate] = (loadsByDate[sessionDate] ?? 0) + load;
    }
  }
  return dates.map((d) => loadsByDate[d] ?? 0);
}

function buildSquadDailyLoads(dates, sessionsById, logs, athleteIds) {
  const loadsByDate = Object.fromEntries(dates.map((d) => [d, 0]));
  for (const log of logs) {
    if (athleteIds?.length && !athleteIds.includes(log.athlete_id)) continue;
    const sessionDate = resolveLogSessionDate(log, sessionsById);
    if (!sessionDate) continue;
    loadsByDate[sessionDate] = (loadsByDate[sessionDate] ?? 0) + resolveSessionLoad(log);
  }
  return dates.map((d) => loadsByDate[d] ?? 0);
}

function computeWeeklyMonotony(dates, dailyLoads) {
  const dateFrom = dates[0];
  const dateTo = dates[dates.length - 1];
  const weeks = weekStartsBetween(dateFrom, dateTo);
  const loadsByDate = Object.fromEntries(dates.map((d, i) => [d, dailyLoads[i]]));
  return weeks.map((week, idx) => {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week.monday, i));
    const weekLoads = weekDays.map((d) => loadsByDate[d] ?? 0);
    const monotony = calculateMonotony(weekLoads);
    const weeklyTotal = weekLoads.reduce((a, b) => a + b, 0);
    return {
      label: `W${idx + 1}`,
      monotony,
      strain: calculateStrain(weeklyTotal, monotony),
      weeklyTotal,
    };
  });
}

function countLoggedSessions(logs, sessionsById, athleteId) {
  return logs.filter((log) => {
    if (log.athlete_id !== athleteId) return false;
    if (log.actual_rpe == null) return false;
    if (log.session_id) return Boolean(sessionsById[log.session_id]);
    return Boolean(log.session_date);
  }).length;
}

const DEFAULT_FILTERS = {
  range: '4W',
  athleteId: '',
  sessionType: 'all',
  method: 'ewma',
};

export function useLoadMonitoring() {
  const { user, activeOrgId, activeTeamId } = useUser();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const currentUser = user ?? (await getCurrentUser());
        const orgId = getEffectiveOrgId(currentUser, activeOrgId);
        if (!currentUser || !orgId) {
          if (mounted) {
            setSessions([]);
            setLogs([]);
            setAthletes([]);
          }
          return;
        }

        const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, currentUser, activeOrgId);
        const teamIds = narrowTeamIds(effectiveTeamIds, activeTeamId);
        if (!teamIds.length) {
          if (mounted) {
            setSessions([]);
            setLogs([]);
            setAthletes([]);
          }
          return;
        }

        const { dateFrom, dateTo } = buildDateRange(filters.range);

        let sessionsQuery = supabase
          .from('sessions')
          .select('id, session_date, start_time, session_type, rpe_planned, duration_planned, team_id, name')
          .eq('org_id', orgId)
          .in('team_id', teamIds)
          .gte('session_date', dateFrom)
          .lte('session_date', dateTo);

        if (filters.sessionType !== 'all') {
          sessionsQuery = sessionsQuery.eq('session_type', filters.sessionType);
        }

        const athletesQuery = supabase
          .from('athlete_teams')
          .select('athlete_id, team_id, athletes!inner(id, full_name, position, photo_url, org_id, is_active)')
          .in('team_id', teamIds)
          .eq('athletes.org_id', orgId)
          .eq('athletes.is_active', true)
          .is('left_at', null);

        let sessionRows = [];
        let logRows = [];
        let athleteRows = [];

        try {
          const { data, error: sessionsError } = await sessionsQuery;
          if (sessionsError) throw sessionsError;
          sessionRows = data ?? [];
        } catch (err) {
          console.error('[useLoadMonitoring] sessions fetch failed:', err);
          throw err;
        }

        const sessionIds = sessionRows.map((s) => s.id);

        let linkedLogRows = [];
        try {
          if (sessionIds.length) {
            const { data, error: logsError } = await supabase
              .from('session_athlete_logs')
              .select('session_id, athlete_id, actual_rpe, actual_duration_min, session_load, logged_at')
              .eq('org_id', orgId)
              .in('session_id', sessionIds);
            if (logsError) throw logsError;
            linkedLogRows = data ?? [];
          }
        } catch (err) {
          console.error('[useLoadMonitoring] logs fetch failed:', err);
          throw err;
        }

        let orphanLogRows = [];
        try {
          let orphanQuery = supabase
            .from('session_athlete_logs')
            .select('session_id, athlete_id, actual_rpe, actual_duration_min, session_load, logged_at, session_date, session_type')
            .eq('org_id', orgId)
            .in('team_id', teamIds)
            .is('session_id', null)
            .eq('source', 'teamworks_import')
            .not('session_date', 'is', null)
            .gte('session_date', dateFrom)
            .lte('session_date', dateTo);
          if (filters.sessionType !== 'all') {
            orphanQuery = orphanQuery.eq('session_type', filters.sessionType);
          }
          const { data: orphanData, error: orphanErr } = await orphanQuery;
          if (orphanErr) throw orphanErr;
          orphanLogRows = orphanData ?? [];
        } catch (err) {
          console.error('[useLoadMonitoring] orphan import logs fetch failed:', err);
          throw err;
        }

        logRows = [...linkedLogRows, ...orphanLogRows];

        try {
          const { data, error: athletesError } = await athletesQuery;
          if (athletesError) throw athletesError;
          const rawRows = data ?? [];
          const seen = new Set();
          athleteRows = rawRows.reduce((acc, row) => {
            const athlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes;
            if (!athlete || seen.has(athlete.id)) return acc;
            seen.add(athlete.id);
            acc.push({ ...athlete, teamIds: [row.team_id] });
            return acc;
          }, []);
          for (const row of rawRows) {
            const athlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes;
            if (!athlete) continue;
            const existing = athleteRows.find((a) => a.id === athlete.id);
            if (existing && !existing.teamIds.includes(row.team_id)) {
              existing.teamIds.push(row.team_id);
            }
          }
        } catch (err) {
          console.error('[useLoadMonitoring] athletes fetch failed:', err);
          throw err;
        }

        if (!mounted) return;
        setSessions(sessionRows);
        setLogs(logRows);
        setAthletes(athleteRows);
      } catch (err) {
        console.error('[useLoadMonitoring]', err);
        if (mounted) setError(err.message ?? 'Failed to load monitoring data');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [user, activeOrgId, activeTeamId, filters.range, filters.sessionType]);

  const viewModel = useMemo(() => {
    const { dateFrom, dateTo } = buildDateRange(filters.range);
    const dates = buildDailyDates(dateFrom, dateTo);
    const sessionsById = Object.fromEntries(sessions.map((s) => [s.id, s]));
    const athleteIds = athletes.map((a) => a.id);
    const isSquadView = !filters.athleteId;
    const targetAthleteId = filters.athleteId || null;

    const dailyLoads = isSquadView
      ? buildSquadDailyLoads(dates, sessionsById, logs, athleteIds)
      : buildDailyLoadsForAthlete(dates, sessionsById, logs, targetAthleteId);

    const { acute, chronic } = computeLoadSeries(dailyLoads, filters.method);
    const acwrSeries = dates.map((_, i) => calculateACWR(acute[i], chronic[i]));

    const weeklyData = computeWeeklyMonotony(dates, dailyLoads);
    const latestWeek = weeklyData[weeklyData.length - 1] ?? { monotony: null, strain: null, weeklyTotal: 0 };

    const lastIdx = dates.length - 1;
    const latestAcute = acute[lastIdx] ?? null;
    const latestChronic = chronic[lastIdx] ?? null;
    const latestAcwr = acwrSeries[lastIdx] ?? null;

    const squadRows = athletes.map((athlete) => {
      const athleteDaily = buildDailyLoadsForAthlete(dates, sessionsById, logs, athlete.id);
      const { acute: aAcute, chronic: aChronic } = computeLoadSeries(athleteDaily, filters.method);
      const aAcwrSeries = dates.map((_, i) => calculateACWR(aAcute[i], aChronic[i]));
      const sessionCount = countLoggedSessions(logs, sessionsById, athlete.id);
      const athleteWeeks = computeWeeklyMonotony(dates, athleteDaily);
      const athleteLatestWeek = athleteWeeks[athleteWeeks.length - 1] ?? { monotony: null, strain: null };
      const idx = dates.length - 1;
      const insufficientData = sessionCount < 3;

      return {
        athlete,
        acwr: insufficientData ? null : (aAcwrSeries[idx] ?? null),
        insufficientData,
        monotony: athleteLatestWeek.monotony,
        strain: athleteLatestWeek.strain,
        sessions: sessionCount,
      };
    }).sort((a, b) => {
      const av = a.acwr ?? -1;
      const bv = b.acwr ?? -1;
      return bv - av;
    });

    const validAcwrs = squadRows.filter((r) => r.acwr != null).map((r) => r.acwr);
    const avgAcwr = validAcwrs.length
      ? parseFloat((validAcwrs.reduce((s, v) => s + v, 0) / validAcwrs.length).toFixed(2))
      : null;

    const statCards = {
      avgAcwr: isSquadView ? avgAcwr : latestAcwr,
      acute: latestAcute,
      chronic: latestChronic,
      monotony: latestWeek.monotony,
      strain: latestWeek.strain,
    };

    const sortedSessions = [...sessions].sort((a, b) => {
      const dateCmp = b.session_date.localeCompare(a.session_date);
      if (dateCmp !== 0) return dateCmp;
      return (b.start_time ?? '').localeCompare(a.start_time ?? '');
    });
    const mostRecentSession = sortedSessions[0] ?? null;

    let rpeCompliance = { logged: 0, pending: 0, absent: 0, percent: 0, sessionLabel: null, sessionDate: null };
    if (mostRecentSession) {
      const sessionLogs = logs.filter((l) => l.session_id === mostRecentSession.id);
      const logged = sessionLogs.filter((l) => l.actual_rpe != null).length;
      const pending = sessionLogs.filter((l) => l.actual_rpe == null).length;
      const loggedAthleteIds = new Set(sessionLogs.map((l) => l.athlete_id));
      const rosterOnTeam = athletes.filter((a) =>
        (a.teamIds ?? []).includes(mostRecentSession.team_id),
      );
      const absent = rosterOnTeam.filter((a) => !loggedAthleteIds.has(a.id)).length;
      const total = logged + pending + absent;
      rpeCompliance = {
        logged,
        pending,
        absent,
        percent: total ? Math.round((logged / total) * 100) : 0,
        sessionLabel: mostRecentSession.name || mostRecentSession.session_type,
        sessionType: mostRecentSession.session_type,
        sessionDate: mostRecentSession.session_date,
      };
    }

    const rpeBands = { '1-3': 0, '4-5': 0, '6-7': 0, '8-9': 0, '10': 0 };
    const filteredLogs = isSquadView
      ? logs
      : logs.filter((l) => l.athlete_id === targetAthleteId);
    for (const log of filteredLogs) {
      if (log.actual_rpe == null) continue;
      const band = bucketRpe(log.actual_rpe);
      if (band) rpeBands[band] += 1;
    }
    const totalResponses = Object.values(rpeBands).reduce((s, v) => s + v, 0);

    let spikeWarning = null;
    const atRisk = squadRows.filter(
      (r) => (r.acwr != null && r.acwr > 1.5) || (r.monotony != null && r.monotony > 1.5),
    );
    if (atRisk.length) {
      const worst = atRisk.reduce((best, row) => {
        const score = Math.max(
          row.acwr != null ? row.acwr - 1.5 : 0,
          row.monotony != null ? row.monotony - 1.5 : 0,
        );
        const bestScore = Math.max(
          best.acwr != null ? best.acwr - 1.5 : 0,
          best.monotony != null ? best.monotony - 1.5 : 0,
        );
        return score > bestScore ? row : best;
      });
      spikeWarning = {
        name: worst.athlete.full_name,
        acwr: worst.acwr,
        monotony: worst.monotony,
      };
    }

    const dataWarnings = [];
    if (filters.method === 'rolling' && dates.length < 28) {
      dataWarnings.push('Rolling average requires 28 days of data for a reliable chronic baseline.');
    }
    if (filters.method === 'ewma' && dates.length < 5) {
      dataWarnings.push('EWMA requires at least 5 days of data to stabilise.');
    }

    const rangeLabel = filters.range;
    const methodLabel = filters.method === 'ewma' ? 'EWMA' : 'Rolling average';

    return {
      dates,
      dateLabels: dates.map(formatShortDate),
      dailyLoads,
      acwrSeries: { acute, chronic, acwr: acwrSeries },
      weeklyMonotony: weeklyData,
      statCards,
      squadRows,
      rpeCompliance,
      rpeDistribution: { bands: rpeBands, total: totalResponses },
      spikeWarning,
      dataWarnings,
      isSquadView,
      rangeLabel,
      methodLabel,
      dateFrom,
      dateTo,
    };
  }, [sessions, logs, athletes, filters]);

  return {
    loading,
    error,
    filters,
    setFilter,
    athletes,
    ...viewModel,
  };
}
