/** Pure load-monitoring calculations — no React, no Supabase. */

export function calculateEWMA(dailyLoads, N) {
  if (!dailyLoads?.length) return [];
  const lambda = 2 / (N + 1);
  const result = [];
  let ewma = dailyLoads[0] ?? 0;
  for (const load of dailyLoads) {
    ewma = load * lambda + ewma * (1 - lambda);
    result.push(Math.round(ewma));
  }
  return result;
}

export function calculateRollingAverage(dailyLoads, windowDays) {
  if (!dailyLoads?.length || !windowDays) return [];
  return dailyLoads.map((_, i) => {
    const window = dailyLoads.slice(Math.max(0, i - windowDays + 1), i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / windowDays;
    return Math.round(avg);
  });
}

export function calculateACWR(acute, chronic) {
  if (acute == null || chronic == null || chronic <= 0) return null;
  return parseFloat((acute / chronic).toFixed(2));
}

export function calculateMonotony(weekDailyLoads) {
  if (!weekDailyLoads?.length || weekDailyLoads.length < 7) return null;
  const avg = weekDailyLoads.reduce((a, b) => a + b, 0) / 7;
  const variance = weekDailyLoads.reduce((sum, v) => sum + (v - avg) ** 2, 0) / 7;
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return parseFloat((avg / sd).toFixed(2));
}

export function calculateStrain(weeklyTotalLoad, monotony) {
  if (weeklyTotalLoad == null || monotony == null) return null;
  return Math.round(weeklyTotalLoad * monotony);
}

export function resolveSessionLoad(log) {
  if (!log) return 0;
  if (log.session_load != null && !Number.isNaN(Number(log.session_load))) {
    return Number(log.session_load);
  }
  const rpe = Number(log.actual_rpe);
  const duration = Number(log.actual_duration_min);
  if (Number.isNaN(rpe) || Number.isNaN(duration)) return 0;
  return rpe * duration;
}

export function getAcwrZone(acwr) {
  if (acwr == null || Number.isNaN(acwr)) return null;
  if (acwr < 0.8 || acwr > 1.5) return 'danger';
  if (acwr > 1.3) return 'caution';
  return 'safe';
}

export function getLoadSignal(acwr) {
  if (acwr == null || Number.isNaN(acwr)) return null;
  if (acwr > 1.5) return 'spike';
  if (acwr >= 1.3) return 'monitor';
  if (acwr >= 0.8) return 'optimal';
  return 'low';
}

export function getMonotonyZone(monotony) {
  if (monotony == null || Number.isNaN(monotony)) return null;
  if (monotony > 1.5) return 'danger';
  if (monotony >= 1.3) return 'caution';
  return 'safe';
}

export function bucketRpe(rpe) {
  const n = Number(rpe);
  if (Number.isNaN(n)) return null;
  if (n <= 3) return '1-3';
  if (n <= 5) return '4-5';
  if (n <= 7) return '6-7';
  if (n <= 9) return '8-9';
  return '10';
}

export const EWMA_LAMBDA_ACUTE = 2 / (7 + 1);
export const EWMA_LAMBDA_CHRONIC = 2 / (28 + 1);
