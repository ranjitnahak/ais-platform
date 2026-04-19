/** Monday ISO date string YYYY-MM-DD */
export function toISODate(d) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export function startOfWeekMonday(d) {
  const iso = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  const x = new Date(iso + 'T12:00:00');
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(12, 0, 0, 0);
  return x;
}

/** Inclusive list of week-start Mondays between planStart and planEnd */
export function weekStartsBetween(planStart, planEnd) {
  const start = startOfWeekMonday(planStart);
  const end = new Date(planEnd + 'T23:59:59');
  const weeks = [];
  const cur = new Date(start);
  let i = 0;
  while (cur <= end) {
    weeks.push({ index: i, monday: toISODate(cur), date: new Date(cur) });
    cur.setDate(cur.getDate() + 7);
    i++;
  }
  return weeks;
}

export function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function formatRange(startIso, endIso) {
  const a = new Date(startIso + 'T12:00:00');
  const b = new Date(endIso + 'T12:00:00');
  const o = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${a.toLocaleDateString('en-GB', o)} – ${b.toLocaleDateString('en-GB', o)}`;
}

export function rowMetricKey(row) {
  if (row.row_key) return row.row_key;
  const l = (row.label || '').toLowerCase();
  if (l.includes('acwr')) return 'acwr';
  if (l.includes('volume')) return 'volume';
  if (l.includes('intensity')) return 'intensity';
  if (l.includes('peaking')) return 'peaking_index';
  if (l.includes('week focus')) return 'week_focus';
  if (l.includes('phase')) return 'phase';
  return null;
}

/** @param {number[]} weeklyLoads index-aligned with weeks */
export function computeAcwrSeries(weeklyLoads) {
  const n = weeklyLoads.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const acute = weeklyLoads[i];
    let chronicSum = 0;
    let chronicCount = 0;
    for (let j = Math.max(0, i - 3); j <= i; j++) {
      if (weeklyLoads[j] != null && !Number.isNaN(weeklyLoads[j])) {
        chronicSum += weeklyLoads[j];
        chronicCount++;
      }
    }
    const chronic = chronicCount ? chronicSum / chronicCount : null;
    const ratio = acute != null && chronic != null && chronic > 0 ? acute / chronic : null;
    out.push(ratio);
  }
  return out;
}

export function acwrStyle(ratio) {
  if (ratio == null || Number.isNaN(ratio)) return { bg: '#374151', text: '#e5e7eb' };
  if (ratio < 0.8) return { bg: '#14532d', text: '#bbf7d0' };
  if (ratio <= 1.3) return { bg: '#166534', text: '#dcfce7' };
  if (ratio <= 1.5) return { bg: '#854d0e', text: '#fef9c3' };
  return { bg: '#7f1d1d', text: '#fecaca' };
}

export function numberCellStyle(n) {
  if (n == null || n === '') return { bg: '#2a2a2c', text: '#9ca3af' };
  const v = Number(n);
  if (v <= 3) return { bg: '#dbeafe', text: '#1e40af' };
  if (v <= 5) return { bg: '#fef9c3', text: '#713f12' };
  if (v <= 7) return { bg: '#fbbf24', text: '#78350f' };
  return { bg: '#f97316', text: '#ffffff' };
}

export function peakingStyle(n) {
  if (n == null || n === '') return { bg: '#374151', text: '#e5e7eb' };
  const v = Math.round(Number(n));
  if (v >= 7) return { bg: '#fca5a5', text: '#7f1d1d' };
  if (v === 6) return { bg: '#fdba74', text: '#7c2d12' };
  if (v === 5) return { bg: '#fde68a', text: '#78350f' };
  if (v === 4) return { bg: '#d9f99d', text: '#365314' };
  if (v === 3) return { bg: '#bbf7d0', text: '#14532d' };
  return { bg: '#6ee7b7', text: '#064e3b' };
}

export const ROW_GROUPS = [
  'Planning',
  'Events & fixtures',
  'Physical fitness',
  'Technical / tactical',
  'Sports science',
];

export const ZOOM_PX = { '4Y': 28, '1Y': 52, '6M': 64, '1M': 88, '1W': 120 };
