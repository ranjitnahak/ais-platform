import AthleteRow from './AthleteRow.jsx'

export default function AthleteTable({
  athletes,
  loading,
  error,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onViewProfile,
}) {
  const allSelected = athletes.length > 0 && selectedIds.length === athletes.length

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--color-surface-low)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--color-surface-high)' }}>
            <tr>
              <th style={thBase}>
                <input type="checkbox" checked={allSelected} onChange={() => onToggleSelectAll?.()} />
              </th>
              <th style={thBase}>Athlete</th>
              <th style={thBase}>Teams</th>
              <th style={thBase}>Programme</th>
              <th style={thBase}>Last Session</th>
              <th style={thBase}>Compliance</th>
              <th style={thBase}>Assessment</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={stateTd}>
                  Loading athletes...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} style={{ ...stateTd, color: 'var(--color-danger)' }}>
                  {error}
                </td>
              </tr>
            ) : athletes.length === 0 ? (
              <tr>
                <td colSpan={8} style={stateTd}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span aria-hidden>👥</span>
                    <span>No athletes found</span>
                  </div>
                </td>
              </tr>
            ) : (
              athletes.map((athlete) => (
                <AthleteRow
                  key={athlete.id}
                  athlete={athlete}
                  isSelected={selectedIds.includes(athlete.id)}
                  onSelect={onToggleSelect}
                  onViewProfile={onViewProfile}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thBase = {
  padding: '12px 10px',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: 'var(--letter-spacing-label)',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--font-size-label)',
  fontWeight: 'var(--font-weight-semibold)',
}

const stateTd = {
  padding: '48px 16px',
  textAlign: 'center',
  color: 'var(--color-text-muted)',
}
