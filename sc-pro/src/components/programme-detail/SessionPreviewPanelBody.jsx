import { formatPrescriptionSummary } from '../../lib/sessionPreviewFormat.js'

function exName(row) {
  const lib = row.exercise_library
  const o = Array.isArray(lib) ? lib[0] : lib
  return o?.name || 'Exercise'
}

export default function SessionPreviewPanelBody({ session }) {
  const blocks = [...(session?.session_blocks ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {blocks.map((block, bi) => {
        const letter = String.fromCharCode(65 + bi)
        const sortedEx = [...(block.session_exercises ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        return (
          <section key={block.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--font-size-body-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {letter}
              </span>
              <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{block.label || 'Block'}</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {sortedEx.map((ex) => (
                <li
                  key={ex.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{exName(ex)}</span>
                  {ex.superset_group != null ? (
                    <span
                      className="sc-body-sm"
                      style={{
                        color: 'var(--color-primary)',
                        fontWeight: 'var(--font-weight-semibold)',
                      }}
                    >
                      SS
                    </span>
                  ) : null}
                  <span className="sc-body-sm" style={{ color: 'var(--color-text-muted)', width: '100%' }}>
                    {formatPrescriptionSummary(ex)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
