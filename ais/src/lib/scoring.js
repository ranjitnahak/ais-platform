/**
 * Compute a percentile rank (0–100) for `value` within `squadValues`.
 * direction: 'higher_is_better' → higher value is better (e.g. jump distance)
 * direction: 'lower_is_better' → lower value is better  (e.g. sprint time)
 *
 * Returns the percentage of squad values that the athlete beats or equals,
 * rounded to one decimal place.
 */
function computePercentileRank(value, squadValues, direction) {
  if (!squadValues || squadValues.length === 0) return null;

  const validValues = squadValues.filter((v) => v != null && !isNaN(v));
  if (validValues.length === 0) return null;

  let beaten;
  if (direction === 'lower_is_better') {
    // Lower is better — athlete beats everyone who scored higher
    beaten = validValues.filter((v) => v > value).length;
  } else {
    // Higher is better (default) — athlete beats everyone who scored lower
    beaten = validValues.filter((v) => v < value).length;
  }

  return Math.round((beaten / validValues.length) * 1000) / 10;
}

/**
 * Map a percentile rank to a human-readable classification tier.
 * Thresholds mirror the 4-tier system used for absolute benchmarks.
 */
function classifyByPercentile(percentileRank) {
  if (percentileRank === null) return 'Unclassified';
  if (percentileRank >= 75) return 'Excellent';
  if (percentileRank >= 50) return 'Above Average';
  if (percentileRank >= 25) return 'Average';
  return 'Below Average';
}

/**
 * Classify a score using absolute benchmark ranges.
 *
 * Each benchmark row is expected to have:
 *   { classification, min_value, max_value }
 * where min_value and/or max_value can be null (open-ended range).
 *
 * direction: 'higher_is_better' → higher is better; ranges are read as [min_value, max_value)
 * direction: 'lower_is_better' → lower is better; min_value/max_value are still the
 *                                stored numeric bounds but the best tier has no lower bound.
 *
 * Returns the matching classification string, or 'Unclassified' if no range matches.
 */
function classifyByAbsolute(value, benchmarks, direction) {
  for (const row of benchmarks) {
    const { min_value, max_value, tier } = row;

    if (direction === 'lower_is_better') {
      // Lower is better — "excellent" has no lower bound (just an upper cap)
      const belowMax = max_value == null || value < max_value;
      const aboveMin = min_value == null || value >= min_value;
      if (belowMax && aboveMin) return tier;
    } else {
      // Higher is better (default)
      const aboveMin = min_value == null || value >= min_value;
      const belowMax = max_value == null || value < max_value;
      if (aboveMin && belowMax) return tier;
    }
  }
  return 'Unclassified';
}

/**
 * Classify a single athlete score.
 *
 * @param {object} params
 * @param {number}   params.value        - The athlete's raw score.
 * @param {string}   params.gender       - 'male' | 'female' (informational; caller
 *                                         should already filter benchmarks by gender).
 * @param {string}   params.direction    - 'higher_is_better' | 'lower_is_better'.
 * @param {object[]} params.benchmarks   - Benchmark rows for this test + gender from
 *                                         the Supabase `benchmarks` table. May be empty.
 * @param {number[]} params.squadValues  - All scores for this test from the current
 *                                         squad (used for percentile fallback).
 *
 * @returns {{ classification: string, percentileRank: number|null, method: 'absolute'|'percentile' }}
 */
export function classifyScore({ value, gender, direction = 'higher_is_better', benchmarks = [], squadValues = [] }) {
  if (value == null || isNaN(value)) {
    return { classification: 'Unclassified', percentileRank: null, method: null };
  }

  const hasBenchmarks = benchmarks.length > 0;

  if (hasBenchmarks) {
    const benchmarkType = benchmarks[0].benchmark_type;

    if (benchmarkType === 'absolute') {
      const classification = classifyByAbsolute(value, benchmarks, direction);
      // Still compute percentile rank for display purposes even when not used for classification
      const percentileRank = computePercentileRank(value, squadValues, direction);
      return { classification, percentileRank, method: 'absolute' };
    }

    if (benchmarkType === 'percentile') {
      const percentileRank = computePercentileRank(value, squadValues, direction);
      const classification = classifyByPercentile(percentileRank);
      return { classification, percentileRank, method: 'percentile' };
    }
  }

  // No benchmark rows — automatic percentile fallback
  const percentileRank = computePercentileRank(value, squadValues, direction);
  const classification = classifyByPercentile(percentileRank);
  return { classification, percentileRank, method: 'percentile' };
}
