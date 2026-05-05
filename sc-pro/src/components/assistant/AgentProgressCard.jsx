export default function AgentProgressCard({
  currentWeek,
  totalWeeks,
  currentStep,
  totalSteps,
  stepDescription,
  completedSteps,
  onStop,
}) {
  const pct = totalWeeks ? Math.min(100, Math.round((currentWeek / totalWeeks) * 100)) : 0
  const stepPct = totalSteps ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        padding: 12,
        background: 'rgba(255,255,255,0.04)',
        marginBottom: 10,
      }}
    >
      <div className="sc-label-caps" style={{ color: 'var(--color-primary)', marginBottom: 6 }}>
        Building Week {currentWeek} of {totalWeeks || '—'}
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.3s' }} />
      </div>
      <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
        Step {currentStep} / {totalSteps || '—'} · {stepPct}%
      </div>
      {stepDescription ? (
        <p className="sc-body-sm" style={{ color: '#fff', margin: '8px 0 4px' }}>
          {stepDescription}
        </p>
      ) : null}
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--color-text-muted)', fontSize: 12 }}>
        {(completedSteps ?? []).slice(-3).map((s, i) => (
          <li key={i} style={{ marginBottom: 2 }}>
            ✓ {s}
          </li>
        ))}
      </ul>
      <div style={{ textAlign: 'right', marginTop: 8 }}>
        <button
          type="button"
          onClick={onStop}
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 11,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Stop build
        </button>
      </div>
    </div>
  )
}
