// Yo-Yo IR1 — cumulative shuttle count lookup table
// Source: official Yo-Yo Intermittent Recovery Test Level 1 protocol (Bangsbo et al.)
// Key: 'level.shuttle' as recorded on the test sheet. Value: cumulative shuttle
// count from test start. 1 shuttle = 40m (20m out + 20m back).
// Verified reference points: 16.2 = shuttle 29 = 1160m, 17.2 = shuttle 37 = 1480m

export const YOYO_IR1_SHUTTLE_TABLE = {
  '5.1': 1,
  '9.1': 2,
  '11.1': 3,
  '11.2': 4,
  '12.1': 5,
  '12.2': 6,
  '12.3': 7,
  '13.1': 8,
  '13.2': 9,
  '13.3': 10,
  '13.4': 11,
  '14.1': 12,
  '14.2': 13,
  '14.3': 14,
  '14.4': 15,
  '14.5': 16,
  '14.6': 17,
  '14.7': 18,
  '14.8': 19,
  '15.1': 20,
  '15.2': 21,
  '15.3': 22,
  '15.4': 23,
  '15.5': 24,
  '15.6': 25,
  '15.7': 26,
  '15.8': 27,
  '16.1': 28,
  '16.2': 29,
  '16.3': 30,
  '16.4': 31,
  '16.5': 32,
  '16.6': 33,
  '16.7': 34,
  '16.8': 35,
  '17.1': 36,
  '17.2': 37,
  '17.3': 38,
  '17.4': 39,
  '17.5': 40,
  '17.6': 41,
  '17.7': 42,
  '17.8': 43,
  '18.1': 44,
  '18.2': 45,
  '18.3': 46,
  '18.4': 47,
  '18.5': 48,
  '18.6': 49,
  '18.7': 50,
  '18.8': 51,
  '19.1': 52,
  '19.2': 53,
  '19.3': 54,
  '19.4': 55,
  '19.5': 56,
  '19.6': 57,
  '19.7': 58,
  '19.8': 59,
  '20.1': 60,
  '20.2': 61,
  '20.3': 62,
  '20.4': 63,
  '20.5': 64,
  '20.6': 65,
  '20.7': 66,
  '20.8': 67,
  '21.1': 68,
  '21.2': 69,
  '21.3': 70,
  '21.4': 71,
  '21.5': 72,
  '21.6': 73,
  '21.7': 74,
  '21.8': 75,
  '22.1': 76,
  '22.2': 77,
  '22.3': 78,
  '22.4': 79,
  '22.5': 80,
  '22.6': 81,
  '22.7': 82,
  '22.8': 83,
  '23.1': 84,
  '23.2': 85,
  '23.3': 86,
  '23.4': 87,
  '23.5': 88,
  '23.6': 89,
  '23.7': 90,
  '23.8': 91,
};

const SHUTTLE_DISTANCE_M = 40;

/**
 * Converts a raw Yo-Yo IR1 level.shuttle score (e.g. 16.2) to its cumulative
 * shuttle count from test start. Returns null if the score doesn't match any
 * known key (e.g. malformed data) — callers must handle null explicitly,
 * never silently fall back to treating the raw value as a shuttle count.
 */
export function yoyoLevelToShuttleCount(levelShuttleValue) {
  if (levelShuttleValue == null) return null;
  const key = String(levelShuttleValue);
  const normalisedKey = key.includes('.') ? key : `${key}.0`;
  return YOYO_IR1_SHUTTLE_TABLE[normalisedKey] ?? YOYO_IR1_SHUTTLE_TABLE[key] ?? null;
}

/** Optional helper if a metres figure is ever needed (e.g. PDF footnote). */
export function yoyoShuttleCountToMetres(shuttleCount) {
  if (shuttleCount == null) return null;
  return shuttleCount * SHUTTLE_DISTANCE_M;
}

export function isYoYoIr1Test(testName) {
  return (testName ?? '').toLowerCase().includes('yo-yo');
}

export function formatDeltaSuffix(testName, unit, delta) {
  if (isYoYoIr1Test(testName)) {
    const n = Math.abs(Math.round(delta ?? 0));
    return n === 1 ? ' shuttle' : ' shuttles';
  }
  if (unit === 'seconds' || unit === 's') return 's';
  return unit ? ` ${unit}` : '';
}

export function formatDeltaNumber(testName, delta) {
  if (delta == null) return '';
  if (isYoYoIr1Test(testName)) {
    return `${delta > 0 ? '+' : ''}${Math.round(delta)}`;
  }
  return `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;
}
