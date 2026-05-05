export default function AgentChoiceCard({ decision, onChoice, onSkip }) {
  const opts = decision?.options ?? []
  const def = decision?.default

  return (
    <div
      style={{
        borderLeft: '4px solid var(--color-primary)',
        padding: '10px 12px',
        marginBottom: 10,
        background: 'rgba(249,115,22,0.08)',
        borderRadius: '0 10px 10px 0',
      }}
    >
      <div className="sc-label-caps" style={{ color: 'var(--color-primary)', marginBottom: 6 }}>
        ⚠ Decision needed
      </div>
      <p style={{ fontSize: 13, color: '#fff', margin: '0 0 10px', lineHeight: 1.45 }}>{decision?.description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {opts.map((opt, i) => {
          const isRec = (def && opt === def) || (!def && i === 0)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChoice(opt)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: isRec ? 'none' : '1px solid rgba(255,255,255,0.2)',
                background: isRec ? 'var(--color-primary)' : 'transparent',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onSkip}
        style={{
          marginTop: 10,
          border: 'none',
          background: 'none',
          color: 'var(--color-text-muted)',
          fontSize: 11,
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        Skip and continue
      </button>
    </div>
  )
}
