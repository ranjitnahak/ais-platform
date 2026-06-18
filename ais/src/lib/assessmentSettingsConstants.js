export const TEST_DEFINITION_SELECT =
  'id, org_id, team_id, name, short_name, category, unit, direction, is_active, sort_order';

export const BENCHMARK_TIER_SELECT =
  'id, org_id, team_id, test_id, scoring_method, tier_order, tier_name, tier_color, threshold_min, threshold_max, percentile_min, percentile_max';

export const SCORING_METHODS = [
  { value: 'team_percentile', label: 'Team percentile' },
  { value: 'org_percentile', label: 'Org percentile' },
  { value: 'absolute', label: 'Absolute' },
  { value: 'both', label: 'Both' },
];

export const DEFAULT_SCORING_METHOD = 'team_percentile';

export const DEFAULT_TIERS = [
  { tier_order: 1, tier_name: 'Below Average', tier_color: '--color-below-avg' },
  { tier_order: 2, tier_name: 'Average', tier_color: '--color-avg' },
  { tier_order: 3, tier_name: 'Above Average', tier_color: '--color-above-avg' },
  { tier_order: 4, tier_name: 'Excellent', tier_color: '--color-excellent' },
];

export const DEFAULT_PERCENTILE_BANDS = [
  { min: 0, max: 20, label: 'Below Average', color: '--color-below-avg' },
  { min: 20, max: 60, label: 'Average', color: '--color-avg' },
  { min: 60, max: 80, label: 'Above Average', color: '--color-above-avg' },
  { min: 80, max: 100, label: 'Excellent', color: '--color-excellent' },
];

export function scoringMethodNeedsTiers(method) {
  return method === 'absolute' || method === 'both';
}

export function validatePercentileBands(bands) {
  if (!Array.isArray(bands) || bands.length === 0) {
    return 'At least one band is required.';
  }
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  if (sorted[0].min !== 0) return 'First band must start at 0.';
  if (sorted[sorted.length - 1].max !== 100) return 'Last band must end at 100.';
  for (let i = 0; i < sorted.length; i += 1) {
    const band = sorted[i];
    if (band.min >= band.max) return `${band.label || 'Band'}: min must be less than max.`;
    if (i > 0 && sorted[i - 1].max !== band.min) {
      return 'Bands must be contiguous with no gaps.';
    }
  }
  return null;
}
