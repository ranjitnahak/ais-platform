import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { getEffectiveOrgId, narrowTeamIds, resolveOrgTeamScope } from '../lib/orgScope';
import { useUser } from '../context/UserContext';
import {
  BENCHMARK_TIER_SELECT,
  DEFAULT_PERCENTILE_BANDS,
  DEFAULT_SCORING_METHOD,
  scoringMethodNeedsTiers,
  TEST_DEFINITION_SELECT,
} from '../lib/assessmentSettingsConstants';
import {
  computeAthleteProgression,
  computeCompositeClassification,
  computeCompositePercentile,
  computeLatestDelta,
  computeSquadMultiplesProgression,
  computeTestPercentile,
  formatShortTestingDate,
} from '../lib/trendEngine';
import { athleteDisplayName } from '../lib/athleteName';
import { useCoverageData } from './useCoverageData';

const DEFAULT_FILTERS = {
  athleteId: null,
  testIds: [],
  sessionIds: [],
  scoringMethod: DEFAULT_SCORING_METHOD,
  viewMode: 'individual',
};

function buildValuesBySession(results, testIds) {
  const map = {};
  for (const row of results ?? []) {
    if (!testIds.includes(row.test_id)) continue;
    if (!map[row.session_id]) map[row.session_id] = {};
    if (!map[row.session_id][row.test_id]) map[row.session_id][row.test_id] = [];
    if (row.value != null && !Number.isNaN(Number(row.value))) {
      map[row.session_id][row.test_id].push(Number(row.value));
    }
  }
  return map;
}

function countAthleteTestsWithData(athleteId, allResults) {
  const testIds = new Set();
  for (const row of allResults ?? []) {
    if (row.athlete_id === athleteId && row.value != null && !Number.isNaN(Number(row.value))) {
      testIds.add(row.test_id);
    }
  }
  return testIds.size;
}

function countAthleteTestsAtSession(athleteId, sessionId, scopedResults) {
  const testIds = new Set();
  for (const row of scopedResults ?? []) {
    if (
      row.athlete_id === athleteId &&
      row.session_id === sessionId &&
      row.value != null &&
      !Number.isNaN(Number(row.value))
    ) {
      testIds.add(row.test_id);
    }
  }
  return testIds.size;
}

