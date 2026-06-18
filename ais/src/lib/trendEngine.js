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
