/** Presentational bits for SetsRepsTable — keeps SetsRepsTable.jsx under line budget. */

import { createPortal } from 'react-dom'

const MENU_PANEL = {
  position: 'fixed',
  minWidth: 200,
  maxHeight: 'min(360px, 70vh)',
  overflowY: 'auto',
  background: 'var(--color-surface-highest)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  zIndex: 4000,
  boxShadow: '0 8px 24px color-mix(in srgb, var(--color-bg) 40%, transparent)',
}

const MENU_ITEM = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text)',
  padding: '10px 14px',
  cursor: 'pointer',
  fontSize: 'var(--font-size-body)',
}

/** Fixed popover listing optional columns to add */
export function ColumnAddMenu({ open, menuPos, menuPanelRef, options, onPick }) {
  if (!open || !menuPos) return null
  const panel = (
    <div ref={menuPanelRef} style={{ ...MENU_PANEL, top: menuPos.top, right: menuPos.vw - menuPos.right }}>
      {options.map(({ key, label }) => (
        <button key={key} type="button" className="sc-body" style={MENU_ITEM} onClick={() => onPick(key)}>
          {label}
        </button>
      ))}
    </div>
  )
  return createPortal(panel, document.body)
}

export function Ch() {
  return <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.85 }} aria-hidden>▾</span>
}

export const PLAIN_BTN = {
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-body)',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  width: '100%',
  maxWidth: 120,
  margin: '0 auto',
  display: 'block',
}

export const INP_FOCUS = {
  width: '100%',
  maxWidth: 120,
  margin: '0 auto',
  display: 'block',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '2px solid #fff',
  outline: 'none',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 'var(--font-size-body)',
  textAlign: 'center',
  boxSizing: 'border-box',
}

export const ADD_BTN = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '2px dashed var(--color-text-muted)',
  color: 'var(--color-text-muted)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: 0,
  flexShrink: 0,
}

export function EditableCell({ rowIdx, field, value, meta, active, setActive, changeCell, dataAttr }) {
  const isOn = active?.row === rowIdx && active?.field === field
  const lab = meta?.label ?? field
  if (!isOn) {
    const display = value !== '' && value != null ? String(value) : '—'
    return (
      <button type="button" aria-label={lab} style={PLAIN_BTN} onClick={() => setActive({ row: rowIdx, field })}>
        <span className="sc-body">{display}</span>
      </button>
    )
  }
  const common = {
    ...dataAttr,
    autoFocus: true,
    style: INP_FOCUS,
    'aria-label': lab,
    value: value ?? '',
    onChange: (e) => changeCell(rowIdx, field, e.target.value),
    onBlur: () => setActive(null),
    onKeyDown: (e) => e.key === 'Enter' && setActive(null),
  }
  if (meta?.kind === 'text') return <input {...common} type="text" placeholder="—" />
  return <input {...common} type="number" min={meta?.min} max={meta?.max} step={meta?.step ?? 1} placeholder="—" />
}
