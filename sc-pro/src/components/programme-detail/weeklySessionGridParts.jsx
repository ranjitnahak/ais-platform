import { useCallback } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CAT_BORDER, CAT_SOFT } from '../../lib/programmeSessionUi.js'
import { SessionCardBody } from './SessionCardBody.jsx'
import ProgrammeWeekSessionCard from './ProgrammeWeekSessionCard.jsx'
import {
  dayColDroppableId,
  dayColumnShellStyle,
  sessionDraggableId,
  sessionDropId,
} from './weeklySessionGridDnd.js'

export function EmptyDaySlotButton({
  iso,
  clipboardSessionName,
  bulkPasteQueueLength = 0,
  onAddSession,
  onPasteCopiedSession,
  onPasteSlot,
}) {
  const bulkPaste = bulkPasteQueueLength > 0
  const pasteMode = Boolean(clipboardSessionName) || bulkPaste
  const label = bulkPaste ? 'Paste here' : clipboardSessionName ? `Paste: ${clipboardSessionName}` : '+ Add Session'
  return (
    <button
      type="button"
      {...(pasteMode ? { 'data-clipboard-paste-slot': 'true' } : {})}
      onClick={() => {
        if (onPasteSlot?.(iso)) return
        if (pasteMode) onPasteCopiedSession?.(iso)
        else onAddSession?.(iso)
      }}
      style={{
        minHeight: 96,
        borderRadius: 'var(--radius-lg)',
        border: pasteMode ? '1px dashed var(--color-primary)' : '1px dashed var(--color-border)',
        background: 'transparent',
        color: 'var(--color-primary)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-body-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = pasteMode ? 'var(--color-primary)' : 'var(--color-border)'
      }}
    >
      {label}
    </button>
  )
}

export function DayDropColumnDnd({ iso, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: dayColDroppableId(iso),
    data: { type: 'day', iso },
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        ...dayColumnShellStyle,
        outline: isOver ? '2px dashed var(--color-primary)' : 'none',
        outlineOffset: 2,
        padding: isOver ? 2 : 0,
        margin: isOver ? -2 : 0,
      }}
    >
      {children}
    </div>
  )
}

export function DragSessionPreview({ session, counts }) {
  const cat = session.category || 'mixed'
  const border = CAT_BORDER[cat] || CAT_BORDER.mixed
  const soft = CAT_SOFT[cat] || CAT_SOFT.mixed
  const published = session.is_published === true
  const draft = !published
  return (
    <div
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: 'var(--space-pad-y) var(--space-pad-x)',
        borderRadius: 'var(--radius-lg)',
        borderWidth: 1,
        borderStyle: draft ? 'dashed' : 'solid',
        borderColor: 'var(--color-border)',
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: border,
        background: 'var(--color-surface-highest)',
        color: 'var(--color-text)',
        boxShadow: '0 8px 24px color-mix(in srgb, var(--color-bg) 50%, transparent)',
        cursor: 'grabbing',
        maxWidth: 280,
        opacity: draft ? 0.65 : 1,
      }}
    >
      {draft ? (
        <span
          className="sc-label-caps"
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            fontSize: 'var(--font-size-label)',
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
        >
          Draft
        </span>
      ) : null}
      <SessionCardBody
        session={session}
        counts={counts}
        cat={cat}
        soft={soft}
        categoryBadgeOpacity={published ? 1 : 0.6}
      />
    </div>
  )
}

export function DraggableWeekSessionCard({
  session,
  counts,
  programmeId,
  navigate,
  canEdit,
  onPreview,
  dayCols,
  onToggleSessionPublish,
  onSaveSessionToLibraryStub,
  onRepeatSessionToDate,
  onCopySessionToClipboard,
  onDeleteSession,
  isSelected,
  selectionDimmed,
  selectionActive,
  onToggleSelect,
}) {
  const { attributes, listeners: dragListeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: sessionDraggableId(session.id),
    disabled: !canEdit,
    data: { type: 'session', sessionId: session.id },
  })
  const { setNodeRef: setDropRef } = useDroppable({
    id: sessionDropId(session.id),
    disabled: !canEdit,
    data: { type: 'sessionDrop', sessionId: session.id },
  })
  const setMergedNodeRef = useCallback(
    (node) => {
      setDragRef(node)
      setDropRef(node)
    },
    [setDragRef, setDropRef],
  )

  return (
    <ProgrammeWeekSessionCard
      session={session}
      counts={counts}
      programmeId={programmeId}
      navigate={navigate}
      canEdit={canEdit}
      onPreview={onPreview}
      dayCols={dayCols}
      onToggleSessionPublish={onToggleSessionPublish}
      onSaveSessionToLibraryStub={onSaveSessionToLibraryStub}
      onRepeatSessionToDate={onRepeatSessionToDate}
      onCopySessionToClipboard={onCopySessionToClipboard}
      onDeleteSession={onDeleteSession}
      isSelected={isSelected}
      selectionDimmed={selectionDimmed}
      selectionActive={selectionActive}
      onToggleSelect={onToggleSelect}
      dnd={{ setNodeRef: setMergedNodeRef, dragListeners, attributes, transform, isDragging }}
    />
  )
}
