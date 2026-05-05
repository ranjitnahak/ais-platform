/** Monday-start week grid relative to programme.start_date, else programme.created_at (local calendar). */

export function startOfWeekMonday(d) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

export function isoLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday–Sunday (inclusive) ISO dates for the local calendar week containing `sessionDate`. */
export function calendarWeekRangeContainingSessionDate(sessionDate) {
  if (sessionDate == null || sessionDate === '') return null
  const str = typeof sessionDate === 'string' ? String(sessionDate).slice(0, 10) : isoLocal(new Date(sessionDate))
  const date = new Date(`${str}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { weekStartDate: isoLocal(monday), weekEndDate: isoLocal(sunday) }
}

/** Seven cells (Mon–Sun) for the calendar week starting `weekStartDateIso` (YYYY-MM-DD, Monday). */
export function calendarWeekDayCells(weekStartDateIso) {
  if (weekStartDateIso == null || weekStartDateIso === '') return []
  const monday = new Date(`${String(weekStartDateIso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(monday.getTime())) return []
  const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const days = []
  for (let i = 0; i < 7; i++) {
    const di = new Date(monday)
    di.setDate(monday.getDate() + i)
    days.push({
      dow: labels[i],
      iso: isoLocal(di),
      display: di.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }).toUpperCase(),
    })
  }
  return days
}

export function programmeWeekAnchorDate(programme) {
  const raw = programme?.start_date
  if (raw != null && String(raw).trim() !== '') {
    const d = new Date(`${String(raw).slice(0, 10)}T12:00:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (programme?.created_at) return new Date(programme.created_at)
  return new Date()
}

/** ISO `YYYY-MM-DD` of the Monday that starts programme Week 1 (local calendar). */
export function weekOneMondayIso(programme) {
  if (!programme) return null
  const row = weekDays(programme, 1)
  return row[0]?.iso ?? null
}

export function addCalendarDaysToIso(iso, deltaDays) {
  if (iso == null || iso === '' || deltaDays === 0) return typeof iso === 'string' ? iso.slice(0, 10) : null
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  d.setDate(d.getDate() + deltaDays)
  return isoLocal(d)
}

/** Signed day count from `fromIso` to `toIso` (local calendar). */
export function diffCalendarDaysIso(fromIso, toIso) {
  if (!fromIso || !toIso) return 0
  const a = new Date(`${String(fromIso).slice(0, 10)}T12:00:00`)
  const b = new Date(`${String(toIso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function weekDays(programme, weekNumber) {
  const created = programmeWeekAnchorDate(programme)
  const ws = startOfWeekMonday(created)
  ws.setDate(ws.getDate() + (weekNumber - 1) * 7)
  const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const days = []
  for (let i = 0; i < 7; i++) {
    const di = new Date(ws)
    di.setDate(ws.getDate() + i)
    days.push({
      dow: labels[i],
      iso: isoLocal(di),
      display: di.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }).toUpperCase(),
    })
  }
  return days
}
