import assert from 'node:assert/strict';
import {
  buildPresetDateRange,
  buildSevenDayRange,
  buildTodayRange,
  normalizeCustomRange,
  rangePresetLabel,
} from './dashboardDateRange.js';

const ref = new Date('2026-06-29T12:00:00');

const today = buildTodayRange(ref);
assert.equal(today.dateFrom, '2026-06-29');
assert.equal(today.dateTo, '2026-06-29');

const seven = buildSevenDayRange(ref);
assert.equal(seven.dateFrom, '2026-06-23');
assert.equal(seven.dateTo, '2026-06-29');

const fourWeeks = buildPresetDateRange('4W', ref);
assert.equal(fourWeeks.dateFrom, '2026-06-01');
assert.equal(fourWeeks.dateTo, '2026-06-29');

const swapped = normalizeCustomRange('2026-06-20', '2026-06-10');
assert.equal(swapped.dateFrom, '2026-06-10');
assert.equal(swapped.dateTo, '2026-06-20');

const fallback = normalizeCustomRange(null, null, { dateFrom: '2026-01-01', dateTo: '2026-01-31' });
assert.equal(fallback.dateFrom, '2026-01-01');
assert.equal(fallback.dateTo, '2026-01-31');

assert.equal(rangePresetLabel('today'), 'Today');
assert.equal(rangePresetLabel('7D'), '7 days');
assert.equal(rangePresetLabel('4W'), '4 weeks');
assert.equal(rangePresetLabel('season'), 'Season');
assert.equal(rangePresetLabel('custom'), 'Custom');

console.log('dashboardDateRange.test.js: all assertions passed');
