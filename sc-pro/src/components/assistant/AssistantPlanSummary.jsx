import { useState } from 'react'

function sessionSummary(sess) {
  const n = (sess.blocks ?? []).reduce((a, b) => a + (b.exercises ?? []).length, 0)
  const day = sess.day_of_week ? String(sess.day_of_week).slice(0, 3) : '—'
  return { line: `• ${day} — ${sess.name || 'Session'} (${n} exercises)`, n }
}

export default function AssistantPlanSummary({ plan, onBuildWeek1, onReview, onCancel, startWeek = 1 }) {
  const [open, setOpen] = useState({})
  if (!plan) return null
  const weeks = plan.weeks ?? []
  const dps = plan.decision_points ?? []
  const totalW = plan.total_weeks ?? weeks.length

  return (
    <div style={{ fontSize: 13, color: '#e5e5e5', lineHeight: 1.5 }}>
      <p style={{ margin: '0 0 8px' }}>
        I&apos;ve read your programme. Here&apos;s what I&apos;ll build:
      </p>
      <p style={{ fontWeight: 600, color: 'var(--color-primary)', margin: '0 0 6px' }}>
        {plan.programme_name || 'Programme'} — {totalW} week(s)
      </p>
      {weeks.slice(0, 6).map((w) => {
        const wk = w.week_number ?? 0
        const isOpen = open[wk] ?? wk === 1
        const sessions = w.sessions ?? []
        return (
          <div key={wk} style={{ marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [wk]: !isOpen }))}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--color-text-muted)',
                padding: 0,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {isOpen ? '▼' : '▸'} Week {wk}: {sessions.length} session(s)
            </button>
            {isOpen ? (
              <div style={{ paddingLeft: 10, marginTop: 4 }}>
                {sessions.map((s, i) => (
                  <div key={i} className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {sessionSummary(s).line}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}

      {dps.length ? (
        <div style={{ marginTop: 10 }}>
          <div className="sc-label-caps" style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>
            Decision points
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-muted)', fontSize: 12 }}>
            {dps.slice(0, 6).map((d, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                {d.description?.slice(0, 120) || d.type}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => onBuildWeek1?.(startWeek)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--color-primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Build Week {startWeek}
        </button>
        <button
          type="button"
          onClick={() => {
            const o = {}
            for (const w of weeks) o[w.week_number ?? 0] = true
            setOpen(o)
            onReview?.()
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: '#fff',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Review full plan
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
