import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isoLocal } from '../../lib/weekDates.js'

const VIEWPORT_PAD = 10

const menuShell = {
  position: 'fixed',
  zIndex: 500,
  minWidth: 220,
  maxWidth: 280,
  maxHeight: 'calc(100dvh - 24px)',
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: 4,
  background: 'var(--color-surface-highest)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px color-mix(in srgb, var(--color-bg) 60%, transparent)',
}

const itemBase = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--color-text)',
  fontSize: 'var(--font-size-body-sm)',
  cursor: 'pointer',
}

function MenuDivider() {
  return <div role="separator" style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0' }} />
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function sessionDateIso(session) {
  if (!session?.session_date) return null
  const sd = session.session_date
  return typeof sd === 'string' ? sd.slice(0, 10) : isoLocal(new Date(sd))
}

export default function SessionCardContextMenu({
  x,
  y,
  session,
  dayCols = [],
  canMutate = true,
  onPreview,
  onEdit,
  onTogglePublish,
  onSaveToLibraryStub,
  onRepeatConfirm,
  onCopyToClipboard,
  onDeleteConfirm,
  onClose,
}) {
  const ref = useRef(null)
  const [panel, setPanel] = useState(null)
  const [repeatIso, setRepeatIso] = useState(() => sessionDateIso(session) ?? dayCols[0]?.iso ?? '')
  const [menuPos, setMenuPos] = useState({ left: x, top: y })

  const published = session?.is_published === true
  const name = session?.name || 'Session'

  useEffect(() => {
    setRepeatIso(sessionDateIso(session) ?? dayCols[0]?.iso ?? '')
  }, [session, dayCols])

  useLayoutEffect(() => {
    const node = ref.current
    if (!node || typeof window === 'undefined') return
    const clamp = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      node.style.left = `${x}px`
      node.style.top = `${y}px`
      const rect = node.getBoundingClientRect()
      let left = Math.min(x, vw - rect.width - VIEWPORT_PAD)
      left = Math.max(VIEWPORT_PAD, left)
      let top = Math.min(y, vh - rect.height - VIEWPORT_PAD)
      top = Math.max(VIEWPORT_PAD, top)
      node.style.left = ''
      node.style.top = ''
      setMenuPos((prev) => (prev.left === left && prev.top === top ? prev : { left, top }))
    }
    clamp()
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [x, y, panel, session?.id, dayCols.length, canMutate, name])

  useEffect(() => {
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', down, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down, true)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])

  const itemHover = (el, on) => {
    if (!el) return
    el.style.background = on ? 'var(--color-surface-high)' : 'transparent'
  }

  const mutItem = (extra = {}) => ({
    ...itemBase,
    ...extra,
    opacity: canMutate ? 1 : 0.45,
    cursor: canMutate ? 'pointer' : 'not-allowed',
  })

  return (
    <div
      ref={ref}
      role="menu"
      data-session-card-menu
      style={{ ...menuShell, left: menuPos.left, top: menuPos.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        style={itemBase}
        onMouseEnter={(e) => itemHover(e.currentTarget, true)}
        onMouseLeave={(e) => itemHover(e.currentTarget, false)}
        onClick={() => {
          onPreview()
          onClose()
        }}
      >
        Preview
      </button>
      <button
        type="button"
        role="menuitem"
        style={itemBase}
        onMouseEnter={(e) => itemHover(e.currentTarget, true)}
        onMouseLeave={(e) => itemHover(e.currentTarget, false)}
        onClick={() => {
          onEdit()
          onClose()
        }}
      >
        Edit
      </button>
      <MenuDivider />
      <button
        type="button"
        role="menuitem"
        style={mutItem()}
        onMouseEnter={(e) => canMutate && itemHover(e.currentTarget, true)}
        onMouseLeave={(e) => itemHover(e.currentTarget, false)}
        onClick={() => {
          if (!canMutate) return
          void onTogglePublish?.()
          onClose()
        }}
      >
        {published ? 'Unpublish' : 'Publish'}
      </button>
      <button
        type="button"
        role="menuitem"
        style={itemBase}
        onMouseEnter={(e) => itemHover(e.currentTarget, true)}
        onMouseLeave={(e) => itemHover(e.currentTarget, false)}
        onClick={() => {
          onSaveToLibraryStub?.()
          onClose()
        }}
      >
        Save to Library
      </button>
      <MenuDivider />
      <button
        type="button"
        role="menuitem"
        style={mutItem()}
        onMouseEnter={(e) => canMutate && itemHover(e.currentTarget, true)}
        onMouseLeave={(e) => itemHover(e.currentTarget, false)}
        onClick={() => {
          if (!canMutate) return
          setPanel((p) => (p === 'repeat' ? null : 'repeat'))
        }}
      >
        Repeat
      </button>
      {panel === 'repeat' ? (
        <div style={{ padding: '8px 12px 10px', fontSize: 'var(--font-size-body-sm)' }}>
          <div style={{ marginBottom: 6, color: 'var(--color-text-muted)' }}>Repeat on:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {dayCols.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => setRepeatIso(d.iso)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${repeatIso === d.iso ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: repeatIso === d.iso ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-body-sm)',
                  cursor: 'pointer',
                }}
              >
                {d.dow}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={{
                padding: '6px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-body-sm)',
                cursor: 'pointer',
              }}
              onClick={() => setPanel(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              style={{
                padding: '6px 10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--font-size-body-sm)',
                cursor: 'pointer',
              }}
              onClick={() => {
                onRepeatConfirm?.(repeatIso)
                onClose()
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        role="menuitem"
        style={mutItem()}
        onMouseEnter={(e) => canMutate && itemHover(e.currentTarget, true)}
        onMouseLeave={(e) => itemHover(e.currentTarget, false)}
        onClick={() => {
          if (!canMutate) return
          void onCopyToClipboard?.()
          onClose()
        }}
      >
        Copy
      </button>
      <MenuDivider />
      <button
        type="button"
        role="menuitem"
        style={{
          ...mutItem({
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }),
        }}
        onMouseEnter={(e) => {
          if (!canMutate) return
          e.currentTarget.style.background = 'var(--color-surface-high)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        onClick={() => {
          if (!canMutate) return
          setPanel((p) => (p === 'delete' ? null : 'delete'))
        }}
      >
        <TrashIcon />
        Delete
      </button>
      {panel === 'delete' ? (
        <div style={{ padding: '8px 12px 12px', fontSize: 'var(--font-size-body-sm)', color: 'var(--color-text)' }}>
          <p style={{ margin: '0 0 10px', lineHeight: 1.45 }}>
            Delete <strong>{name}</strong>? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{
                padding: '6px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-body-sm)',
                cursor: 'pointer',
              }}
              onClick={() => setPanel(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-danger)',
                color: '#fff',
                fontSize: 'var(--font-size-body-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: 'pointer',
              }}
              onClick={() => {
                onDeleteConfirm?.()
                onClose()
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
