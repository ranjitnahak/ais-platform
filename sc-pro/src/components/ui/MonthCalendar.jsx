import { isoLocal } from '../../lib/weekDates.js'

/** Monday-start 6×7 grid for `viewYear` / `viewMonth0` (0 = January). */
function buildMonthGrid(viewYear, viewMonth0) {
  const firstOfMonth = new Date(viewYear, viewMonth0, 1, 12, 0, 0, 0)
  const dow = firstOfMonth.getDay()
  const offsetMon = dow === 0 ? 6 : dow - 1
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - offsetMon)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push({
      iso: isoLocal(d),
      dayNum: d.getDate(),
      inMonth: d.getMonth() === viewMonth0,
    })
  }
  return cells
}

function monthTitle(viewYear, viewMonth0) {
  const d = new Date(viewYear, viewMonth0, 1, 12, 0, 0, 0)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

const dowHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const btnArrow = {
  border: 'none',
  background: 'var(--color-surface-high)',
  color: 'var(--color-text-muted)',
  width: 28,
  height: 28,
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-body)',
  lineHeight: 1,
  padding: 0,
  flexShrink: 0,
}

/**
 * @param {object} props
 * @param {number} props.viewYear
 * @param {number} props.viewMonth0 — 0 = January
 * @param {() => void} props.onPrevMonth
 * @param {() => void} props.onNextMonth
 * @param {Set<string>|string[]} props.sessionDates — YYYY-MM-DD with sessions
 * @param {string} props.selectedIso
 * @param {string} props.todayIso
 * @param {(iso: string) => void} props.onSelectDate
 */
export default function MonthCalendar({
  viewYear,
  viewMonth0,
  onPrevMonth,
  onNextMonth,
  sessionDates,
  selectedIso,
  todayIso,
  onSelectDate,
}) {
  const cells = buildMonthGrid(viewYear, viewMonth0)
  const dateSet = sessionDates instanceof Set ? sessionDates : new Set(sessionDates || [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 6 }}>
        <button type="button" aria-label="Previous month" onClick={onPrevMonth} style={btnArrow}>
          ‹
        </button>
        <div
          style={{
            fontSize: 'var(--font-size-body)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
            textAlign: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          {monthTitle(viewYear, viewMonth0)}
        </div>
        <button type="button" aria-label="Next month" onClick={onNextMonth} style={btnArrow}>
          ›
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 2,
          textAlign: 'center',
          fontSize: 'var(--font-size-label)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-muted)',
          marginBottom: 4,
        }}
      >
        {dowHeaders.map((h, i) => (
          <div key={`h-${i}`}>{h}</div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 2,
          textAlign: 'center',
        }}
      >
        {cells.map((cell) => {
          const hasSession = dateSet.has(cell.iso)
          const isToday = cell.iso === todayIso
          const isSelected = cell.iso === selectedIso
          const muted = !cell.inMonth
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDate(cell.iso)}
              aria-label={`Select ${cell.iso}`}
              aria-current={isSelected ? 'date' : undefined}
              style={{
                width: '100%',
                maxWidth: 28,
                margin: '0 auto',
                padding: '2px 0 4px',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                background: isToday ? 'var(--color-primary)' : 'transparent',
                outline: isSelected ? '2px solid var(--color-primary)' : 'none',
                outlineOffset: isSelected ? 1 : 0,
                color: muted
                  ? 'var(--color-text-muted)'
                  : isToday
                    ? 'var(--color-text)'
                    : 'var(--color-text)',
                opacity: muted ? 0.45 : 1,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                minHeight: 34,
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-body-sm)', lineHeight: 1.1, fontWeight: 'var(--font-weight-medium)' }}>
                {cell.dayNum}
              </span>
              <span
                aria-hidden
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 'var(--radius-full)',
                  marginTop: 2,
                  background: hasSession ? 'var(--color-primary)' : 'transparent',
                  flexShrink: 0,
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
