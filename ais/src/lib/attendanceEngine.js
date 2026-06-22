import { addDays, toISODate, weekStartsBetween } from './periodisationUtils.js';

function sessionDateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function isDateInRange(date, dateRange) {
  if (!date || !dateRange?.dateFrom || !dateRange?.dateTo) return false;
  return date >= dateRange.dateFrom && date <= dateRange.dateTo;
}

function isAthleteOnTeamForSession(sessionDate, athleteTeam) {
  const joinedAt = sessionDateOnly(athleteTeam.joined_at);
  if (joinedAt && joinedAt > sessionDate) return false;

  const leftAt = sessionDateOnly(athleteTeam.left_at);
  if (leftAt && leftAt < sessionDate) return false;

  return true;
}

export function isAthleteScheduled(session, athleteTeam, dateRange, teamId) {
  const sessionDate = sessionDateOnly(session.session_date);
  if (!sessionDate || !isDateInRange(sessionDate, dateRange)) return false;
  if (teamId && session.team_id !== teamId) return false;
  const athleteId = athleteTeam.athlete_id ?? athleteTeam.athleteId;
  if (session.athlete_id && session.athlete_id !== athleteId) return false;
  if (athleteTeam.athlete_id && athleteTeam.athlete_id !== athleteId) return false;
  return isAthleteOnTeamForSession(sessionDate, athleteTeam);
}

export function findException(attendanceRecords, sessionId, athleteId) {
  return (attendanceRecords ?? []).find(
    (row) => row.session_id === sessionId && row.athlete_id === athleteId,
  );
}

function normalizeAthleteTeams(athleteTeams, teamId) {
  return (athleteTeams ?? [])
    .filter((row) => !teamId || row.team_id === teamId || !row.team_id)
    .map((row) => {
      const athlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes;
      return {
        athlete_id: row.athlete_id,
        athleteId: row.athlete_id,
        joined_at: row.joined_at,
        left_at: row.left_at,
        team_id: row.team_id,
        athleteName: athlete?.full_name ?? athlete?.name ?? 'Unknown',
      };
    });
}

function filterTeamSessions(sessions, teamId, dateRange) {
  return (sessions ?? []).filter((session) => {
    const sessionDate = sessionDateOnly(session.session_date);
    if (!isDateInRange(sessionDate, dateRange)) return false;
    if (teamId && session.team_id !== teamId) return false;
    return true;
  });
}

function scheduledSessionsForAthlete(sessions, athleteTeam, dateRange, teamId) {
  return filterTeamSessions(sessions, teamId, dateRange).filter((session) =>
    isAthleteScheduled(session, athleteTeam, dateRange, teamId),
  );
}

function countAthleteExceptions(scheduled, athleteId, attendanceRecords) {
  let lateCount = 0;
  let absentCount = 0;
  let withoutNoticeCount = 0;

  for (const session of scheduled) {
    const exc = findException(attendanceRecords, session.id, athleteId);
    if (!exc) continue;
    if (exc.status === 'late') {
      lateCount += 1;
      if (exc.informed === false) withoutNoticeCount += 1;
    } else if (exc.status === 'absent') {
      absentCount += 1;
      if (exc.informed === false) withoutNoticeCount += 1;
    }
  }

  return { lateCount, absentCount, withoutNoticeCount };
}

export function computeAttendanceRate({
  sessions,
  athleteTeams,
  attendanceRecords,
  athleteId,
  dateRange,
  teamId,
}) {
  const athleteTeam = normalizeAthleteTeams(athleteTeams, teamId).find(
    (row) => row.athlete_id === athleteId,
  );
  if (!athleteTeam) {
    return {
      rate: null,
      sessionsScheduled: 0,
      sessionsAttended: 0,
      lateCount: 0,
      absentCount: 0,
    };
  }

  const scheduled = scheduledSessionsForAthlete(sessions, athleteTeam, dateRange, teamId);
  const sessionsScheduled = scheduled.length;
  const { lateCount, absentCount } = countAthleteExceptions(
    scheduled,
    athleteId,
    attendanceRecords,
  );
  const sessionsAttended = sessionsScheduled - absentCount;
  const rate = sessionsScheduled > 0
    ? Math.round((sessionsAttended / sessionsScheduled) * 1000) / 10
    : null;

  return {
    rate,
    sessionsScheduled,
    sessionsAttended,
    lateCount,
    absentCount,
  };
}

function weekEndSunday(mondayIso) {
  return addDays(mondayIso, 6);
}

function sessionsInWeek(sessions, weekStart, weekEnd, dateRange) {
  const rangeStart = dateRange.dateFrom > weekStart ? dateRange.dateFrom : weekStart;
  const rangeEnd = dateRange.dateTo < weekEnd ? dateRange.dateTo : weekEnd;
  if (rangeStart > rangeEnd) return [];

  return (sessions ?? []).filter((session) => {
    const sessionDate = sessionDateOnly(session.session_date);
    return sessionDate >= rangeStart && sessionDate <= rangeEnd;
  });
}

