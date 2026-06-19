import { DEFAULT_PERCENTILE_BANDS } from './assessmentSettingsConstants';

function computePercentileRank(value, squadValues, direction) {
  if (value == null || Number.isNaN(value)) return null;
  if (!squadValues?.length) return null;

  const validValues = squadValues.filter((v) => v != null && !Number.isNaN(v));
  if (!validValues.length) return null;

  let beaten;
  if (direction === 'lower_is_better') {
    beaten = validValues.filter((v) => v > value).length;
  } else {
    beaten = validValues.filter((v) => v < value).length;
  }

  return Math.round((beaten / validValues.length) * 1000) / 10;
}

function median(values) {
  const sorted = values.filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function normalizeBands(percentileBands) {
  if (!percentileBands?.length) return DEFAULT_PERCENTILE_BANDS;
  return [...percentileBands].sort((a, b) => a.min - b.min);
}

function bandForPercentile(percentileRank, percentileBands) {
  const bands = normalizeBands(percentileBands);
  if (percentileRank == null) {
    return { tier: 0, tierName: 'Unclassified', tierColor: '--color-outline' };
  }
  const band = bands.find((b) => percentileRank >= b.min && percentileRank < b.max)
    ?? bands[bands.length - 1];
  return {
    tier: bands.indexOf(band) + 1,
    tierName: band.label,
    tierColor: band.color,
  };
}

export function classifyByPercentile({ value, squadValues, direction, percentileBands }) {
  const percentileRank = computePercentileRank(value, squadValues, direction);
  const { tier, tierName, tierColor } = bandForPercentile(percentileRank, percentileBands);
  return { percentileRank, tier, tierName, tierColor };
}

function classifyByAbsolute({ value, benchmarkTiers, direction }) {
  if (value == null || Number.isNaN(value)) {
    return { tier: 0, tierName: 'Unclassified', tierColor: '--color-outline' };
  }

  const tiers = [...(benchmarkTiers ?? [])].sort((a, b) => a.tier_order - b.tier_order);
  if (!tiers.length) {
    return { tier: 0, tierName: 'Unclassified', tierColor: '--color-outline' };
  }

  for (const tier of tiers) {
    const min = tier.threshold_min;
    const max = tier.threshold_max;

    if (direction === 'lower_is_better') {
      const belowMax = max == null || value < max;
      const aboveMin = min == null || value >= min;
      if (belowMax && aboveMin) {
        return { tier: tier.tier_order, tierName: tier.tier_name, tierColor: tier.tier_color };
      }
    } else {
      const aboveMin = min == null || value >= min;
      const belowMax = max == null || value < max;
      if (aboveMin && belowMax) {
        return { tier: tier.tier_order, tierName: tier.tier_name, tierColor: tier.tier_color };
      }
    }
  }

  return { tier: 0, tierName: 'Unclassified', tierColor: '--color-outline' };
}

export function resolveScore({
  value,
  scoringMethod,
  squadValues,
  orgValues,
  benchmarkTiers,
  direction = 'higher_is_better',
  percentileBands,
  gender,
}) {
  if (value == null || Number.isNaN(value)) {
    return {
      percentileRank: null,
      tier: 0,
      tierName: 'Unclassified',
      tierColor: '--color-outline',
      fallback: false,
      method: null,
    };
  }

  const isFemale = gender === 'female';
  let method = scoringMethod ?? 'team_percentile';
  if (isFemale) {
    method = 'team_percentile';
  }

  const teamRank = computePercentileRank(value, squadValues, direction);
  const orgRank = computePercentileRank(value, orgValues ?? squadValues, direction);

  if (method === 'team_percentile') {
    const classified = classifyByPercentile({ value, squadValues, direction, percentileBands });
    return { ...classified, fallback: false, method: 'team_percentile' };
  }

  if (method === 'org_percentile') {
    const classified = classifyByPercentile({
      value,
      squadValues: orgValues ?? squadValues,
      direction,
      percentileBands,
    });
    return { ...classified, fallback: false, method: 'org_percentile' };
  }

  const hasTiers = (benchmarkTiers ?? []).some(
    (t) => t.threshold_min != null || t.threshold_max != null,
  );

  if (method === 'absolute') {
    if (!hasTiers) {
      const classified = classifyByPercentile({ value, squadValues, direction, percentileBands });
      return { ...classified, fallback: true, method: 'team_percentile' };
    }
    const absolute = classifyByAbsolute({ value, benchmarkTiers, direction });
    return {
      ...absolute,
      percentileRank: teamRank,
      fallback: false,
      method: 'absolute',
    };
  }

  if (method === 'both') {
    if (!hasTiers) {
      const classified = classifyByPercentile({ value, squadValues, direction, percentileBands });
      return { ...classified, fallback: true, method: 'team_percentile' };
    }
    const absolute = classifyByAbsolute({ value, benchmarkTiers, direction });
    return {
      ...absolute,
      percentileRank: teamRank,
      fallback: false,
      method: 'both',
    };
  }

  const classified = classifyByPercentile({ value, squadValues, direction, percentileBands });
  return { ...classified, fallback: false, method: 'team_percentile' };
}

function improvementDelta(firstValue, lastValue, direction) {
  if (firstValue == null || lastValue == null) return null;
  const raw = lastValue - firstValue;
  if (direction === 'lower_is_better') return firstValue - lastValue;
  return raw;
}

function trendDirectionFromDelta(delta, firstValue) {
  if (delta == null) return 'stable';
  const threshold = Math.abs(firstValue ?? 0) * 0.005 || 0.01;
  if (delta > threshold) return 'improving';
  if (delta < -threshold) return 'declining';
  return 'stable';
}

function findResultValue(results, athleteId, testId, sessionId) {
  const row = (results ?? []).find(
    (r) => r.athlete_id === athleteId && r.test_id === testId && r.session_id === sessionId,
  );
  return row?.value != null ? Number(row.value) : null;
}

function teamStatsForTest(testId, testingDateId, allAthleteResults) {
  const values = (allAthleteResults ?? [])
    .filter(
      (r) =>
        r.test_id === testId &&
        r.session_id === testingDateId &&
        r.value != null &&
        !Number.isNaN(Number(r.value)),
    )
    .map((r) => ({ athleteId: r.athlete_id, value: Number(r.value) }));

  if (!values.length) return { mean: null, stddev: null, values };

  const nums = values.map((v) => v.value);
  const mean = nums.reduce((sum, v) => sum + v, 0) / nums.length;
  const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nums.length;
  const stddev = Math.sqrt(variance);
  return { mean, stddev, values };
}

function computeZScore(value, mean, stddev, direction) {
  if (value == null || mean == null || stddev == null || stddev === 0) return null;
  let z = (value - mean) / stddev;
  if (direction === 'lower_is_better') z = -z;
  return z;
}

function rankPercentileFromScores(scoreByAthleteId) {
  const entries = [...scoreByAthleteId.entries()].filter(([, score]) => score != null);
  const n = entries.length;
  if (!n) return new Map();

  entries.sort((a, b) => b[1] - a[1]);
  const map = new Map();
  entries.forEach(([id], index) => {
    const rank = index + 1;
    map.set(id, ((rank - 0.5) / n) * 100);
  });
  return map;
}

function zScoresForTestAtSession(testId, testingDateId, allAthleteResults, direction) {
  const { mean, stddev, values } = teamStatsForTest(testId, testingDateId, allAthleteResults);
  const scoreByAthlete = new Map();
  for (const { athleteId, value } of values) {
    const z = computeZScore(value, mean, stddev, direction);
    if (z != null) scoreByAthlete.set(athleteId, z);
  }
  return scoreByAthlete;
}

export function computeTestPercentile({
  athleteId,
  testId,
  testingDateId,
  allAthleteResults,
  direction = 'higher_is_better',
  percentileBands,
}) {
  const scoreByAthlete = zScoresForTestAtSession(
    testId,
    testingDateId,
    allAthleteResults,
    direction,
  );
  if (!scoreByAthlete.has(athleteId)) {
    return { z: null, percentile: null, tier: null, tierColor: null };
  }

  const percentileMap = rankPercentileFromScores(scoreByAthlete);
  const percentile = percentileMap.get(athleteId) ?? null;
  const band = bandForPercentile(percentile, percentileBands);

  return {
    z: scoreByAthlete.get(athleteId),
    percentile,
    tier: band.tierName === 'Unclassified' ? null : band.tierName,
    tierColor: band.tierColor,
  };
}

export function computeCompositePercentile({
  athleteId,
  testIds,
  testingDateId,
  allAthleteResults,
  testDirections,
  percentileBands,
}) {
  const athleteIds = new Set();
  for (const testId of testIds ?? []) {
    const { values } = teamStatsForTest(testId, testingDateId, allAthleteResults);
    values.forEach((v) => athleteIds.add(v.athleteId));
  }

  const compositeZByAthlete = new Map();
  for (const aid of athleteIds) {
    const zs = [];
    for (const testId of testIds ?? []) {
      const value = findResultValue(allAthleteResults, aid, testId, testingDateId);
      if (value == null) continue;
      const { mean, stddev } = teamStatsForTest(testId, testingDateId, allAthleteResults);
      const direction = testDirections?.[testId] ?? 'higher_is_better';
      const z = computeZScore(value, mean, stddev, direction);
      if (z != null) zs.push(z);
    }
    if (zs.length) {
      compositeZByAthlete.set(aid, zs.reduce((sum, z) => sum + z, 0) / zs.length);
    }
  }

  if (!compositeZByAthlete.has(athleteId)) {
    return { compositeZ: null, percentile: null, tier: null, tierColor: null };
  }

  const percentileMap = rankPercentileFromScores(compositeZByAthlete);
  const percentile = percentileMap.get(athleteId) ?? null;
  const band = bandForPercentile(percentile, percentileBands);

  return {
    compositeZ: compositeZByAthlete.get(athleteId),
    percentile,
    tier: band.tierName === 'Unclassified' ? null : band.tierName,
    tierColor: band.tierColor,
  };
}

export function getAthleteSessionsForTest(athleteId, testId, allResults, allSessions) {
  const sessionIds = new Set(
    (allResults ?? [])
      .filter(
        (r) =>
          r.athlete_id === athleteId &&
          r.test_id === testId &&
          r.value != null &&
          !Number.isNaN(Number(r.value)),
      )
      .map((r) => r.session_id),
  );
  return [...(allSessions ?? [])]
    .filter((s) => sessionIds.has(s.id))
    .sort((a, b) => new Date(a.assessed_on) - new Date(b.assessed_on));
}

export function computeCompositeClassification({
  athleteId,
  testIds,
  testingDates,
  allAthleteResults,
  testDirections,
  percentileBands,
}) {
  const sortedDates = [...(testingDates ?? [])].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );

  const progression = sortedDates.map((session) => {
    const result = computeCompositePercentile({
      athleteId,
      testIds,
      testingDateId: session.id,
      allAthleteResults,
      testDirections,
      percentileBands,
    });
    return {
      sessionId: session.id,
      date: session.assessed_on,
      compositeZ: result.compositeZ,
      percentile: result.percentile,
      tierName: result.tier,
      tierColor: result.tierColor,
    };
  });

  const first = progression.find((p) => p.percentile != null);
  const last = [...progression].reverse().find((p) => p.percentile != null);
  const overallDelta =
    first && last && first !== last ? last.percentile - first.percentile : null;

  return {
    progression,
    overallDelta,
    trendDirection: trendDirectionFromDelta(overallDelta, first?.percentile ?? 0),
  };
}

