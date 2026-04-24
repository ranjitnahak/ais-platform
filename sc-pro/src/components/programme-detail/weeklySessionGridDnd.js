import { isoLocal } from '../../lib/weekDates.js'

export const DAY_PREFIX = 'day-col:'
export const SESS_PREFIX = 'session:'
export const SESS_DROP_PREFIX = 'session-drop:'

export function dayColDroppableId(iso) {
  return `${DAY_PREFIX}${iso}`
}

export function sessionDraggableId(sessionId) {
  return `${SESS_PREFIX}${sessionId}`
}

export function parseSessionDragId(id) {
  const s = String(id)
  return s.startsWith(SESS_PREFIX) ? s.slice(SESS_PREFIX.length) : null
}

export function sessionDropId(sessionId) {
  return `${SESS_DROP_PREFIX}${sessionId}`
}

export function parseSessionDropTargetId(id) {
  const s = String(id)
  if (s.startsWith(SESS_DROP_PREFIX)) return s.slice(SESS_DROP_PREFIX.length)
  return null
}

export function resolveTargetDayIso(overId, sessionsByDay, dayCols) {
  if (overId == null) return null
  const id = String(overId)
  if (id.startsWith(DAY_PREFIX)) return id.slice(DAY_PREFIX.length)
  const sid = id.startsWith(SESS_DROP_PREFIX)
    ? id.slice(SESS_DROP_PREFIX.length)
    : id.startsWith(SESS_PREFIX)
      ? id.slice(SESS_PREFIX.length)
      : null
  if (sid) {
    for (const d of dayCols) {
      for (const { session } of sessionsByDay[d.iso] ?? []) {
        if (session.id === sid) return d.iso
      }
    }
  }
  return null
}

export function sessionDateIso(session) {
  if (!session?.session_date) return null
  const sd = session.session_date
  return typeof sd === 'string' ? sd.slice(0, 10) : isoLocal(new Date(sd))
}

export const dayColumnShellStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minHeight: 96,
  borderRadius: 'var(--radius-lg)',
}
