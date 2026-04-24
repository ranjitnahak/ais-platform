export function FilterSelect({ label, value, options, onChange, resetPage }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--font-size-label)' }}>
      <span className="sc-label-caps">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          resetPage?.()
        }}
        style={{
          padding: '8px 10px',
          borderRadius: 'var(--radius-default)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          minWidth: 160,
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

export function MenuItem({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        border: 'none',
        background: 'transparent',
        color: 'var(--color-text)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-body-sm)',
      }}
    >
      {children}
    </button>
  )
}

export function IconButton({ label, onClick, icon }) {
  return (
    <button
      type="button"
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        marginLeft: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--color-text-muted)',
        padding: 4,
      }}
    >
      {icon === 'pencil' && '✎'}
      {icon === 'copy' && '⎘'}
      {icon === 'dots' && '⋮'}
    </button>
  )
}

export const btnPrimary = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-default)',
  border: 'none',
  background: 'var(--color-primary)',
  color: 'var(--color-text)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
}

export const btnOutline = {
  ...btnPrimary,
  background: 'transparent',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
}

export const badgeBase = {
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--font-size-body-sm)',
  fontWeight: 'var(--font-weight-medium)',
  textTransform: 'capitalize',
}