export function computeAthleteProgression({
  athleteId,
  testId,
  testingDates,
  results,
  benchmarkTiers,
  percentileBands,
  direction = 'higher_is_better',
  squadValuesBySession,
  orgValuesBySession,
  scoringMethod,
  gender,
}) {
  const sortedDates = [...(testingDates ?? [])].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );

  const dataPoints = [];
  let previousValue = null;
  let previousTier = null;
  const tierCrossings = [];

  for (const session of sortedDates) {
    const value = findResultValue(results, athleteId, testId, session.id);
    const squadValues = squadValuesBySession?.[session.id]?.[testId] ?? [];
    const orgValues = orgValuesBySession?.[session.id]?.[testId] ?? squadValues;

    const score = resolveScore({
      value,
      scoringMethod,
      squadValues,
      orgValues,
      benchmarkTiers,
      direction,
      percentileBands,
      gender,
    });

    const delta =
      value != null && previousValue != null
        ? improvementDelta(previousValue, value, direction)
        : null;

    if (value != null) {
      dataPoints.push({
        sessionId: session.id,
        date: session.assessed_on,
        value,
        tier: score.tier,
        tierName: score.tierName,
        tierColor: score.tierColor,
        percentileRank: score.percentileRank,
        delta,
        fallback: score.fallback,
      });

      if (previousTier != null && score.tier !== previousTier && score.tier > 0) {
        tierCrossings.push({
          fromTier: previousTier,
          toTier: score.tier,
          fromTierName: dataPoints[dataPoints.length - 2]?.tierName,
          toTierName: score.tierName,
          sessionId: session.id,
          date: session.assessed_on,
        });
      }

      previousTier = score.tier;
      previousValue = value;
    }
  }

  const firstPoint = dataPoints[0];
  const lastPoint = dataPoints[dataPoints.length - 1];
  const overallDelta =
    firstPoint && lastPoint
      ? improvementDelta(firstPoint.value, lastPoint.value, direction)
      : null;

  return {
    dataPoints,
    tierCrossings,
    overallDelta,
    trendDirection: trendDirectionFromDelta(overallDelta, firstPoint?.value),
    fallback: dataPoints.some((p) => p.fallback),
  };
}

