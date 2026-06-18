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
  computeOverallClassification,
  computeSquadProgression,
} from '../lib/trendEngine';
import { athleteDisplayName } from '../lib/athleteName';

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
      if (key === 'viewMode' && value === 'squad') {
        next.athleteId = null;
        if (next.testIds.length > 1) {
          next.testIds = [next.testIds[0]];
        }
      }
      return next;
    });
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
          .select('athlete_id, athletes(id, first_name, last_name, full_name, photo_url, position, date_of_birth, gender, org_id)')
          .in('team_id', teamIds);
        if (membershipErr) throw membershipErr;

        const athleteMap = new Map();
        for (const row of membershipRows ?? []) {
          const athlete = row.athletes;
          if (athlete?.org_id === orgId) athleteMap.set(athlete.id, athlete);
        }
        const athleteRows = [...athleteMap.values()].sort((a, b) =>
          athleteDisplayName(a).localeCompare(athleteDisplayName(b)),
        );

        const sessionIdsToFetch =
          filters.sessionIds.length > 0
            ? filters.sessionIds
            : sessionRows.map((s) => s.id);

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
          const selectedDates = [
            ...new Set(
              sessionRows
                .filter((s) => sessionIdsToFetch.includes(s.id))
                .map((s) => s.assessed_on),
            ),
          ];
          const { data: orgSessions, error: orgSessionsErr } = await supabase
            .from('assessment_sessions')
            .select('id')
            .eq('org_id', orgId)
            .in('assessed_on', selectedDates);
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

            if (!next.testIds.length && testRows.length) {
              next.testIds = testRows.slice(0, Math.min(3, testRows.length)).map((t) => t.id);
            } else {
              next.testIds = next.testIds.filter((id) => validTestIds.has(id));
            }

            if (!next.sessionIds.length && sessionRows.length) {
              next.sessionIds = sessionRows
                .slice(0, Math.min(3, sessionRows.length))
                .map((s) => s.id);
            } else {
              next.sessionIds = next.sessionIds.filter((id) => validSessionIds.has(id));
            }

            if (next.viewMode === 'squad' && next.testIds.length > 1) {
              next.testIds = [next.testIds[0]];
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
  }, [user, activeOrgId, activeTeamId, filters.scoringMethod, filters.sessionIds.join(','), filters.viewMode]);

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
    () => testingDates.filter((s) => filters.sessionIds.includes(s.id)),
    [testingDates, filters.sessionIds],
  );

  const selectedTests = useMemo(
    () => tests.filter((t) => filters.testIds.includes(t.id)),
    [tests, filters.testIds],
  );

  const testsById = useMemo(
    () => Object.fromEntries(tests.map((t) => [t.id, t])),
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

  const overallClassification = useMemo(() => {
    if (filters.viewMode !== 'individual' || !filters.athleteId) return null;
    return computeOverallClassification({
      athleteId: filters.athleteId,
      testIds: filters.testIds,
      testingDates: selectedTestingDates,
      results: filteredResults,
      testsById,
      squadValuesBySession,
      orgValuesBySession,
      scoringMethod: filters.scoringMethod,
      percentileBands,
      benchmarkTiersByTest,
      gender: athleteProfile?.gender,
    });
  }, [
    filters.viewMode,
    filters.athleteId,
    filters.testIds,
    filters.scoringMethod,
    selectedTestingDates,
    filteredResults,
    testsById,
    squadValuesBySession,
    orgValuesBySession,
    percentileBands,
    benchmarkTiersByTest,
    athleteProfile?.gender,
  ]);

  const squadProgression = useMemo(() => {
    if (filters.viewMode !== 'squad' || !filters.testIds.length) return [];
    const testId = filters.testIds[0];
    const test = testsById[testId];
    if (!test) return [];
    return computeSquadProgression({
      testId,
      testingDates: selectedTestingDates,
      results: filteredResults,
      athletes,
      benchmarkTiers: benchmarkTiersByTest[testId] ?? [],
      percentileBands,
      direction: test.direction ?? 'higher_is_better',
      squadValuesBySession,
      orgValuesBySession,
      scoringMethod: filters.scoringMethod,
    });
  }, [
    filters.viewMode,
    filters.testIds,
    filters.scoringMethod,
    selectedTestingDates,
    filteredResults,
    athletes,
    benchmarkTiersByTest,
    percentileBands,
    squadValuesBySession,
    orgValuesBySession,
    testsById,
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

  return {
    loading,
    error,
    filters,
    setFilter,
    testingDates,
    tests,
    athletes,
    selectedTests,
    selectedTestingDates,
    athleteProfile,
    teamName,
    individualProgressions,
    overallClassification,
    squadProgression,
    tierFallbackFlags,
    percentileBands,
    benchmarkTiersByTest,
    allTierCrossings,
    testsById,
  };
}
