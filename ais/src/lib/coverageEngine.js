import { athleteDisplayName } from './athleteName';

/**
 * Build athleteId -> sessionId -> Set<testId> from assessment_results rows.
 * Presence = at least one row for (athlete, session, test); multiple trials deduped.
 */
export function buildCoverageIndex(results, testIds, sessionIds) {
  const testIdSet = new Set(testIds);
  const sessionIdSet = new Set(sessionIds);
  const index = {};

  for (const row of results ?? []) {
    if (!testIdSet.has(row.test_id)) continue;
    if (!sessionIdSet.has(row.session_id)) continue;

    if (!index[row.athlete_id]) index[row.athlete_id] = {};
    if (!index[row.athlete_id][row.session_id]) {
      index[row.athlete_id][row.session_id] = new Set();
    }
    index[row.athlete_id][row.session_id].add(row.test_id);
  }

  return index;
}

function countTestsForAthleteSession(index, athleteId, sessionId) {
  return index[athleteId]?.[sessionId]?.size ?? 0;
}

export function computeDateSummaries({ athletes, selectedTestingDates, selectedTests, index }) {
  const squadSize = athletes.length;
  const testCount = selectedTests.length;

  return selectedTestingDates.map((session) => {
    let testedCount = 0;
    let fullyTestedCount = 0;
    const missingAthletes = [];

    for (const athlete of athletes) {
      const completed = countTestsForAthleteSession(index, athlete.id, session.id);
      if (completed >= 1) testedCount += 1;
      if (completed === testCount && testCount > 0) fullyTestedCount += 1;
      if (completed === 0) missingAthletes.push(athlete);
    }

    return {
      session,
      testedCount,
      fullyTestedCount,
      squadSize,
      testCount,
      missingAthletes,
    };
  });
}

export function computeTestDateMatrix({ athletes, selectedTestingDates, selectedTests, index }) {
  const squadSize = athletes.length;

  return selectedTests.map((test) => ({
    test,
    cells: selectedTestingDates.map((session) => {
      let count = 0;
      for (const athlete of athletes) {
        if (index[athlete.id]?.[session.id]?.has(test.id)) count += 1;
      }
      const pct = squadSize ? Math.round((count / squadSize) * 100) : 0;
      return { sessionId: session.id, count, pct };
    }),
  }));
}

export function computeAthleteCoverageRows({ athletes, selectedTestingDates, selectedTests, index }) {
  const testCount = selectedTests.length;
  const dateCount = selectedTestingDates.length;
  const possible = testCount * dateCount;

  return athletes.map((athlete) => {
    const bySession = {};
    let raw = 0;

    for (const session of selectedTestingDates) {
      const completed = countTestsForAthleteSession(index, athlete.id, session.id);
      bySession[session.id] = completed;
      raw += completed;
    }

    const pct = possible ? Math.round((raw / possible) * 100) : 0;

    return {
      athlete,
      athleteName: athleteDisplayName(athlete),
      bySession,
      overallRaw: raw,
      overallPossible: possible,
      overallPct: pct,
      overallRatio: possible ? raw / possible : 0,
    };
  });
}

export function computeCoverageData({
  athletes,
  results,
  selectedTests,
  selectedTestingDates,
}) {
  const testIds = selectedTests.map((t) => t.id);
  const sessionIds = selectedTestingDates.map((s) => s.id);
  const index = buildCoverageIndex(results, testIds, sessionIds);

  return {
    index,
    dateSummaries: computeDateSummaries({
      athletes,
      selectedTestingDates,
      selectedTests,
      index,
    }),
    testDateMatrix: computeTestDateMatrix({
      athletes,
      selectedTestingDates,
      selectedTests,
      index,
    }),
    athleteRows: computeAthleteCoverageRows({
      athletes,
      selectedTestingDates,
      selectedTests,
      index,
    }),
  };
}
