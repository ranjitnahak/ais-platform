const btnPrimary = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#F97316',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
}

const btnOutline = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text)',
  fontSize: 13,
  cursor: 'pointer',
}

export default function AssistantActionCard({ action, onConfirm, onCancel }) {
  if (!action) return null
  return (
    <div
      style={{
        borderLeft: '4px solid #F97316',
        background: 'rgba(249, 115, 22, 0.08)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <div style={{ fontSize: 10, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Proposed action
      </div>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, marginTop: 6 }}>{action.description}</div>
      <div className="sc-body-sm" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
        {action.reversible ? 'This action is reversible' : 'This action cannot be undone'}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" style={btnPrimary} onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" style={btnOutline} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
