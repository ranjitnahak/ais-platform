function pillTone(label) {
  const n = String(label || '').toLowerCase()
  if (n === 'excellent' || n === 'elite') return 'var(--color-excellent)'
  if (n === 'above average') return 'var(--color-above-avg)'
  if (n === 'average') return 'var(--color-avg)'
  if (n === 'below average') return 'var(--color-below-avg)'
  return 'var(--color-text-muted)'
}

function barHeight(value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)))
  return `${Math.max(6, n)}%`
}

export default function AthleteProfilePanel({ athlete, onClose }) {
  if (!athlete) return null

  const teams = athlete.teams || []
  const assessments = athlete.assessments_by_group || {}
  const hasAssessment = Object.values(assessments).some(Boolean)
  const labels = ['W1', 'W2', 'W3', 'W4']
  const hist = athlete.compliance_history || [0, 0, 0, 0]

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'color-mix(in srgb, var(--color-bg) 60%, transparent)' }}
      onMouseDown={onClose}
    >
      <aside
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 380,
          maxWidth: '90vw',
          height: '100%',
          borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-surface-low)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
          <span className="sc-label-caps">Athlete Profile</span>
          <button type="button" onClick={onClose} style={closeBtn}>
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', paddingBottom: 110 }}>
          <div style={{ height: 180, position: 'relative', background: 'var(--color-surface-high)' }}>
            {athlete.photo_url ? (
              <img src={athlete.photo_url} alt={athlete.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(var(--color-surface-high), var(--color-surface-highest))' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent, var(--color-surface-low))' }} />
          </div>
          <div style={{ padding: '0 16px', marginTop: -44, position: 'relative' }}>
            <h2 className="sc-headline" style={{ margin: 0, fontWeight: 'var(--font-weight-bold)' }}>
              {athlete.display_name}
            </h2>
            <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: '2px 0 10px' }}>
              {athlete.email || '—'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {teams.map((t) => (
                <span key={t.id} className="sc-label-caps" style={teamPill}>
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          <section style={{ padding: '18px 16px 0' }}>
            <p className="sc-label-caps" style={{ marginBottom: 12 }}>
              Compliance History (Last 4 Weeks)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, alignItems: 'end', height: 120 }}>
              {hist.map((v, i) => (
                <div key={labels[i]} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: '100%', height: 92, background: 'var(--color-surface-high)', borderRadius: 'var(--radius-sm)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: barHeight(v), background: 'var(--color-primary)' }} />
                  </div>
                  <span
                    className="sc-body-sm"
                    style={{ color: i === 3 ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: i === 3 ? 'var(--font-weight-semibold)' : 'var(--font-weight-regular)' }}
                  >
                    {labels[i]}
                  </span>
                </div>
              ))}
            </div>
            {!athlete.has_session_data ? (
              <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', marginTop: 10 }}>
                No session data yet
              </p>
            ) : null}
          </section>

          <section style={{ padding: '18px 16px 0' }}>
            <p className="sc-label-caps" style={{ marginBottom: 12 }}>
              AIS Performance Assessments
            </p>
            {hasAssessment ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Flexibility', assessments.flexibility],
                  ['Speed', assessments.speed],
                  ['Power', assessments.power],
                  ['Endurance', assessments.endurance],
                ].map(([name, val]) => (
                  <div key={name} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-default)', padding: 10, background: 'var(--color-surface-high)' }}>
                    <p className="sc-label-caps" style={{ margin: '0 0 8px' }}>
                      {name}
                    </p>
                    <span className="sc-label-caps" style={{ ...badgeStyle, color: pillTone(val) }}>
                      {val || '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                No assessment data. Run an AIS assessment session to populate this section.
              </p>
            )}
          </section>
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-low)', padding: 12 }}>
          <button type="button" style={primaryBtn} onClick={() => window.alert('Programme assignment coming in next update')}>
            Assign New Programme
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" style={ghostBtn} onClick={() => window.alert('Coming soon')}>
              Edit Profile
            </button>
            <button type="button" style={ghostBtn} onClick={() => window.alert('Coming soon')}>
              View Full Data Log
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

const closeBtn = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-high)',
  color: 'var(--color-text-muted)',
  borderRadius: 'var(--radius-default)',
  width: 28,
  height: 28,
  cursor: 'pointer',
}

const teamPill = {
  padding: '5px 10px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--color-primary-soft)',
  border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
  color: 'var(--color-primary)',
}

const badgeStyle = {
  display: 'inline-block',
  borderRadius: 'var(--radius-full)',
  background: 'color-mix(in srgb, var(--color-surface) 70%, transparent)',
  border: '1px solid var(--color-border)',
  padding: '4px 8px',
}

const primaryBtn = {
  width: '100%',
  border: 'none',
  borderRadius: 'var(--radius-default)',
  padding: '11px 12px',
  background: 'var(--color-primary)',
  color: 'var(--color-text)',
  textTransform: 'uppercase',
  fontWeight: 'var(--font-weight-semibold)',
  letterSpacing: 'var(--letter-spacing-label)',
  cursor: 'pointer',
}

const ghostBtn = {
  flex: 1,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-default)',
  padding: '10px 8px',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  fontSize: 'var(--font-size-label)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
}
