/** Monday-start week grid relative to programme.created_at (local calendar). */

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

export function weekDays(programme, weekNumber) {
  const created = programme?.created_at ? new Date(programme.created_at) : new Date()
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