export function computeWeeklyTrend({
  sessions,
  athleteTeams,
  attendanceRecords,
  teamId,
  dateRange,
}) {
  const teams = normalizeAthleteTeams(athleteTeams, teamId);
  const weeks = weekStartsBetween(dateRange.dateFrom, dateRange.dateTo);

  return weeks.map((week, index) => {
    const weekStart = week.monday;
    const weekEnd = weekEndSunday(weekStart);
    const weekSessions = sessionsInWeek(sessions, weekStart, weekEnd, dateRange).filter(
      (session) => !teamId || session.team_id === teamId,
    );

    let scheduledTotal = 0;
    let attendedTotal = 0;

    for (const athleteTeam of teams) {
      const athleteId = athleteTeam.athlete_id;
      const athleteScheduled = weekSessions.filter((session) =>
        isAthleteScheduled(session, athleteTeam, dateRange, teamId),
      );
      scheduledTotal += athleteScheduled.length;
      const { absentCount } = countAthleteExceptions(
        athleteScheduled,
        athleteId,
        attendanceRecords,
      );
      attendedTotal += athleteScheduled.length - absentCount;
    }

    const attendanceRate = scheduledTotal > 0
      ? Math.round((attendedTotal / scheduledTotal) * 1000) / 10
      : null;

    const weekLabel = `W${index + 1}`;
    return { weekLabel, weekStart, attendanceRate };
  });
}

export function computeReasonBreakdown({ attendanceRecords, sessions, dateRange }) {
  const sessionDates = Object.fromEntries(
    (sessions ?? []).map((session) => [session.id, sessionDateOnly(session.session_date)]),
  );

  const breakdown = { sickness: 0, injury: 0, other: 0 };

  for (const record of attendanceRecords ?? []) {
    const sessionDate = sessionDates[record.session_id];
    if (!sessionDate || !isDateInRange(sessionDate, dateRange)) continue;
    if (record.status !== 'late' && record.status !== 'absent') continue;
    const reason = record.reason ?? 'other';
    if (reason === 'sickness') breakdown.sickness += 1;
    else if (reason === 'injury') breakdown.injury += 1;
    else breakdown.other += 1;
  }

  return breakdown;
}

function wasOnTeamDuringRange(athleteTeam, dateRange) {
  const joinedAt = sessionDateOnly(athleteTeam.joined_at);
  const leftAt = sessionDateOnly(athleteTeam.left_at);
  if (joinedAt && joinedAt > dateRange.dateTo) return false;
  if (leftAt && leftAt < dateRange.dateFrom) return false;
  return true;
}

export function computeAthleteSummary({
  sessions,
  athleteTeams,
  attendanceRecords,
  teamId,
  dateRange,
}) {
  const teams = normalizeAthleteTeams(athleteTeams, teamId).filter((row) =>
    wasOnTeamDuringRange(row, dateRange),
  );

  const uniqueAthletes = new Map();
  for (const row of teams) {
    if (!uniqueAthletes.has(row.athlete_id)) {
      uniqueAthletes.set(row.athlete_id, row);
    }
  }

  const summary = [...uniqueAthletes.values()].map((athleteTeam) => {
    const athleteId = athleteTeam.athlete_id;
    const stats = computeAttendanceRate({
      sessions,
      athleteTeams,
      attendanceRecords,
      athleteId,
      dateRange,
      teamId,
    });
    const { withoutNoticeCount } = countAthleteExceptions(
      scheduledSessionsForAthlete(sessions, athleteTeam, dateRange, teamId),
      athleteId,
      attendanceRecords,
    );

    return {
      athleteId,
      athleteName: athleteTeam.athleteName,
      sessionsScheduled: stats.sessionsScheduled,
      attendanceRate: stats.rate,
      lateCount: stats.lateCount,
      absentCount: stats.absentCount,
      withoutNoticeCount,
    };
  });

  return summary.sort((a, b) => {
    const rateA = a.attendanceRate ?? Infinity;
    const rateB = b.attendanceRate ?? Infinity;
    if (rateA !== rateB) return rateA - rateB;
    return a.athleteName.localeCompare(b.athleteName);
  });
}

export function computeSquadMetrics({
  sessions,
  athleteTeams,
  attendanceRecords,
  teamId,
  dateRange,
}) {
  const summary = computeAthleteSummary({
    sessions,
    athleteTeams,
    attendanceRecords,
    teamId,
    dateRange,
  });

  let sessionsScheduled = 0;
  let sessionsAttended = 0;
  let exceptionCount = 0;
  let withoutNoticeCount = 0;
  let lateCount = 0;

  for (const row of summary) {
    sessionsScheduled += row.sessionsScheduled;
    sessionsAttended += row.sessionsScheduled - row.absentCount;
    exceptionCount += row.lateCount + row.absentCount;
    withoutNoticeCount += row.withoutNoticeCount;
    lateCount += row.lateCount;
  }

  const attendanceRate = sessionsScheduled > 0
    ? Math.round((sessionsAttended / sessionsScheduled) * 1000) / 10
    : null;

  return {
    attendanceRate,
    exceptionCount,
    withoutNoticeCount,
    lateCount,
    sessionsScheduled,
    sessionsAttended,
  };
}

export function buildFourWeekRange(today = new Date()) {
  const dateTo = toISODate(today);
  const dateFrom = addDays(dateTo, -28);
  return { dateFrom, dateTo };
}
