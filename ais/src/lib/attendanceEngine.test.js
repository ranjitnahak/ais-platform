import assert from 'node:assert/strict';
import {
  computeAthleteSummary,
  computeAttendanceRate,
  computeReasonBreakdown,
  computeSquadMetrics,
  computeWeeklyTrend,
  isAthleteScheduled,
} from './attendanceEngine.js';

const dateRange = { dateFrom: '2026-06-01', dateTo: '2026-06-28' };
const teamId = 'team-1';

const sessions = [
  { id: 's1', team_id: teamId, session_date: '2026-06-02', athlete_id: null },
  { id: 's2', team_id: teamId, session_date: '2026-06-09', athlete_id: null },
  { id: 's3', team_id: teamId, session_date: '2026-06-16', athlete_id: null },
];

const athleteTeams = [
  {
    athlete_id: 'a1',
    team_id: teamId,
    joined_at: '2026-01-01',
    left_at: null,
    athletes: { full_name: 'Alex Present' },
  },
  {
    athlete_id: 'a2',
    team_id: teamId,
    joined_at: '2026-01-01',
    left_at: null,
    athletes: { full_name: 'Blake Absent' },
  },
];

const attendanceRecords = [
  {
    session_id: 's2',
    athlete_id: 'a2',
    status: 'absent',
    reason: 'sickness',
    informed: false,
  },
  {
    session_id: 's3',
    athlete_id: 'a2',
    status: 'late',
    reason: 'other',
    informed: true,
  },
];

// Present-default athlete
const alexRate = computeAttendanceRate({
  sessions,
  athleteTeams,
  attendanceRecords,
  athleteId: 'a1',
  dateRange,
  teamId,
});
assert.equal(alexRate.sessionsScheduled, 3);
assert.equal(alexRate.absentCount, 0);
assert.equal(alexRate.lateCount, 0);
assert.equal(alexRate.sessionsAttended, 3);
assert.equal(alexRate.rate, 100);

// Athlete with absent + late
const blakeRate = computeAttendanceRate({
  sessions,
  athleteTeams,
  attendanceRecords,
  athleteId: 'a2',
  dateRange,
  teamId,
});
assert.equal(blakeRate.sessionsScheduled, 3);
assert.equal(blakeRate.absentCount, 1);
assert.equal(blakeRate.lateCount, 1);
assert.equal(blakeRate.sessionsAttended, 2);
assert.ok(blakeRate.rate < 100);

// joined_at / left_at window
const futureJoin = isAthleteScheduled(
  sessions[0],
  { athlete_id: 'a3', joined_at: '2026-06-10', left_at: null },
  dateRange,
  teamId,
);
assert.equal(futureJoin, false);

const summary = computeAthleteSummary({
  sessions,
  athleteTeams,
  attendanceRecords,
  teamId,
  dateRange,
});
assert.equal(summary.length, 2);
assert.equal(summary[0].athleteId, 'a2');
assert.equal(summary[1].athleteId, 'a1');
assert.equal(summary[1].attendanceRate, 100);
assert.equal(summary[1].lateCount, 0);
assert.equal(summary[1].absentCount, 0);

const squad = computeSquadMetrics({
  sessions,
  athleteTeams,
  attendanceRecords,
  teamId,
  dateRange,
});
assert.equal(squad.exceptionCount, 2);
assert.equal(squad.withoutNoticeCount, 1);
assert.equal(squad.lateCount, 1);

const reasons = computeReasonBreakdown({ attendanceRecords, sessions, dateRange });
assert.equal(reasons.sickness, 1);
assert.equal(reasons.other, 1);
assert.equal(reasons.injury, 0);

const trend = computeWeeklyTrend({
  sessions,
  athleteTeams,
  attendanceRecords,
  teamId,
  dateRange,
});
assert.ok(trend.length > 0);
assert.ok(trend.every((week) => week.weekLabel.startsWith('W')));

// Subset session: only a1 assigned on s1 → a2 not scheduled for s1
const subsetMap = {
  s1: new Set(['a1']),
};
assert.equal(
  isAthleteScheduled(sessions[0], athleteTeams[0], dateRange, teamId, subsetMap),
  true,
);
assert.equal(
  isAthleteScheduled(sessions[0], athleteTeams[1], dateRange, teamId, subsetMap),
  false,
);
// Sessions without map entries still use full-team behaviour
assert.equal(
  isAthleteScheduled(sessions[1], athleteTeams[1], dateRange, teamId, subsetMap),
  true,
);

const blakeSubsetRate = computeAttendanceRate({
  sessions,
  athleteTeams,
  attendanceRecords,
  athleteId: 'a2',
  dateRange,
  teamId,
  sessionAthleteIdsBySession: subsetMap,
});
assert.equal(blakeSubsetRate.sessionsScheduled, 2);

const alexSubsetRate = computeAttendanceRate({
  sessions,
  athleteTeams,
  attendanceRecords,
  athleteId: 'a1',
  dateRange,
  teamId,
  sessionAthleteIdsBySession: subsetMap,
});
assert.equal(alexSubsetRate.sessionsScheduled, 3);

// Empty set / missing entry → full-team fallback
assert.equal(
  isAthleteScheduled(sessions[0], athleteTeams[1], dateRange, teamId, { s1: [] }),
  true,
);
assert.equal(
  isAthleteScheduled(sessions[0], athleteTeams[1], dateRange, teamId, {}),
  true,
);

console.log('attendanceEngine.test.js: all assertions passed');