export function useAssessmentDashboard() {
  const { user, activeOrgId, activeTeamId, availableTeams } = useUser();
  const [filters, setFiltersState] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [testingDates, setTestingDates] = useState([]);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [orgResults, setOrgResults] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [athleteProfile, setAthleteProfile] = useState(null);
  const [benchmarkTiers, setBenchmarkTiers] = useState([]);
  const [percentileBands, setPercentileBands] = useState(DEFAULT_PERCENTILE_BANDS);

  const setFilter = useCallback((key, value) => {
    setFiltersState((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'viewMode' && (value === 'squad' || value === 'matrix' || value === 'coverage')) {
        next.athleteId = null;
      }
      return next;
    });
  }, []);

  const navigateToIndividual = useCallback(({ athleteId, testId }) => {
    setFiltersState((prev) => ({
      ...prev,
      viewMode: 'individual',
      athleteId,
      testIds: testId ? [testId] : prev.testIds,
    }));
  }, []);

  const effectiveTeamId = useMemo(() => {
    const ids = availableTeams?.map((t) => t.id) ?? [];
    if (activeTeamId && ids.includes(activeTeamId)) return activeTeamId;
    return ids[0] ?? null;
  }, [activeTeamId, availableTeams]);

  const teamName = useMemo(
    () => availableTeams?.find((t) => t.id === effectiveTeamId)?.name ?? '',
    [availableTeams, effectiveTeamId],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const currentUser = user ?? (await getCurrentUser());
        const orgId = getEffectiveOrgId(currentUser, activeOrgId);
        const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, currentUser, activeOrgId);
        const teamIds = narrowTeamIds(effectiveTeamIds, activeTeamId);

        if (!orgId || !teamIds.length) {
          if (!cancelled) {
            setTestingDates([]);
            setTests([]);
            setResults([]);
            setOrgResults([]);
            setAthletes([]);
            setBenchmarkTiers([]);
          }
          return;
        }

        const teamId = teamIds[0];

        const [sessionsRes, testsRes, orgRes, tiersRes] = await Promise.all([
          supabase
            .from('assessment_sessions')
            .select('id, assessed_on, name, team_id')
            .eq('org_id', orgId)
            .in('team_id', teamIds)
            .order('assessed_on', { ascending: false }),
          supabase
            .from('test_definitions')
            .select(TEST_DEFINITION_SELECT)
            .eq('org_id', orgId)
            .or(`team_id.eq.${teamId},team_id.is.null`)
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('organisations')
            .select('theme_config')
            .eq('id', orgId)
            .maybeSingle(),
          scoringMethodNeedsTiers(filters.scoringMethod)
            ? supabase
                .from('benchmark_tiers')
                .select(BENCHMARK_TIER_SELECT)
                .eq('org_id', orgId)
                .eq('team_id', teamId)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (testsRes.error) throw testsRes.error;
        if (orgRes.error) throw orgRes.error;
        if (tiersRes.error) throw tiersRes.error;

        const sessionRows = sessionsRes.data ?? [];
        const testRows = testsRes.data ?? [];
        const bands =
          orgRes.data?.theme_config?.assessment_percentile_bands ?? DEFAULT_PERCENTILE_BANDS;

        const { data: membershipRows, error: membershipErr } = await supabase
          .from('athlete_teams')
          .select('athlete_id, athletes!inner(id, first_name, last_name, full_name, photo_url, position, date_of_birth, gender, org_id, is_active)')
          .in('team_id', teamIds)
          .eq('athletes.is_active', true);
        if (membershipErr) throw membershipErr;

        const athleteMap = new Map();
        for (const row of membershipRows ?? []) {
          const athlete = row.athletes;
          const athleteRow = Array.isArray(athlete) ? athlete[0] : athlete;
          if (athleteRow?.org_id === orgId) athleteMap.set(athleteRow.id, athleteRow);
        }
        const athleteRows = [...athleteMap.values()].sort((a, b) =>
          athleteDisplayName(a).localeCompare(athleteDisplayName(b)),
        );

        const sessionIdsToFetch = sessionRows.map((s) => s.id);

        let resultRows = [];
        if (sessionIdsToFetch.length) {
          const { data, error: resultsErr } = await supabase
            .from('assessment_results')
            .select('id, session_id, athlete_id, test_id, value')
            .in('session_id', sessionIdsToFetch);
          if (resultsErr) throw resultsErr;
          resultRows = data ?? [];
        }

        let orgResultRows = [];
        if (filters.scoringMethod === 'org_percentile' && sessionIdsToFetch.length) {
          const allDates = [...new Set(sessionRows.map((s) => s.assessed_on))];
          const { data: orgSessions, error: orgSessionsErr } = await supabase
            .from('assessment_sessions')
            .select('id')
            .eq('org_id', orgId)
            .in('assessed_on', allDates);
          if (orgSessionsErr) throw orgSessionsErr;
          const orgSessionIds = (orgSessions ?? []).map((s) => s.id);
          if (orgSessionIds.length) {
            const { data, error: orgResultsErr } = await supabase
              .from('assessment_results')
              .select('id, session_id, athlete_id, test_id, value')
              .in('session_id', orgSessionIds);
            if (orgResultsErr) throw orgResultsErr;
            orgResultRows = data ?? [];
          }
        }

        if (!cancelled) {
          setTestingDates(sessionRows);
          setTests(testRows);
          setResults(resultRows);
          setOrgResults(orgResultRows);
          setAthletes(athleteRows);
          setBenchmarkTiers(tiersRes.data ?? []);
          setPercentileBands(bands);

          setFiltersState((prev) => {
            const next = { ...prev };
            const validTestIds = new Set(testRows.map((t) => t.id));
            const validSessionIds = new Set(sessionRows.map((s) => s.id));
            const allTestIds = testRows.map((t) => t.id);

            if (!next.testIds.length && testRows.length) {
              next.testIds = allTestIds;
            } else {
              next.testIds = next.testIds.filter((id) => validTestIds.has(id));
              if (!next.testIds.length && allTestIds.length) {
                next.testIds = allTestIds;
              }
            }

            if (!next.sessionIds.length && sessionRows.length) {
              next.sessionIds = sessionRows
                .slice(0, Math.min(3, sessionRows.length))
                .map((s) => s.id);
            } else {
              next.sessionIds = next.sessionIds.filter((id) => validSessionIds.has(id));
            }

            return next;
          });
        }
      } catch (err) {
        console.error('[useAssessmentDashboard] load failed:', err);
        if (!cancelled) setError(err.message ?? 'Failed to load assessment data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, activeOrgId, activeTeamId, filters.scoringMethod]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!filters.athleteId) {
        setAthleteProfile(null);
        return;
      }

      try {
        const currentUser = user ?? (await getCurrentUser());
        const orgId = getEffectiveOrgId(currentUser, activeOrgId);
        const { data, error: profileErr } = await supabase
          .from('athletes')
          .select('id, first_name, last_name, full_name, photo_url, position, date_of_birth, gender, org_id')
          .eq('org_id', orgId)
          .eq('id', filters.athleteId)
          .maybeSingle();
        if (profileErr) throw profileErr;
        if (!cancelled) setAthleteProfile(data);
      } catch (err) {
        console.error('[useAssessmentDashboard] profile load failed:', err);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [filters.athleteId, user, activeOrgId]);

  const selectedTestingDates = useMemo(
    () =>
      testingDates
        .filter((s) => filters.sessionIds.includes(s.id))
        .sort((a, b) => new Date(a.assessed_on) - new Date(b.assessed_on)),
    [testingDates, filters.sessionIds],
  );

  const allSessions = useMemo(
    () => [...testingDates].sort((a, b) => new Date(a.assessed_on) - new Date(b.assessed_on)),
    [testingDates],
  );

  const selectedTests = useMemo(
    () => tests.filter((t) => filters.testIds.includes(t.id)),
    [tests, filters.testIds],
  );

  const testsById = useMemo(
    () => Object.fromEntries(tests.map((t) => [t.id, t])),
    [tests],
  );

  const testDirections = useMemo(
    () => Object.fromEntries(tests.map((t) => [t.id, t.direction ?? 'higher_is_better'])),
    [tests],
  );

  const benchmarkTiersByTest = useMemo(() => {
    const map = {};
    for (const tier of benchmarkTiers) {
      if (!map[tier.test_id]) map[tier.test_id] = [];
      map[tier.test_id].push(tier);
    }
    return map;
  }, [benchmarkTiers]);

  const filteredResults = useMemo(
    () =>
      results.filter(
        (r) =>
          filters.sessionIds.includes(r.session_id) &&
          filters.testIds.includes(r.test_id),
      ),
    [results, filters.sessionIds, filters.testIds],
  );

  const dateScopeMode = useMemo(() => {
    const n = filters.sessionIds.length;
    if (n === 0) return 'empty';
    if (n === 1) return 'snapshot';
    return 'window';
  }, [filters.sessionIds.length]);

  const dateScopeHint = useMemo(() => {
    if (dateScopeMode === 'empty') return null;
    if (dateScopeMode === 'snapshot') {
      const session = selectedTestingDates[0];
      return session
        ? `Showing results for ${formatShortTestingDate(session.assessed_on)}`
        : null;
    }
    const n = selectedTestingDates.length;
    return `Showing latest within ${n} selected dates · deltas vs previous selected date`;
  }, [dateScopeMode, selectedTestingDates]);

  const squadValuesBySession = useMemo(
    () => buildValuesBySession(filteredResults, filters.testIds),
    [filteredResults, filters.testIds],
  );

  const orgValuesBySession = useMemo(() => {
    if (filters.scoringMethod !== 'org_percentile') return squadValuesBySession;
    return buildValuesBySession(orgResults, filters.testIds);
  }, [filters.scoringMethod, orgResults, filters.testIds, squadValuesBySession]);

  const tierFallbackFlags = useMemo(() => {
    const flags = {};
    if (filters.scoringMethod !== 'absolute' && filters.scoringMethod !== 'both') return flags;
    for (const testId of filters.testIds) {
      const tiers = benchmarkTiersByTest[testId] ?? [];
      const hasTiers = tiers.some((t) => t.threshold_min != null || t.threshold_max != null);
      flags[testId] = !hasTiers;
    }
    return flags;
  }, [filters.scoringMethod, filters.testIds, benchmarkTiersByTest]);

  const individualProgressions = useMemo(() => {
    if (filters.viewMode !== 'individual' || !filters.athleteId) return {};
    const gender = athleteProfile?.gender;
    const map = {};
    for (const test of selectedTests) {
      map[test.id] = computeAthleteProgression({
        athleteId: filters.athleteId,
        testId: test.id,
        testingDates: selectedTestingDates,
        results: filteredResults,
        benchmarkTiers: benchmarkTiersByTest[test.id] ?? [],
        percentileBands,
        direction: test.direction ?? 'higher_is_better',
        squadValuesBySession,
        orgValuesBySession,
        scoringMethod: filters.scoringMethod,
        gender,
      });
    }
    return map;
  }, [
    filters.viewMode,
    filters.athleteId,
    filters.scoringMethod,
    selectedTests,
    selectedTestingDates,
    filteredResults,
    benchmarkTiersByTest,
    percentileBands,
    squadValuesBySession,
    orgValuesBySession,
    athleteProfile?.gender,
  ]);

  const summaryCardDeltas = useMemo(() => {
    if (filters.viewMode !== 'individual' || !filters.athleteId) return {};
    const map = {};
    for (const test of selectedTests) {
      map[test.id] = computeLatestDelta({
        athleteId: filters.athleteId,
        testId: test.id,
        allResults: results,
        allSessions,
        direction: test.direction ?? 'higher_is_better',
      });
    }
    return map;
  }, [filters.viewMode, filters.athleteId, selectedTests, results, allSessions]);

  const summaryCardPercentiles = useMemo(() => {
    if (filters.viewMode !== 'individual' || !filters.athleteId) return {};
    const map = {};
    for (const test of selectedTests) {
      const latest = summaryCardDeltas[test.id];
      if (!latest?.latestSessionId) {
        map[test.id] = null;
        continue;
      }
      map[test.id] = computeTestPercentile({
        athleteId: filters.athleteId,
        testId: test.id,
        testingDateId: latest.latestSessionId,
        allAthleteResults: results,
        direction: test.direction ?? 'higher_is_better',
        percentileBands,
      });
    }
    return map;
  }, [
    filters.viewMode,
    filters.athleteId,
    selectedTests,
    summaryCardDeltas,
    results,
    percentileBands,
  ]);

  const compositeClassification = useMemo(() => {
    if (filters.viewMode !== 'individual' || !filters.athleteId) return null;
    return computeCompositeClassification({
      athleteId: filters.athleteId,
      testIds: filters.testIds,
      testingDates: selectedTestingDates,
      allAthleteResults: results,
      testDirections,
      percentileBands,
    });
  }, [
    filters.viewMode,
    filters.athleteId,
    filters.testIds,
    selectedTestingDates,
    results,
    testDirections,
    percentileBands,
  ]);

  const squadTestMultiples = useMemo(() => {
    if (filters.viewMode !== 'squad' || dateScopeMode === 'empty') return {};
    const map = {};
    for (const test of selectedTests) {
      map[test.id] = computeSquadMultiplesProgression({
        testId: test.id,
        allSessions: selectedTestingDates,
        allResults: filteredResults,
        athletes,
        direction: test.direction ?? 'higher_is_better',
      });
    }
    return map;
  }, [
    filters.viewMode,
    dateScopeMode,
    selectedTests,
    selectedTestingDates,
    filteredResults,
    athletes,
  ]);

  const matrixRows = useMemo(() => {
    if (filters.viewMode !== 'matrix' || dateScopeMode === 'empty') return [];

    const isSnapshot = dateScopeMode === 'snapshot';
    const snapshotSessionId = isSnapshot ? selectedTestingDates[0]?.id : null;

    return athletes.map((athlete) => {
      const testsMap = {};
      for (const test of selectedTests) {
        const latest = computeLatestDelta({
          athleteId: athlete.id,
          testId: test.id,
          allResults: filteredResults,
          allSessions: selectedTestingDates,
          direction: test.direction ?? 'higher_is_better',
        });

        let tierName = null;
        let tierColor = null;
        if (latest.latestSessionId && latest.latestValue != null) {
          const pct = computeTestPercentile({
            athleteId: athlete.id,
            testId: test.id,
            testingDateId: latest.latestSessionId,
            allAthleteResults: filteredResults,
            direction: test.direction ?? 'higher_is_better',
            percentileBands,
          });
          tierName = pct.tier;
          tierColor = pct.tierColor;
        }

        testsMap[test.id] = {
          latestValue: latest.latestValue,
          delta: latest.hasPrevious ? latest.delta : null,
          tierName,
          tierColor,
        };
      }

      let compositePercentile = null;
      let compositeTier = null;
      let compositeTierColor = null;

      if (isSnapshot && snapshotSessionId) {
        const testsAtSession = countAthleteTestsAtSession(
          athlete.id,
          snapshotSessionId,
          filteredResults,
        );
        if (testsAtSession >= 2) {
          const composite = computeCompositePercentile({
            athleteId: athlete.id,
            testIds: filters.testIds,
            testingDateId: snapshotSessionId,
            allAthleteResults: filteredResults,
            testDirections,
            percentileBands,
          });
          compositePercentile = composite.percentile;
          compositeTier = composite.tier;
          compositeTierColor = composite.tierColor;
        }
      } else {
        const testCount = countAthleteTestsWithData(athlete.id, results);
        if (testCount >= 2) {
          const sessionsDescending = [...selectedTestingDates].reverse();
          for (const session of sessionsDescending) {
            const testsAtSession = countAthleteTestsAtSession(
              athlete.id,
              session.id,
              filteredResults,
            );
            if (testsAtSession < 2) continue;
            const composite = computeCompositePercentile({
              athleteId: athlete.id,
              testIds: filters.testIds,
              testingDateId: session.id,
              allAthleteResults: filteredResults,
              testDirections,
              percentileBands,
            });
            if (composite.percentile != null) {
              compositePercentile = composite.percentile;
              compositeTier = composite.tier;
              compositeTierColor = composite.tierColor;
              break;
            }
          }
        }
      }

      return {
        athleteId: athlete.id,
        athlete,
        tests: testsMap,
        compositePercentile,
        compositeTier,
        compositeTierColor,
      };
    });
  }, [
    filters.viewMode,
    filters.testIds,
    dateScopeMode,
    athletes,
    selectedTests,
    selectedTestingDates,
    filteredResults,
    results,
    testDirections,
    percentileBands,
  ]);

  const allTierCrossings = useMemo(() => {
    const crossings = [];
    for (const [testId, progression] of Object.entries(individualProgressions)) {
      for (const crossing of progression.tierCrossings ?? []) {
        crossings.push({
          ...crossing,
          testId,
          testName: testsById[testId]?.name ?? 'Test',
        });
      }
    }
    return crossings;
  }, [individualProgressions, testsById]);

  const coverageData = useCoverageData({
    enabled: filters.viewMode === 'coverage',
    athletes,
    results: filteredResults,
    selectedTests,
    selectedTestingDates,
  });

  return {
    loading,
    error,
    filters,
    setFilter,
    navigateToIndividual,
    testingDates,
    tests,
    athletes,
    selectedTests,
    selectedTestingDates,
    athleteProfile,
    teamName,
    effectiveTeamId,
    individualProgressions,
    summaryCardDeltas,
    summaryCardPercentiles,
    compositeClassification,
    squadTestMultiples,
    matrixRows,
    dateScopeMode,
    dateScopeHint,
    tierFallbackFlags,
    percentileBands,
    benchmarkTiersByTest,
    allTierCrossings,
    testsById,
    allSessions,
    coverageData,
  };
}
