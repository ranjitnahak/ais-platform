/** Single source of truth for tier and improvement colours (Chart.js canvas + PDF). */

export const TIER_COLORS = {
  excellent: '#22c55e',
  aboveAverage: '#3b82f6',
  average: '#f97316',
  belowAverage: '#ef4444',
};

export const IMPROVEMENT_COLORS = {
  improved: TIER_COLORS.excellent,
  declined: TIER_COLORS.belowAverage,
};

const TIER_VAR_MAP = {
  excellent: TIER_COLORS.excellent,
  tertiarycontainer: TIER_COLORS.excellent,
  aboveavg: TIER_COLORS.aboveAverage,
  aboveaverage: TIER_COLORS.aboveAverage,
  secondarycontainer: TIER_COLORS.aboveAverage,
  avg: TIER_COLORS.average,
  average: TIER_COLORS.average,
  primarycontainer: TIER_COLORS.average,
  belowavg: TIER_COLORS.belowAverage,
  errorcontainer: TIER_COLORS.belowAverage,
};

const TIER_NAME_MAP = {
  excellent: TIER_COLORS.excellent,
  'above average': TIER_COLORS.aboveAverage,
  average: TIER_COLORS.average,
  'below average': TIER_COLORS.belowAverage,
};

export function resolveTierHex(tierColorVar) {
  if (!tierColorVar) return TIER_COLORS.average;
  const key = String(tierColorVar)
    .replace('--color-', '')
    .replace(/-/g, '')
    .toLowerCase();
  return TIER_VAR_MAP[key] ?? TIER_COLORS.average;
}

export function resolveTierHexFromName(tierName) {
  if (!tierName) return TIER_COLORS.average;
  const key = String(tierName).trim().toLowerCase();
  return TIER_NAME_MAP[key] ?? TIER_COLORS.average;
}

export function tierHexWithOpacity(hex, opacity = 0.18) {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
