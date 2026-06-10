export const SLOT_HEIGHT = 28;
export const HOUR_HEIGHT = SLOT_HEIGHT * 2;
export const COLLAPSED_HEIGHT = 28;

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatTimeFromMins(totalMins) {
  const clamped = Math.min(Math.max(totalMins, 0), 23 * 60 + 30);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

export function formatTimeLabel(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function sessionOccupiesHour(session, hour) {
  const startMins = parseTimeToMinutes(session.start_time);
  const endMins = startMins + (Number(session.duration_planned) || 60);
  const hourStart = hour * 60;
  const hourEnd = (hour + 1) * 60;
  return startMins < hourEnd && endMins > hourStart;
}

function getOccupiedHours(sessions) {
  const occupied = new Set();
  for (const session of sessions) {
    for (let hour = 0; hour < 24; hour += 1) {
      if (sessionOccupiesHour(session, hour)) occupied.add(hour);
    }
  }
  return occupied;
}

export function computeDeadZoneRanges(sessions) {
  const occupied = getOccupiedHours(sessions);
  const ranges = [];
  let start = null;

  for (let hour = 0; hour < 24; hour += 1) {
    if (!occupied.has(hour)) {
      if (start === null) start = hour;
    } else if (start !== null) {
      ranges.push({ from: start, to: hour });
      start = null;
    }
  }
  if (start !== null) ranges.push({ from: start, to: 24 });
  return ranges;
}

export function getPaddingRange(sessions) {
  if (!sessions.length) return { min: 5, max: 7 };

  let minHour = 23;
  let maxHour = 0;
  for (const session of sessions) {
    const startMins = parseTimeToMinutes(session.start_time);
    const endMins = startMins + (Number(session.duration_planned) || 60);
    const startHour = Math.floor(startMins / 60);
    const endHour = Math.min(23, Math.floor((endMins - 1) / 60));
    minHour = Math.min(minHour, startHour);
    maxHour = Math.max(maxHour, endHour);
  }
  return {
    min: Math.max(0, minHour - 1),
    max: Math.min(23, maxHour + 1),
  };
}

function expandedCollapseBarBeforeHour(hour, expandedZones) {
  for (const [zoneKey, isExpanded] of Object.entries(expandedZones)) {
    if (!isExpanded) continue;
    const fromHour = Number(zoneKey.split('-')[0]);
    if (hour === fromHour) {
      return {
        type: 'expanded-collapse',
        zoneKey,
        fromHour,
        toHour: Number(zoneKey.split('-')[1]),
        heightPx: COLLAPSED_HEIGHT,
      };
    }
  }
  return null;
}

export function buildGridRows(sessions, expandedZones = {}) {
  const padding = getPaddingRange(sessions);
  const deadRanges = computeDeadZoneRanges(sessions);
  const hourStatus = Array.from({ length: 24 }, () => 'visible');

  for (const range of deadRanges) {
    const collapsibleHours = [];
    for (let hour = range.from; hour < range.to; hour += 1) {
      if (hour < padding.min || hour > padding.max) {
        collapsibleHours.push(hour);
      }
    }
    if (!collapsibleHours.length) continue;

    const zoneKey = `${collapsibleHours[0]}-${collapsibleHours[collapsibleHours.length - 1] + 1}`;
    if (expandedZones[zoneKey]) continue;

    for (const hour of collapsibleHours) {
      hourStatus[hour] = 'collapsed';
    }
  }

  const rows = [];
  let hour = 0;
  while (hour < 24) {
    if (hourStatus[hour] === 'collapsed') {
      const fromHour = hour;
      while (hour < 24 && hourStatus[hour] === 'collapsed') hour += 1;
      rows.push({
        type: 'collapsed',
        fromHour,
        toHour: hour,
        heightPx: COLLAPSED_HEIGHT,
        zoneKey: `${fromHour}-${hour}`,
      });
    } else {
      const collapseBar = expandedCollapseBarBeforeHour(hour, expandedZones);
      if (collapseBar) rows.push(collapseBar);
      rows.push({ type: 'hour', hour, heightPx: HOUR_HEIGHT });
      hour += 1;
    }
  }
  return rows;
}

export function timeToOffset(timeStr, rows) {
  const mins = parseTimeToMinutes(timeStr);
  let offset = 0;

  for (const row of rows) {
    if (row.type === 'collapsed' || row.type === 'expanded-collapse') {
      offset += row.heightPx;
      continue;
    }

    const hourStart = row.hour * 60;
    const hourEnd = hourStart + 60;
    if (mins >= hourEnd) {
      offset += row.heightPx;
    } else if (mins >= hourStart) {
      offset += ((mins - hourStart) / 60) * row.heightPx;
      break;
    } else {
      break;
    }
  }

  return offset;
}

export function offsetToTime(offsetPx, rows) {
  let remaining = offsetPx;

  for (const row of rows) {
    if (row.type === 'collapsed' || row.type === 'expanded-collapse') {
      if (remaining < row.heightPx) {
        const snapHour = row.type === 'collapsed' ? row.toHour : row.fromHour;
        return formatTimeFromMins(snapHour * 60);
      }
      remaining -= row.heightPx;
      continue;
    }

    if (remaining < row.heightPx) {
      const fraction = remaining / row.heightPx;
      const slotMins = Math.round((fraction * 60) / 30) * 30;
      const totalMins = row.hour * 60 + Math.min(60, Math.max(0, slotMins));
      return formatTimeFromMins(totalMins);
    }
    remaining -= row.heightPx;
  }

  return '23:30:00';
}

export function durationToHeight(mins) {
  const slots = Math.max(1, (Number(mins) || 60) / 30);
  return slots * SLOT_HEIGHT - 4;
}

export function defaultScrollOffset(sessions, rows) {
  let targetMins = 6 * 60;
  if (sessions.length) {
    const sorted = [...sessions].sort((a, b) => {
      const dateCmp = String(a.session_date).localeCompare(String(b.session_date));
      if (dateCmp !== 0) return dateCmp;
      return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time);
    });
    targetMins = parseTimeToMinutes(sorted[0].start_time);
  }
  return Math.max(0, timeToOffset(formatTimeFromMins(targetMins), rows) - 20);
}

export function totalGridHeight(rows) {
  return rows.reduce((sum, row) => sum + row.heightPx, 0);
}
