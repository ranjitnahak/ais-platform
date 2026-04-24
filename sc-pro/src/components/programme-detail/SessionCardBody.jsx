import { badgePill } from '../../lib/programmeSessionUi.js'

export function SessionCardBody({ session, counts, cat, soft, categoryBadgeOpacity = 1 }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ ...badgePill, ...soft, opacity: categoryBadgeOpacity }}>{cat}</span>
      </div>
      <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 6 }}>{session.name || 'Session'}</div>
      <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
        {counts[session.id] ?? 0} exercises · {session.planned_duration_min ?? session.duration_planned ?? '—'} min
      </div>
    </>
  )
}