export function computeSquadProgression({
  testId,
  testingDates,
  results,
  athletes,
  benchmarkTiers,
  percentileBands,
  direction = 'higher_is_better',
  squadValuesBySession,
  orgValuesBySession,
  scoringMethod,
}) {
  const sortedDates = [...(testingDates ?? [])].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );
  if (sortedDates.length < 2) return [];

  const firstSession = sortedDates[0];
  const lastSession = sortedDates[sortedDates.length - 1];

  return (athletes ?? [])
    .map((athlete) => {
      const firstValue = findResultValue(results, athlete.id, testId, firstSession.id);
      const lastValue = findResultValue(results, athlete.id, testId, lastSession.id);
      if (firstValue == null || lastValue == null) return null;

      const classifyAt = (sessionId, value) =>
        resolveScore({
          value,
          scoringMethod,
          squadValues: squadValuesBySession?.[sessionId]?.[testId] ?? [],
          orgValues: orgValuesBySession?.[sessionId]?.[testId] ?? [],
          benchmarkTiers,
          direction,
          percentileBands,
          gender: athlete.gender,
        });

      const firstScore = classifyAt(firstSession.id, firstValue);
      const lastScore = classifyAt(lastSession.id, lastValue);
      const delta = improvementDelta(firstValue, lastValue, direction);
      const improvementMagnitude = delta != null ? Math.abs(delta) : 0;

      return {
        athleteId: athlete.id,
        athleteName: athlete.full_name ?? `${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim(),
        athlete,
        firstValue,
        lastValue,
        firstSessionId: firstSession.id,
        lastSessionId: lastSession.id,
        delta,
        firstTier: firstScore.tier,
        lastTier: lastScore.tier,
        firstTierName: firstScore.tierName,
        lastTierName: lastScore.tierName,
        tierChanged: firstScore.tier !== lastScore.tier,
        improvementMagnitude,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.improvementMagnitude - a.improvementMagnitude);
}

export function computeSquadMultiplesProgression({
  testId,
  allSessions,
  allResults,
  athletes,
  direction = 'higher_is_better',
}) {
  return (athletes ?? [])
    .map((athlete) => {
      const sessions = getAthleteSessionsForTest(athlete.id, testId, allResults, allSessions);
      if (sessions.length < 2) return null;

      const firstSession = sessions[sessions.length - 2];
      const lastSession = sessions[sessions.length - 1];
      const firstValue = findResultValue(allResults, athlete.id, testId, firstSession.id);
      const lastValue = findResultValue(allResults, athlete.id, testId, lastSession.id);
      if (firstValue == null || lastValue == null) return null;

      const delta = improvementDelta(firstValue, lastValue, direction);
      const improvementMagnitude = delta != null ? Math.abs(delta) : 0;

      return {
        athleteId: athlete.id,
        athleteName: athlete.full_name ?? `${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim(),
        athlete,
        firstValue,
        lastValue,
        firstSessionId: firstSession.id,
        lastSessionId: lastSession.id,
        delta,
        improvementMagnitude,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.improvementMagnitude - a.improvementMagnitude);
}

export function computeSquadTableRows({
  testId,
  filterTestingDates,
  allSessions,
  allResults,
  athletes,
  compositeTestIds,
  testDirections,
  percentileBands,
  benchmarkTiers,
  direction = 'higher_is_better',
  squadValuesBySession,
  orgValuesBySession,
  scoringMethod,
}) {
  const sortedFilterDates = [...(filterTestingDates ?? [])].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );
  const filterFirst = sortedFilterDates[0];
  const filterLast = sortedFilterDates[sortedFilterDates.length - 1];

  const athletesWithData = (athletes ?? []).filter((athlete) =>
    (allResults ?? []).some(
      (r) => r.athlete_id === athlete.id && r.test_id === testId && r.value != null,
    ),
  );

  return athletesWithData.map((athlete) => {
    const availableSessions = getAthleteSessionsForTest(athlete.id, testId, allResults, allSessions);
    const hasTwoDates = availableSessions.length >= 2;

    const latestTwo = hasTwoDates
      ? [availableSessions[availableSessions.length - 2], availableSessions[availableSessions.length - 1]]
      : [];

    const firstAvailable = latestTwo[0];
    const lastAvailable = latestTwo[1];

    const firstAvailableValue = firstAvailable
      ? findResultValue(allResults, athlete.id, testId, firstAvailable.id)
      : null;
    const lastAvailableValue = lastAvailable
      ? findResultValue(allResults, athlete.id, testId, lastAvailable.id)
      : null;

    const improvementDeltaValue =
      hasTwoDates && firstAvailableValue != null && lastAvailableValue != null
        ? improvementDelta(firstAvailableValue, lastAvailableValue, direction)
        : null;

    let percentileDelta = null;
    if (hasTwoDates && firstAvailable && lastAvailable) {
      const firstPct = computeTestPercentile({
        athleteId: athlete.id,
        testId,
        testingDateId: firstAvailable.id,
        allAthleteResults: allResults,
        direction,
        percentileBands,
      });
      const lastPct = computeTestPercentile({
        athleteId: athlete.id,
        testId,
        testingDateId: lastAvailable.id,
        allAthleteResults: allResults,
        direction,
        percentileBands,
      });
      if (firstPct.percentile != null && lastPct.percentile != null) {
        percentileDelta = lastPct.percentile - firstPct.percentile;
      }
    }

    const filterFirstValue =
      filterFirst && findResultValue(allResults, athlete.id, testId, filterFirst.id);
    const filterLastValue =
      filterLast && findResultValue(allResults, athlete.id, testId, filterLast.id);

    const classifyAt = (sessionId, value) =>
      resolveScore({
        value,
        scoringMethod,
        squadValues: squadValuesBySession?.[sessionId]?.[testId] ?? [],
        orgValues: orgValuesBySession?.[sessionId]?.[testId] ?? [],
        benchmarkTiers,
        direction,
        percentileBands,
        gender: athlete.gender,
      });

    const firstScore =
      filterFirst && filterFirstValue != null
        ? classifyAt(filterFirst.id, filterFirstValue)
        : null;
    const lastScore =
      filterLast && filterLastValue != null ? classifyAt(filterLast.id, filterLastValue) : null;

    let compositePercentile = null;
    let compositeTier = null;
    let compositeTierColor = null;
    if (compositeTestIds?.length) {
      const sessionsDescending = [...allSessions].reverse();
      for (const session of sessionsDescending) {
        const composite = computeCompositePercentile({
          athleteId: athlete.id,
          testIds: compositeTestIds,
          testingDateId: session.id,
          allAthleteResults: allResults,
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

    return {
      athleteId: athlete.id,
      athleteName: athlete.full_name ?? `${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim(),
      athlete,
      firstValue: filterFirstValue ?? null,
      lastValue: filterLastValue ?? null,
      delta:
        filterFirstValue != null && filterLastValue != null
          ? improvementDelta(filterFirstValue, filterLastValue, direction)
          : null,
      improvementDelta: improvementDeltaValue,
      percentileDelta,
      compositePercentile,
      compositeTier,
      compositeTierColor,
      hasTwoDates,
      firstTierName: firstScore?.tierName,
      lastTierName: lastScore?.tierName,
      tierChanged: firstScore && lastScore ? firstScore.tier !== lastScore.tier : false,
      improvementMagnitude: improvementDeltaValue != null ? Math.abs(improvementDeltaValue) : 0,
    };
  });
}

export function computeOverallClassification({
  athleteId,
  testIds,
  testingDates,
  results,
  testsById,
  squadValuesBySession,
  orgValuesBySession,
  scoringMethod,
  percentileBands,
  benchmarkTiersByTest,
  gender,
}) {
  const sortedDates = [...(testingDates ?? [])].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );

  const progression = sortedDates.map((session) => {
    const ranks = (testIds ?? [])
      .map((testId) => {
        const value = findResultValue(results, athleteId, testId, session.id);
        if (value == null) return null;
        const test = testsById?.[testId];
        const squadValues = squadValuesBySession?.[session.id]?.[testId] ?? [];
        const orgValues = orgValuesBySession?.[session.id]?.[testId] ?? squadValues;
        const score = resolveScore({
          value,
          scoringMethod,
          squadValues,
          orgValues,
          benchmarkTiers: benchmarkTiersByTest?.[testId] ?? [],
          direction: test?.direction ?? 'higher_is_better',
          percentileBands,
          gender,
        });
        return score.percentileRank;
      })
      .filter((r) => r != null);

    const medianRank = median(ranks);
    const band = bandForPercentile(medianRank, percentileBands);

    return {
      sessionId: session.id,
      date: session.assessed_on,
      medianPercentile: medianRank,
      tierName: band.tierName,
      tierColor: band.tierColor,
    };
  });

  const first = progression.find((p) => p.medianPercentile != null);
  const last = [...progression].reverse().find((p) => p.medianPercentile != null);
  const overallDelta =
    first && last && first !== last ? last.medianPercentile - first.medianPercentile : null;

  return {
    progression,
    overallDelta,
    trendDirection: trendDirectionFromDelta(overallDelta, first?.medianPercentile ?? 0),
  };
}

export function formatTestingDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatShortTestingDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
