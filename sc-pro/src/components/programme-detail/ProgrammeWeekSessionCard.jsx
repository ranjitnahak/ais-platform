import { useCallback, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { CAT_BORDER, CAT_SOFT } from '../../lib/programmeSessionUi.js'
import SessionCardContextMenu from './SessionCardContextMenu.jsx'
import { SessionCardBody } from './SessionCardBody.jsx'

const menuBtn = {
  flexShrink: 0,
  width: 32,
  height: 32,
  padding: 0,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
}

function SessionSelectCheckbox({ checked, visible, onToggle, sessionId }) {
  return (
    <button
      type="button"
      data-session-select-checkbox
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? 'Deselect session' : 'Select session'}
      tabIndex={visible ? 0 : -1}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle(sessionId)
      }}
      style={{
        position: 'absolute',
        top: -5,
        left: -5,
        width: 18,
        height: 18,
        boxSizing: 'border-box',
        border: checked ? '2px solid var(--color-primary)' : '2px solid var(--color-text-muted)',
        borderRadius: 'var(--radius-sm)',
        background: checked ? 'var(--color-primary)' : 'var(--color-surface)',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {checked ? (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ color: 'var(--color-bg)' }}>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2 6l3 3 5-6"
          />
        </svg>
      ) : null}
    </button>
  )
}

export default function ProgrammeWeekSessionCard({
  session,
  counts,
  programmeId,
  navigate,
  canEdit,
  dnd,
  onPreview,
  dayCols = [],
  onToggleSessionPublish,
  onSaveSessionToLibraryStub,
  onRepeatSessionToDate,
  onCopySessionToClipboard,
  onDeleteSession,
  isSelected = false,
  selectionDimmed = false,
  selectionActive = false,
  onToggleSelect,
}) {
  const [menu, setMenu] = useState(null)
  const [hover, setHover] = useState(false)
  const cat = session.category || 'mixed'
  const border = CAT_BORDER[cat] || CAT_BORDER.mixed
  const soft = CAT_SOFT[cat] || CAT_SOFT.mixed
  const published = session.is_published === true

  const mergedRef = useCallback(
    (node) => {
      if (dnd?.setNodeRef) dnd.setNodeRef(node)
    },
    [dnd],
  )

  const openMenuFromButton = useCallback(
    (e) => {
      e.stopPropagation()
      if (selectionActive) return
      const r = e.currentTarget.getBoundingClientRect()
      setMenu({ x: r.right, y: r.bottom, sessionId: session.id })
    },
    [session.id, selectionActive],
  )

  const onContextMenu = useCallback(
    (e) => {
      if (selectionActive) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY, sessionId: session.id })
    },
    [session.id, selectionActive],
  )

  const closeMenu = useCallback(() => setMenu(null), [])

  const openMenuFromBody = useCallback(
    (e) => {
      setMenu({ x: e.clientX, y: e.clientY, sessionId: session.id })
    },
    [session.id],
  )

  const draft = !published
  const baseOpacity = dnd?.isDragging ? 0.45 : draft ? 0.65 : 1
  const cardOpacity = selectionDimmed ? 0.6 : baseOpacity
  const checkboxVisible = canEdit && (hover || isSelected)

  const cardStyle = {
    position: 'relative',
    textAlign: 'left',
    padding: 'var(--space-pad-y) var(--space-pad-x)',
    borderRadius: 'var(--radius-lg)',
    borderWidth: isSelected ? 2 : 1,
    borderStyle: isSelected ? 'solid' : draft ? 'dashed' : 'solid',
    borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
    borderLeftWidth: isSelected ? 2 : 3,
    borderLeftStyle: 'solid',
    borderLeftColor: isSelected ? 'var(--color-primary)' : border,
    boxShadow: isSelected ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)' : undefined,
    background: 'var(--color-surface)',
    cursor: canEdit ? 'default' : 'pointer',
    color: 'var(--color-text)',
    transform: dnd?.transform ? CSS.Translate.toString(dnd.transform) : undefined,
    opacity: cardOpacity,
    touchAction: canEdit ? 'none' : undefined,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  }

  const draftLabel = draft ? (
    <span
      className="sc-label-caps"
      style={{
        position: 'absolute',
        top: 6,
        right: 36,
        fontSize: 'var(--font-size-label)',
        color: 'var(--color-text-muted)',
        pointerEvents: 'none',
      }}
    >
      Draft
    </span>
  ) : null

  return (
    <>
      <div
        ref={mergedRef}
        data-session-card={session.id}
        style={cardStyle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onContextMenu={onContextMenu}
        {...(dnd?.attributes ?? {})}
      >
        {canEdit ? (
          <SessionSelectCheckbox
            checked={isSelected}
            visible={checkboxVisible}
            sessionId={session.id}
            onToggle={onToggleSelect}
          />
        ) : null}
        {draftLabel}
        {canEdit && dnd?.dragListeners ? (
          <div
            data-dnd-handle
            title="Drag to move"
            style={{
              width: 14,
              flexShrink: 0,
              cursor: 'grab',
              borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 10,
              userSelect: 'none',
            }}
            {...dnd.dragListeners}
          >
            ⋮⋮
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div
            role="button"
            tabIndex={0}
            style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              if (selectionActive) {
                onToggleSelect?.(session.id)
                return
              }
              if (canEdit) openMenuFromBody(e)
              else void navigate(`/programmes/${programmeId}/sessions/${session.id}`)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (selectionActive) onToggleSelect?.(session.id)
                else if (canEdit) {
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenu({ x: r.left + r.width / 2, y: r.bottom, sessionId: session.id })
                } else void navigate(`/programmes/${programmeId}/sessions/${session.id}`)
              }
            }}
          >
            <SessionCardBody
              session={session}
              counts={counts}
              cat={cat}
              soft={soft}
              categoryBadgeOpacity={published ? 1 : 0.6}
            />
          </div>
          <button
            type="button"
            aria-label="Session actions"
            aria-haspopup="menu"
            aria-expanded={menu != null}
            style={{
              ...menuBtn,
              opacity: selectionActive ? 0.35 : 1,
              pointerEvents: selectionActive ? 'none' : 'auto',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openMenuFromButton}
            onMouseEnter={(e) => {
              if (selectionActive) return
              e.currentTarget.style.background = 'var(--color-surface-high)'
              e.currentTarget.style.color = 'var(--color-text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-muted)'
            }}
          >
            ⋮
          </button>
        </div>
      </div>
      {menu && menu.sessionId === session.id ? (
        <SessionCardContextMenu
          x={menu.x}
          y={menu.y}
          session={session}
          dayCols={dayCols}
          canMutate={canEdit}
          onPreview={() => onPreview?.(session.id)}
          onEdit={() => void navigate(`/programmes/${programmeId}/sessions/${session.id}`)}
          onTogglePublish={() => onToggleSessionPublish?.(session.id)}
          onSaveToLibraryStub={() => onSaveSessionToLibraryStub?.()}
          onRepeatConfirm={(iso) => onRepeatSessionToDate?.(session.id, iso)}
          onCopyToClipboard={() => onCopySessionToClipboard?.(session.id)}
          onDeleteConfirm={() => onDeleteSession?.(session.id)}
          onClose={closeMenu}
        />
      ) : null}
    </>
  )
}
