import { useState } from 'react'

export default function AgentReportCard({ report, totalWeeks, onViewProgramme, onStartOver }) {
  const [openDec, setOpenDec] = useState(false)
  const [openSkip, setOpenSkip] = useState(false)
  const decisions = report?.decisions ?? []
  const skipped = report?.skipped ?? []
  const completed = report?.completed ?? []

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.12)',
        padding: 14,
        background: 'rgba(255,255,255,0.05)',
        marginBottom: 10,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6 }}>✅ Programme built</div>
      <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
        {completed.length || totalWeeks ? `${completed.length || totalWeeks} week(s)` : '—'} · see programme for session totals
      </p>

      {decisions.length ? (
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setOpenDec((o) => !o)}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--color-primary)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Decisions made during build {openDec ? '▼' : '▸'}
          </button>
          {openDec ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--color-text-muted)' }}>
              {decisions.map((d, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <strong style={{ color: '#fff' }}>{d.choice}</strong> — {d.description?.slice(0, 120)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {skipped.length ? (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setOpenSkip((o) => !o)}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--color-danger)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Items skipped {openSkip ? '▼' : '▸'}
          </button>
          {openSkip ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--color-danger)' }}>
              {skipped.map((s, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {s.kind || 'item'}: {s.reason || JSON.stringify(s)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onViewProgramme}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          border: 'none',
          background: 'var(--color-primary)',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        View programme
      </button>
      <button
        type="button"
        onClick={onStartOver}
        style={{
          border: 'none',
          background: 'none',
          color: 'var(--color-text-muted)',
          fontSize: 12,
          cursor: 'pointer',
          textDecoration: 'underline',
          width: '100%',
        }}
      >
        Start over
      </button>
    </div>
  )
}
