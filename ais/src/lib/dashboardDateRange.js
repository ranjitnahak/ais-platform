import { buildFourWeekRange } from './attendanceEngine.js';
import { addDays, toISODate } from './periodisationUtils.js';

export { buildFourWeekRange };

export const DASHBOARD_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7D', label: '7 days' },
  { value: '4W', label: '4 weeks' },
  { value: 'season', label: 'Season' },
  { value: 'custom', label: 'Custom' },
];

export const WELLNESS_DASHBOARD_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'calendar', label: 'Calendar' },
  { value: '7D', label: '7 days' },
  { value: '4W', label: '4 weeks' },
  { value: 'custom', label: 'Custom' },
];

export function todayIso(referenceDate = new Date()) {
  return toISODate(referenceDate);
}

export function buildTodayRange(referenceDate = new Date()) {
  const dateTo = todayIso(referenceDate);
  return { dateFrom: dateTo, dateTo };
}

export function buildCalendarRange(date, referenceDate = new Date()) {
  const day = date || todayIso(referenceDate);
  return { dateFrom: day, dateTo: day };
}

export function buildSevenDayRange(referenceDate = new Date()) {
  const dateTo = todayIso(referenceDate);
  return { dateFrom: addDays(dateTo, -6), dateTo };
}

export function normalizeCustomRange(dateFrom, dateTo, fallbackRange = buildFourWeekRange()) {
  if (!dateFrom || !dateTo) return fallbackRange;
  if (dateFrom <= dateTo) return { dateFrom, dateTo };
  return { dateFrom: dateTo, dateTo: dateFrom };
}

export function buildPresetDateRange(range, referenceDate = new Date()) {
  switch (range) {
    case 'today':
      return buildTodayRange(referenceDate);
    case 'calendar':
      return buildCalendarRange(null, referenceDate);
    case '7D':
      return buildSevenDayRange(referenceDate);
    case '4W':
      return buildFourWeekRange(referenceDate);
    default:
      return buildFourWeekRange(referenceDate);
  }
}

export async function resolveSeasonRange(orgId, teamId) {
  const { supabase } = await import('./supabase.js');
  const today = todayIso();

  const { data: plan, error: planError } = await supabase
    .from('periodisation_plans')
    .select('start_date, end_date')
    .eq('org_id', orgId)
    .eq('team_id', teamId)
    .is('athlete_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) throw planError;

  if (plan?.start_date && plan?.end_date) {
    return {
      dateFrom: plan.start_date,
      dateTo: plan.end_date > today ? today : plan.end_date,
    };
  }

  const { data: earliestSession, error: sessionError } = await supabase
    .from('sessions')
    .select('session_date')
    .eq('org_id', orgId)
    .eq('team_id', teamId)
    .order('session_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sessionError) throw sessionError;

  return {
    dateFrom: earliestSession?.session_date ?? today,
    dateTo: today,
  };
}

export async function resolveDashboardDateRange(
  filters,
  { orgId, teamId },
  referenceDate = new Date(),
) {
  const { range, dateFrom, dateTo } = filters ?? {};

  if (range === 'season') {
    if (!orgId || !teamId) return buildFourWeekRange(referenceDate);
    return resolveSeasonRange(orgId, teamId);
  }

  if (range === 'calendar') {
    return buildCalendarRange(dateFrom || dateTo, referenceDate);
  }

  if (range === 'custom') {
    return normalizeCustomRange(dateFrom, dateTo, buildFourWeekRange(referenceDate));
  }

  return buildPresetDateRange(range, referenceDate);
}

export function rangePresetLabel(range) {
  const option =
    DASHBOARD_RANGE_OPTIONS.find((item) => item.value === range) ??
    WELLNESS_DASHBOARD_RANGE_OPTIONS.find((item) => item.value === range);
  return option?.label ?? '4 weeks';
}
